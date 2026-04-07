import Razorpay from "razorpay";
import admin from "firebase-admin";
import crypto from "crypto";

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('ascii')
    );
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// RAZORPAY CONFIGURATION
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "bichat@2161";

export const handler = async (event, context) => {
    // 0. GET handler for manual testing / ping
    if (event.httpMethod === "GET") {
        return { 
            statusCode: 200, 
            body: JSON.stringify({
                status: "Live",
                message: "Razorpay Webhook is active and reachable.",
                environment: process.env.FIREBASE_SERVICE_ACCOUNT ? "Firebase Initialized" : "Firebase Missing",
                webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET ? "Configured" : "Using Default"
            })
        };
    }

    // Only allow POST for actual webhooks
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const payloadStr = event.body;
        const signature = event.headers["x-razorpay-signature"];

        // 1. Verify Signature
        const expectedSignature = crypto
            .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
            .update(payloadStr)
            .digest("hex");

        if (expectedSignature !== signature) {
            console.error("[WEBHOOK] Invalid signature");
            return { statusCode: 401, body: "Invalid signature" };
        }

        const payload = JSON.parse(payloadStr);
        console.log("[WEBHOOK] Received event:", payload.event);

        // 2. Extract Payment/Order data
        if (payload.event === "payment.captured" || payload.event === "order.paid") {
            const payment = payload.payload.payment?.entity;
            const order = payload.payload.order?.entity;
            const data = payment || order;
            
            if (!data) {
                console.error("[WEBHOOK] No payment or order entity found in payload");
                return { statusCode: 200, body: "OK - Data missing" };
            }

            const notes = data.notes || {};
            console.log("[WEBHOOK] Raw Notes received:", JSON.stringify(notes));
            
            // Search for UserId in multiple places and case variations
            let userId = notes.userId || 
                         notes.user_id || 
                         notes.userid || 
                         notes.notes_userId || 
                         notes["User ID"] || 
                         notes["user id"];

            const paymentId = payment?.id || data.id;
            const paymentAmount = data.amount / 100; // back to INR

            // Search for Coins in multiple places
            let coinsAmount = parseInt(notes.coinsAmount || 
                                     notes.coins_amount || 
                                     notes.coins || 
                                     notes["Coins"] || 
                                     0);
            
            let packageId = notes.packageId || notes.package_id || notes["Package ID"] || "custom";

            // FALLBACK: If coinsAmount is 0, infer from the actual price paid
            if (coinsAmount === 0 && paymentAmount > 0) {
                console.log(`[WEBHOOK] coinsAmount missing in notes. Inferring from amount paid: ₹${paymentAmount}`);
                if (paymentAmount >= 50) coinsAmount = 65;
                else if (paymentAmount >= 20) coinsAmount = 25;
                else if (paymentAmount >= 10) coinsAmount = 10;
                else if (paymentAmount >= 1) coinsAmount = Math.floor(paymentAmount); // 1 coin per rupee for small tests
            }

            console.log(`[WEBHOOK] Meta: Payment=${paymentId}, Amount=₹${paymentAmount}, User=${userId}, Coins=${coinsAmount}`);

            if (!userId) {
                console.warn("[WEBHOOK] FATAL: Missing userId. Cannot credit coins.");
                console.warn("[WEBHOOK] Debug - Full Data Keys:", Object.keys(data));
                console.warn("[WEBHOOK] Debug - Notes Keys:", Object.keys(notes));
                // We return 200 to acknowledge receipt to Razorpay, but log the failure
                return { 
                    statusCode: 200, 
                    body: "OK - Webhook received but userId missing in notes" 
                };
            }

            if (coinsAmount <= 0) {
                console.warn("[WEBHOOK] No coins to credit (amount is 0)");
                return { statusCode: 200, body: "OK - Zero coins" };
            }

            // 3. Process credit in transaction
            const userRef = db.collection("users").doc(userId);

            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    console.error(`[WEBHOOK] User ${userId} not found in database`);
                    return; // Fail silently to Razorpay
                }

                // Check for duplicate processing (Payment ID should be unique)
                const paymentCheck = await db.collection("verified_payments")
                    .where("paymentId", "==", paymentId)
                    .limit(1)
                    .get();

                if (!paymentCheck.empty) {
                    console.log(`[WEBHOOK] Duplicate: Payment ${paymentId} already processed`);
                    return;
                }

                const currentCoins = userDoc.data().coins || 0;
                const newBalance = currentCoins + coinsAmount;

                // Update user
                transaction.update(userRef, {
                    coins: newBalance,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Record payment
                const paymentRef = db.collection("verified_payments").doc();
                transaction.set(paymentRef, {
                    paymentId: paymentId,
                    userId: userId,
                    packageId: packageId,
                    coinsAmount: coinsAmount,
                    amount: paymentAmount,
                    status: "captured",
                    provider: "razorpay_webhook",
                    notes: notes,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Log coin transaction
                const coinTxRef = userRef.collection("coinTransactions").doc();
                transaction.set(coinTxRef, {
                    type: 'credit',
                    amount: coinsAmount,
                    reason: `purchase_razorpay_${packageId}`,
                    balanceBefore: currentCoins,
                    balanceAfter: newBalance,
                    paymentId: paymentId,
                    provider: 'razorpay_webhook',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });

            console.log(`[WEBHOOK] SUCCESS: Credited ${coinsAmount} coins to user ${userId}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ status: "success" })
        };

    } catch (error) {
        console.error("[WEBHOOK] Error:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
