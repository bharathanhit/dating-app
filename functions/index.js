const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();

// UPI CONFIGURATION
// Loaded from .env file
const ADMIN_UPI_ID = process.env.UPI_ID || "abharathan61-2@okaxis"; 

/**
 * Submit Payment Proof (UTR)
 * Callable Function: Called by user after paying via UPI
 */
exports.submitPaymentProof = functions.https.onCall(async (data, context) => {
  // 1. Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const userId = context.auth.uid;
  const { packageId, packageName, amount, price, transactionId } = data;

  // 2. Validate input
  if (!packageId || !amount || !price || !transactionId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required parameters."
    );
  }

  try {
    // 3. Create Payment Request Doc
    const requestRef = admin.firestore().collection("payment_requests").doc();
    
    await requestRef.set({
        userId: userId,
        packageId: packageId,
        packageName: packageName,
        coinsAmount: amount,
        price: price, // String like "₹10"
        transactionId: transactionId, // UTR
        upiId: ADMIN_UPI_ID,
        status: "pending", // pending, approved, rejected
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userName: context.auth.token.name || "Unknown User",
        userEmail: context.auth.token.email || ""
    });

    return { success: true, message: "Verification Pending" };

  } catch (error) {
    console.error("Error submitting payment proof:", error);
    throw new functions.https.HttpsError("internal", "Unable to submit payment proof.");
  }
});

/**
 * Trigger: On Payment Approved
 * Listens for updates to 'payment_requests' collection.
 * If status changes to 'approved', adds coins to user.
 */
exports.onPaymentApproved = functions.firestore
    .document('payment_requests/{requestId}')
    .onUpdate(async (change, context) => {
      const newData = change.after.data();
      const previousData = change.before.data();

      // Only proceed if status changed to 'approved' AND it wasn't approved before
      if (newData.status === 'approved' && previousData.status !== 'approved') {
          const userId = newData.userId;
          const coinsAmount = newData.coinsAmount;
          const packageId = newData.packageId;
          const transactionId = newData.transactionId;

          console.log(`Approving payment ${context.params.requestId} for User ${userId}`);

          const userRef = admin.firestore().collection("users").doc(userId);

          try {
              await admin.firestore().runTransaction(async (transaction) => {
                  const userDoc = await transaction.get(userRef);
                  if (!userDoc.exists) {
                      throw "User does not exist!";
                  }

                  const currentCoins = userDoc.data().coins || 0;
                  const newBalance = currentCoins + coinsAmount;

                  // Update coins
                  transaction.update(userRef, { 
                      coins: newBalance,
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });

                  // Log transaction
                  const transactionRef = userRef.collection("coinTransactions").doc();
                  transaction.set(transactionRef, {
                      type: 'credit',
                      amount: coinsAmount,
                      reason: `purchase_upi_${packageId}`,
                      balanceBefore: currentCoins,
                      balanceAfter: newBalance,
                      paymentRequestId: context.params.requestId,
                      utr: transactionId,
                      provider: 'upi_manual',
                      createdAt: admin.firestore.FieldValue.serverTimestamp()
                  });
              });
              console.log(`Successfully added ${coinsAmount} coins to user ${userId}`);
          } catch (error) {
              console.error("Failed to add coins on approval:", error);
              // Optionally revert status to 'error' or log manual intervention needed
          }
      }
    });
