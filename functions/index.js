const { onCall, onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

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

// Coin amount fallback map (paise → coins)
const COIN_MAP = {
    1000: 10,
    2000: 25,
    5000: 75,
};

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

    logger.info("[ORDER] Data received:", { amount, coinsAmount, packageId, userId });

    if (!amount || isNaN(amount)) {
        logger.error("[ORDER] Invalid amount:", amount);
        return { success: false, error: "Valid amount is required" };
    }

    try {
        const options = {
            amount: Number(amount), // Amount in paise
            currency: "INR",
            receipt: `coin_topup_${Date.now()}`,
            notes: {
                userId: userId,
                coinsAmount: String(coinsAmount),
                packageId: String(packageId)
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
 * Supports two flows:
 *   a) Modal checkout — has razorpay_signature, verify it cryptographically
 *   b) Payment link redirect — no signature available, verify via Razorpay API fetch
 */
exports.verifyRazorpayPayment = onCall(async (request) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    } = request.data;

    const userId = request.auth ? request.auth.uid : request.data.userId;
    let coinsAmount = request.data.coinsAmount ? Number(request.data.coinsAmount) : null;

    logger.info("[VERIFY] Attempt", { paymentId: razorpay_payment_id, orderId: razorpay_order_id, userId, hasSignature: !!razorpay_signature });

    if (!razorpay_payment_id) {
        logger.error("[VERIFY] Missing payment ID");
        return { success: false, error: "Missing payment ID" };
    }

    if (!userId) {
        logger.error("[VERIFY] Missing userId");
        return { success: false, error: "User not identified" };
    }

    try {
        // ── Idempotency check ──────────────────────────────────────────────
        const verifiedRef = db.collection("verified_payments").doc(razorpay_payment_id);
        const verifiedDoc = await verifiedRef.get();
        if (verifiedDoc.exists) {
            logger.info("[VERIFY] Already processed", { razorpay_payment_id });
            return { success: true, message: "Already processed" };
        }

        // ── Signature / Payment Verification ──────────────────────────────
        if (razorpay_signature && razorpay_order_id) {
            // Flow A: Modal checkout — cryptographic signature check
            const generated_signature = crypto
                .createHmac("sha256", RAZORPAY_KEY_SECRET)
                .update(razorpay_order_id + "|" + razorpay_payment_id)
                .digest("hex");

            if (generated_signature !== razorpay_signature) {
                logger.warn("[VERIFY] Signature MISMATCH", {
                    generated: generated_signature,
                    received: razorpay_signature
                });
                return { success: false, error: "Invalid payment signature" };
            }
            logger.info("[VERIFY] Signature verified OK");
        } else {
            // Flow B: Payment link redirect — verify via Razorpay API
            logger.info("[VERIFY] No signature — verifying via Razorpay API fetch");
            try {
                const payment = await razorpay.payments.fetch(razorpay_payment_id);
                logger.info("[VERIFY] Razorpay API status:", { status: payment.status, paymentId: razorpay_payment_id });
                if (payment.status !== "captured") {
                    return { success: false, error: `Payment not captured. Status: ${payment.status}` };
                }
                // Trust the payment data from Razorpay API
                if (!coinsAmount && payment.notes && payment.notes.coinsAmount) {
                    coinsAmount = Number(payment.notes.coinsAmount);
                }
                if (!coinsAmount && payment.amount) {
                    coinsAmount = COIN_MAP[payment.amount];
                }
            } catch (fetchErr) {
                logger.error("[VERIFY] Razorpay API fetch failed", fetchErr);
                return { success: false, error: "Could not verify payment with Razorpay" };
            }
        }

        // ── Resolve coinsAmount if still missing ──────────────────────────
        if (!coinsAmount && razorpay_order_id) {
            try {
                const orderDoc = await razorpay.orders.fetch(razorpay_order_id);
                if (orderDoc.notes && orderDoc.notes.coinsAmount) {
                    coinsAmount = Number(orderDoc.notes.coinsAmount);
                }
                if (!coinsAmount && orderDoc.amount) {
                    coinsAmount = COIN_MAP[orderDoc.amount];
                }
            } catch (e) {
                logger.warn("[VERIFY] Could not fetch order for coins fallback:", e.message);
            }
        }

        if (!coinsAmount || isNaN(coinsAmount) || coinsAmount <= 0) {
            logger.error("[VERIFY] Could not determine coinsAmount", { coinsAmount });
            return { success: false, error: "Invalid coin package data" };
        }

        // ── Atomic Firestore transaction ───────────────────────────────────
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
                orderId: razorpay_order_id || null,
                reason: "coin_purchase",
                balanceBefore: currentCoins,
                balanceAfter: newCoins,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
                coinsAmount: Number(coinsAmount)
            });
        });

        logger.info("[VERIFY] SUCCESS", { userId, coinsAmount, paymentId: razorpay_payment_id });
        return { success: true, coinsAmount };
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
        secretPrefix: RAZORPAY_WEBHOOK_SECRET.substring(0, 4) + "...",
        secretLen: RAZORPAY_WEBHOOK_SECRET.length
    });

    // Compute HMAC over the raw body bytes
    const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody) // pass Buffer directly — no toString() conversion
        .digest("hex");

    if (expectedSignature !== signature) {
        logger.error("[WEBHOOK] Signature mismatch", {
            received: signature,
            calculated: expectedSignature,
            bodyLength: rawBody.length
        });
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
        let coinsAmount = notes.coinsAmount ? Number(notes.coinsAmount) : null;

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
            coinsAmount = COIN_MAP[payment.amount];
        }

        if (!coinsAmount || coinsAmount <= 0) {
            logger.error("[WEBHOOK] Could not determine coinsAmount", { amount: payment.amount });
            return response.status(200).send("OK but unknown package");
        }

        try {
            const verifiedRef = db.collection("verified_payments").doc(paymentId);
            const verifiedDoc = await verifiedRef.get();
            if (verifiedDoc.exists) {
                logger.info("[WEBHOOK] Already processed", { paymentId });
                return response.status(200).send("Already Processed");
            }

            await db.runTransaction(async (transaction) => {
                const userRef = db.collection("users").doc(userId);
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) throw new Error("User missing in database");

                const userData = userDoc.data();
                const currentCoins = Number(userData.coins || 0);
                const newBalance = currentCoins + Number(coinsAmount);

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
                    reason: "coin_purchase",
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
                    coinsAmount: Number(coinsAmount)
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

/**
 * 4. Helper to send FCM notification
 */
async function sendPushNotification(userId, payload) {
    try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) return;

        const tokens = userDoc.data()?.fcmTokens || [];
        if (tokens.length === 0) {
            logger.info(`[FCM] No tokens for user ${userId}`);
            return;
        }

        const message = {
            notification: payload.notification,
            data: payload.data || {},
            tokens: tokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        logger.info(`[FCM] Successfully sent ${response.successCount} messages to user ${userId}`);

        // Clean up invalid tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });
            if (failedTokens.length > 0) {
                await db.collection("users").doc(userId).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
                });
                logger.info(`[FCM] Removed ${failedTokens.length} invalid tokens for user ${userId}`);
            }
        }
    } catch (error) {
        logger.error(`[FCM] Error sending push notification to user ${userId}:`, error);
    }
}

/**
 * 5. Trigger: New Message Notification
 */
exports.onMessageCreated = onDocumentCreated({
    document: "conversations/{conversationId}/messages/{messageId}",
    region: "asia-south1"
}, async (event) => {
    const messageData = event.data.data();
    const conversationId = event.params.conversationId;

    try {
        const convDoc = await db.collection("conversations").doc(conversationId).get();
        if (!convDoc.exists) return;

        const participants = convDoc.data().participants || [];
        const senderId = messageData.from;
        const recipientId = participants.find(id => id !== senderId);

        if (!recipientId) return;

        // Get sender info
        const senderDoc = await db.collection("users").doc(senderId).get();
        const senderName = senderDoc.data()?.name || "Someone";

        await sendPushNotification(recipientId, {
            notification: {
                title: `New message from ${senderName}`,
                body: messageData.type === 'audio' ? '🎤 Audio Message' : messageData.text,
            },
            data: {
                conversationId: conversationId,
                senderId: senderId,
                type: 'chat'
            }
        });
    } catch (error) {
        logger.error("[onMessageCreated] Error:", error);
    }
});

/**
 * 6. Trigger: New Like Notification
 */
exports.onLikeCreated = onDocumentCreated({
    document: "users/{userId}/likedBy/{likerId}",
    region: "asia-south1"
}, async (event) => {
    const recipientId = event.params.userId;
    const likerId = event.params.likerId;

    try {
        const likerDoc = await db.collection("users").doc(likerId).get();
        const likerName = likerDoc.data()?.name || "Someone";

        await sendPushNotification(recipientId, {
            notification: {
                title: "New Like! ❤️",
                body: `${likerName} liked your profile!`,
            },
            data: {
                likerId: likerId,
                type: 'like'
            }
        });
    } catch (error) {
        logger.error("[onLikeCreated] Error:", error);
    }
});

/**
 * 7. Trigger: General Notification
 */
exports.onNotificationCreated = onDocumentCreated({
    document: "users/{userId}/notifications/{notificationId}",
    region: "asia-south1"
}, async (event) => {
    const recipientId = event.params.userId;
    const notificationData = event.data.data();

    // Skip if it's already a push-related notification or if we want to avoid loops
    if (notificationData.skipPush) return;

    try {
        await sendPushNotification(recipientId, {
            notification: {
                title: notificationData.title || "New Notification",
                body: notificationData.message || "You have a new update",
            },
            data: {
                notificationId: event.params.notificationId,
                type: 'general'
            }
        });
    } catch (error) {
        logger.error("[onNotificationCreated] Error:", error);
    }
});

