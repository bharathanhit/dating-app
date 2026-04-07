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
    // Only allow POST
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

        // 2. Handle payment.captured (standard for Payment Pages / Links)
        // or order.paid
        if (payload.event === "payment.captured" || payload.event === "order.paid") {
            const data = payload.payload.payment?.entity || payload.payload.order?.entity;
            const notes = data.notes || {};
            
            const userId = notes.userId;
            const paymentId = data.id;
            const paymentAmount = data.amount / 100; // back to INR

            let coinsAmount = parseInt(notes.coinsAmount || 0);
            let packageId = notes.packageId || "custom";

            // FALLBACK: Infer coins if not in notes (common for some Razorpay setups)
            if (!coinsAmount) {
                if (paymentAmount >= 50) {
                    coinsAmount = 65;
                    packageId = "3";
                } else if (paymentAmount >= 20) {
                    coinsAmount = 25;
                    packageId = "2";
                } else if (paymentAmount >= 10) {
                    coinsAmount = 10;
                    packageId = "1";
                }
            }

            if (!userId) {
                console.warn("[WEBHOOK] Missing userId or coinsAmount in notes", notes);
                return { statusCode: 200, body: "OK - No user to credit" };
            }

            // 3. Process credit in transaction
            const userRef = db.collection("users").doc(userId);

            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error(`User ${userId} not found`);
                }

                // Check for duplicate processing
                const paymentCheck = await db.collection("verified_payments")
                    .where("paymentId", "==", paymentId)
                    .limit(1)
                    .get();

                if (!paymentCheck.empty) {
                    console.log(`[WEBHOOK] Payment ${paymentId} already processed`);
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
                    amount: data.amount / 100, // back to INR
                    status: "captured",
                    provider: "razorpay_webhook",
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

            console.log(`[WEBHOOK] Successfully credited ${coinsAmount} coins to user ${userId}`);
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
