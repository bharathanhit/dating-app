const { onCall, onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Admin SDK once
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// Set global options to specific region
setGlobalOptions({ region: "us-central1" });

// Load Razorpay config from environment variables
const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "rzp_live_SZ2hAjWVwfPAA5").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "gIUEGeeEzhtY5LZgVetJAkl2").trim();
const RAZORPAY_WEBHOOK_SECRET = (process.env.RAZORPAY_WEBHOOK_SECRET || "bichat@2161").trim();

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
});

/**
 * 1. Create Order Function (Callable)
 */
exports.createRazorpayOrder = onCall(async (request) => {
    if (!request.auth) {
        logger.error("[ORDER] Unauthorized attempt");
        return { success: false, error: "Authentication required" };
    }

    const { amount, coinsAmount, packageId } = request.data;
    const userId = request.auth.uid;

    if (!amount) {
        logger.error("[ORDER] Missing amount");
        return { success: false, error: "Amount is required" };
    }

    try {
        const options = {
            amount: amount, // Amount in paise
            currency: "INR",
            receipt: `coin_topup_${Date.now()}`,
            notes: {
                userId: userId,
                coinsAmount: coinsAmount,
                packageId: packageId
            }
        };

        const order = await razorpay.orders.create(options);
        logger.info("[ORDER] Created", { orderId: order.id, userId });
        return { success: true, order };
    } catch (error) {
        logger.error("[ORDER] Error", error);
        return { success: false, error: error.message };
    }
});

/**
 * 2. Verify Payment Function (Callable)
 */
exports.verifyRazorpayPayment = onCall(async (request) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.data;
    const userId = request.auth ? request.auth.uid : request.data.userId;
    let coinsAmount = request.data.coinsAmount;

    logger.info("[VERIFY] Attempt", { paymentId: razorpay_payment_id, userId });

    if (!razorpay_payment_id || !razorpay_signature) {
        logger.error("[VERIFY] Missing data");
        return { success: false, error: "Missing verification data" };
    }

    // Official Signature Verification
    const generated_signature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");

    if (generated_signature !== razorpay_signature) {
        logger.warn("[VERIFY] Signature MISMATCH", { generated: generated_signature, received: razorpay_signature });
        return { success: false, error: "Invalid payment signature" };
    }

    try {
        const verifiedRef = db.collection("verified_payments").doc(razorpay_payment_id);
        const verifiedDoc = await verifiedRef.get();

        if (verifiedDoc.exists) {
            logger.info("[VERIFY] Already processed");
            return { success: true, message: "Already processed" };
        }

        // Logic to resolve coinsAmount if missing
        if (!coinsAmount) {
            const orderDoc = await razorpay.orders.fetch(razorpay_order_id);
            coinsAmount = orderDoc.notes && orderDoc.notes.coinsAmount;
            
            if (!coinsAmount) {
                const amt = orderDoc.amount;
                if (amt === 100) coinsAmount = 10;
                else if (amt === 200) coinsAmount = 25;
                else if (amt === 300) coinsAmount = 65;
            }
        }

        if (!coinsAmount) {
            logger.error("[VERIFY] Could not determine coinsAmount");
            return { success: false, error: "Invalid coin package data" };
        }

        await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) throw new Error("User document missing in Firestore");

            const userData = userDoc.data();
            const currentCoins = Number(userData.coins || 0);
            const newCoins = currentCoins + Number(coinsAmount);

            const transactionRef = userRef.collection("coinTransactions").doc(razorpay_payment_id);
            transaction.set(transactionRef, {
                userId,
                type: "credit",
                amount: Number(coinsAmount),
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                reason: "razorpay_checkout",
                balanceBefore: currentCoins,
                balanceAfter: newCoins,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(), // For consistency with frontend
                status: "success",
                method: "razorpay_checkout"
            });

            transaction.update(userRef, {
                coins: newCoins,
                lastPurchaseAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            transaction.set(verifiedRef, {
                verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                userId,
                coinsAmount
            });
        });

        logger.info("[VERIFY] SUCCESS", { userId, coinsAmount });
        return { success: true };
    } catch (error) {
        logger.error("[VERIFY] Critical Error", error);
        return { success: false, error: error.message };
    }
});

/**
 * 3. Razorpay Webhook (HTTPS)
 */
exports.razorpayWebhook = onRequest(async (request, response) => {
    if (request.method !== "POST") {
        return response.status(405).send("Method Not Allowed");
    }

    const signature = request.headers["x-razorpay-signature"];
    const rawBody = request.rawBody; // Buffer in Firebase Gen2

    if (!signature || !rawBody) {
        logger.error("[WEBHOOK] Missing signature or body");
        return response.status(400).send("Bad Request");
    }

    // Log for debugging
    logger.info("[WEBHOOK] Request Context", {
        sig: signature,
        bodyLen: rawBody.length,
        bodyType: typeof rawBody,
        isBuffer: Buffer.isBuffer(rawBody),
        secretPrefix: RAZORPAY_WEBHOOK_SECRET.substring(0, 2) + "...",
        secretLen: RAZORPAY_WEBHOOK_SECRET.length
    });

    // Verification using the same method as SDK recommendation
    // Ensure rawBody is a buffer as received from Razorpay
    const bodyStr = rawBody.toString('utf8');
    const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
        .update(bodyStr)
        .digest("hex");

    if (expectedSignature !== signature) {
        logger.error("[WEBHOOK] Signature mismatch", {
            received: signature,
            calculated: expectedSignature,
            bodyLength: bodyStr.length
        });
        
        // Check if we are in a state where we should allow it (e.g. debugging)
        // For production, this MUST fail.
        return response.status(400).send("Signature verification failed.");
    }

    const payload = request.body;
    const event = payload.event;

    logger.info(`[WEBHOOK] Verified Event: ${event}`);

    if (event === "payment.captured") {
        const payment = payload.payload.payment.entity;
        const paymentId = payment.id;
        const orderId = payment.order_id;
        const notes = payment.notes || {};
        
        let userId = notes.userId;
        let coinsAmount = notes.coinsAmount;

        // User Lookup Fallback
        if (!userId && payment.email) {
            const userSnap = await db.collection("users").where("email", "==", payment.email).limit(1).get();
            if (!userSnap.empty) {
                userId = userSnap.docs[0].id;
                logger.info("[WEBHOOK] User found via email lookup", { userId });
            }
        }

        if (!userId) {
            logger.error("[WEBHOOK] User identification failed", { paymentId, email: payment.email });
            return response.status(200).send("OK but user not found");
        }

        // Amount Fallback
        if (!coinsAmount) {
            const amtInPaisa = payment.amount;
            if (amtInPaisa === 100) coinsAmount = 10;
            else if (amtInPaisa === 200) coinsAmount = 25;
            else if (amtInPaisa === 300) coinsAmount = 65;
        }

        try {
            const verifiedRef = db.collection("verified_payments").doc(paymentId);
            const verifiedDoc = await verifiedRef.get();
            if (verifiedDoc.exists) return response.status(200).send("Already Processed");

            await db.runTransaction(async (transaction) => {
                const userRef = db.collection("users").doc(userId);
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) throw new Error("User missing in database");

                const userData = userDoc.data();
                const currentCoins = Number(userData.coins || 0);
                const newBalance = currentCoins + Number(coinsAmount || 0);

                transaction.update(userRef, {
                    coins: newBalance,
                    lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                const transactionRef = userRef.collection("coinTransactions").doc(paymentId);
                transaction.set(transactionRef, {
                    userId,
                    type: "credit",
                    amount: Number(coinsAmount),
                    paymentId,
                    orderId: orderId,
                    reason: "razorpay_webhook",
                    balanceBefore: currentCoins,
                    balanceAfter: newBalance,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    status: "success",
                    method: "webhook_v2"
                });

                transaction.set(verifiedRef, {
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                    method: "webhook",
                    userId: userId,
                    coinsAmount: coinsAmount
                });
            });

            logger.info("[WEBHOOK] SUCCESSFUL CREDIT", { userId, coinsAmount, paymentId });
            return response.status(200).send("OK");
        } catch (error) {
            logger.error("[WEBHOOK] Transaction Error", error);
            return response.status(500).send("Processing Error");
        }
    }

    return response.status(200).send("Event Not Handled");
});
