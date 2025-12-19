const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const crypto = require("crypto");
const axios = require("axios");

// Initialize Firebase Admin
admin.initializeApp();

// UPI CONFIGURATION
// Loaded from .env file
const ADMIN_UPI_ID = process.env.UPI_ID || "abharathan61-2@okaxis";
const INSTAMOJO_WEBHOOK_SECRET = process.env.INSTAMOJO_WEBHOOK_SECRET || "";

// INSTAMOJO CREDENTIALS (UPDATED)
const INSTAMOJO_CLIENT_ID = "t3DvU9c4jXQB8ng5ro60jmw7fqvFdLdMk104ekFv";
const INSTAMOJO_CLIENT_SECRET = "WsmwStFWfaeb6MFmR9BsUGZY9IuMNUeC2xITVL1XqtQ0wK7JFE7yGcuBTc9F2utOAWV0cB5iSLvJtO2DjDwdvZvTBktUmP0fhdCRZzOk2GTfnhDyMlppT2Vgmr3kAoRx";
const INSTAMOJO_API_ENDPOINT = "https://api.instamojo.com/v2";
const INSTAMOJO_OAUTH_ENDPOINT = "https://api.instamojo.com/oauth2/token/";

/**
 * Helper: Verify Instamojo Webhook Signature
 * @param {object} payload - Webhook payload
 * @param {string} signature - MAC signature from Instamojo
 * @returns {boolean} - True if signature is valid
 */
function verifyWebhookSignature(payload, signature) {
  if (!INSTAMOJO_WEBHOOK_SECRET) {
    console.warn("[WEBHOOK] No webhook secret configured - skipping verification");
    return true; // Allow in development, but log warning
  }

  try {
    // Instamojo uses HMAC-SHA1 for webhook signatures
    const hmac = crypto.createHmac('sha1', INSTAMOJO_WEBHOOK_SECRET);
    const data = JSON.stringify(payload);
    hmac.update(data);
    const calculatedSignature = hmac.digest('hex');
    
    return calculatedSignature === signature;
  } catch (error) {
    console.error("[WEBHOOK] Signature verification error:", error);
    return false;
  }
}

/**
 * Helper: Process Payment Success and Credit Coins
 * @param {string} userId - User ID
 * @param {number} amount - Coins to credit
 * @param {string} packageId - Package ID
 * @param {string} paymentId - Instamojo Payment ID
 * @param {string} transactionId - Transaction ID
 * @param {number} price - Price paid
 * @returns {Promise<object>} - Result
 */
async function processPaymentSuccess(userId, amount, packageId, paymentId, transactionId, price) {
  const userRef = admin.firestore().collection("users").doc(userId);
  
  try {
    await admin.firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error(`User ${userId} not found`);
      }

      const currentCoins = userDoc.data().coins || 0;
      const newBalance = currentCoins + amount;

      // Update user's coin balance
      transaction.update(userRef, { 
        coins: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log transaction in user's coin history
      const transactionRef = userRef.collection("coinTransactions").doc();
      transaction.set(transactionRef, {
        type: 'credit',
        amount: amount,
        reason: `purchase_${packageId}`,
        balanceBefore: currentCoins,
        balanceAfter: newBalance,
        paymentId: paymentId,
        transactionId: transactionId,
        price: price,
        provider: 'instamojo_webhook',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.log(`[WEBHOOK] Successfully credited ${amount} coins to user ${userId}`);
    return { success: true, coinsAdded: amount };
  } catch (error) {
    console.error(`[WEBHOOK] Error crediting coins to user ${userId}:`, error);
    throw error;
  }
}

/**
 * Instamojo Webhook Handler
 * HTTP Endpoint: Receives payment notifications from Instamojo
 * Automatically credits coins when payment is successful
 */
exports.instamojoWebhook = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  return cors(req, res, async () => {
    // Only accept POST requests
    if (req.method !== 'POST') {
      console.warn(`[WEBHOOK] Invalid method: ${req.method}`);
      return res.status(405).send('Method Not Allowed');
    }

    try {
      const payload = req.body;
      const signature = req.headers['x-instamojo-signature'] || req.headers['x-mac'];

      console.log('[WEBHOOK] Received Instamojo webhook:', {
        paymentId: payload.payment_id,
        status: payload.status,
        amount: payload.amount
      });

      // Verify webhook signature for security
      if (!verifyWebhookSignature(payload, signature)) {
        console.error('[WEBHOOK] Invalid signature - possible fraud attempt');
        return res.status(401).send('Unauthorized - Invalid Signature');
      }

      // Extract payment details
      const {
        payment_id: paymentId,
        payment_request_id: paymentRequestId,
        status,
        amount,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        custom_fields,
        mac
      } = payload;

      // Only process successful payments
      if (status !== 'Credit') {
        console.log(`[WEBHOOK] Ignoring payment with status: ${status}`);
        return res.status(200).send('OK - Non-credit status');
      }

      // Extract userId and packageId from custom fields
      // Custom fields should be set when creating payment link
      const userId = custom_fields?.userId || custom_fields?.user_id;
      const packageId = custom_fields?.packageId || custom_fields?.package_id;
      const coinsAmount = parseInt(custom_fields?.coins || custom_fields?.amount || 0);

      if (!userId || !packageId || !coinsAmount) {
        console.error('[WEBHOOK] Missing required custom fields:', { userId, packageId, coinsAmount });
        return res.status(400).send('Bad Request - Missing custom fields');
      }

      // Check for duplicate payment processing
      const existingPayment = await admin.firestore()
        .collection("webhook_payments")
        .where("paymentId", "==", paymentId)
        .limit(1)
        .get();

      if (!existingPayment.empty) {
        console.log(`[WEBHOOK] Payment ${paymentId} already processed - skipping`);
        return res.status(200).send('OK - Already processed');
      }

      // Record webhook payment
      await admin.firestore().collection("webhook_payments").add({
        paymentId: paymentId,
        paymentRequestId: paymentRequestId,
        userId: userId,
        packageId: packageId,
        coinsAmount: coinsAmount,
        amount: parseFloat(amount),
        buyerName: buyerName,
        buyerEmail: buyerEmail,
        status: status,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        rawPayload: payload
      });

      // Process payment and credit coins
      await processPaymentSuccess(
        userId,
        coinsAmount,
        packageId,
        paymentId,
        paymentRequestId,
        parseFloat(amount)
      );

      console.log(`[WEBHOOK] Payment ${paymentId} processed successfully`);
      return res.status(200).send('OK - Payment processed');

    } catch (error) {
      console.error('[WEBHOOK] Error processing webhook:', error);
      return res.status(500).send('Internal Server Error');
    }
  });
});
 

/**
 * Submit Payment Proof (UTR)
 * Callable Function: Called by user after paying via UPI
 * AUTO-CREDITS coins immediately upon submission
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
    // 3. Check for duplicate transaction ID to prevent double-crediting
    const existingPayment = await admin.firestore()
      .collection("payment_requests")
      .where("transactionId", "==", transactionId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (!existingPayment.empty) {
      throw new functions.https.HttpsError(
        "already-exists",
        "This transaction ID has already been submitted."
      );
    }

    // 4. Create Payment Request Doc with auto-approved status
    const requestRef = admin.firestore().collection("payment_requests").doc();
    const requestId = requestRef.id;
    
    await requestRef.set({
        userId: userId,
        packageId: packageId,
        packageName: packageName,
        coinsAmount: amount,
        price: price,
        transactionId: transactionId,
        upiId: ADMIN_UPI_ID,
        status: "auto_approved", // Automatically approved
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        userName: context.auth.token.name || "Unknown User",
        userEmail: context.auth.token.email || ""
    });

    // 5. Immediately credit coins to user
    const userRef = admin.firestore().collection("users").doc(userId);
    
    await admin.firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "User account not found."
        );
      }

      const currentCoins = userDoc.data().coins || 0;
      const newBalance = currentCoins + amount;

      // Update user's coin balance
      transaction.update(userRef, { 
        coins: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log transaction in user's coin history
      const transactionRef = userRef.collection("coinTransactions").doc();
      transaction.set(transactionRef, {
        type: 'credit',
        amount: amount,
        reason: `purchase_${packageId}`,
        balanceBefore: currentCoins,
        balanceAfter: newBalance,
        paymentRequestId: requestId,
        transactionId: transactionId,
        provider: 'instamojo_manual',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.log(`[AUTO-APPROVED] Added ${amount} coins to user ${userId} for transaction ${transactionId}`);

    return { 
      success: true, 
      message: "Payment verified! Coins added to your account.",
      coinsAdded: amount
    };

  } catch (error) {
    console.error("Error submitting payment proof:", error);
    
    // Return specific error messages
    if (error.code === "already-exists") {
      throw error;
    }
    
    throw new functions.https.HttpsError("internal", "Unable to process payment. Please try again.");
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

/**
 * Verify Instamojo Payment
 * Callable Function: Verifies payment via Instamojo API and credits coins
 * Called by user after completing payment with Payment ID
 */
/**
 * Helper: Get Instamojo Access Token
 * Uses Client Credentials flow
 */
async function getInstamojoAccessToken() {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', INSTAMOJO_CLIENT_ID);
    params.append('client_secret', INSTAMOJO_CLIENT_SECRET);

    const response = await axios.post(INSTAMOJO_OAUTH_ENDPOINT, params);
    
    if (response.data && response.data.access_token) {
      return response.data.access_token;
    }
    throw new Error("No access token in response");
  } catch (error) {
    console.error("[AUTH] Failed to get Instamojo access token:", error.response?.data || error.message);
    throw new Error("Authentication with payment gateway failed");
  }
}

/**
 * Create Instamojo Payment Request
 * Callable Function: Generates a payment link
 */
exports.createInstamojoPayment = functions.https.onCall(async (data, context) => {
  // 1. Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to make a purchase."
    );
  }

  const userId = context.auth.uid;
  const { packageId } = data;
  const userEmail = context.auth.token.email || "user@example.com";
  const userName = context.auth.token.name || "User";

  // 2. Validate input
  if (!packageId) {
    throw new functions.https.HttpsError("invalid-argument", "Package ID is required.");
  }

  try {
    // 3. Get API Access Token
    const accessToken = await getInstamojoAccessToken();

    // 4. Get package details
    const coinPackages = {
      1: { coins: 1, price: 1, name: "1 Coins" },
      2: { coins: 25, price: 20, name: "25 Coins" },
      3: { coins: 62, price: 50, name: "62 Coins" },
    };

    const pkg = coinPackages[packageId];
    if (!pkg) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid package ID.");
    }

    // 5. Create Payment Request
    const redirectUrl = "https://bichat-make-friendswith-bichat.netlify.app/coins";
    // const webhookUrl = "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/instamojoWebhook"; // Optional

    const payload = new URLSearchParams();
    payload.append('amount', pkg.price);
    payload.append('purpose', `Purchase ${pkg.name}`);
    payload.append('buyer_name', userName);
    payload.append('email', userEmail);
    payload.append('redirect_url', redirectUrl);
    payload.append('allow_repeated_payments', 'false');

    const response = await axios.post(
      `${INSTAMOJO_API_ENDPOINT}/payment_requests/`,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
      }
    );

    if (response.data && response.data.longurl) {
        return { paymentUrl: response.data.longurl };
    } else {
        throw new Error("Failed to generate payment URL");
    }

  } catch (error) {
    console.error("[CREATE_PAYMENT] Error:", error);
    if (error.response) {
         console.error("[CREATE_PAYMENT] API Response:", error.response.data);
    }
    throw new functions.https.HttpsError("internal", "Unable to create payment link.");
  }
});

/**
 * Verify Instamojo Payment
 * Callable Function: Verifies payment via Instamojo API and credits coins
 * Called by user after completing payment with Payment ID
 */
exports.verifyInstamojoPayment = functions.https.onCall(async (data, context) => {
  // 1. Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to verify payments."
    );
  }

  const userId = context.auth.uid;
  const { paymentId, packageId } = data;

  // 2. Validate input
  if (!paymentId || !packageId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Payment ID and Package ID are required."
    );
  }

  try {
    // 3. Get API Access Token
    const accessToken = await getInstamojoAccessToken();

    // 4. Check for duplicate payment processing
    const existingPayment = await admin.firestore()
      .collection("verified_payments")
      .where("paymentId", "==", paymentId)
      .limit(1)
      .get();

    if (!existingPayment.empty) {
      const existingDoc = existingPayment.docs[0].data();
      if (existingDoc.userId === userId) {
        throw new functions.https.HttpsError(
          "already-exists",
          "This payment has already been verified and coins have been credited."
        );
      } else {
        throw new functions.https.HttpsError(
          "permission-denied",
          "This payment ID belongs to another user."
        );
      }
    }

    // 5. Verify payment with Instamojo API
    console.log(`[VERIFY] Verifying payment ${paymentId} for user ${userId}`);
    
    const response = await axios.get(
      `${INSTAMOJO_API_ENDPOINT}/payments/${paymentId}/`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    const payment = response.data;
    
    // 6. Validate payment status
    if (payment.status !== "Credit") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Payment status is ${payment.status}. Only successful payments can be verified.`
      );
    }

    // 7. Get package details and validate amount
    // MAPPED TO FRONTEND PACKAGES (CoinsPage.jsx)
    const coinPackages = {
      1: { coins: 1, price: 1 },
      2: { coins: 25, price: 20 },
      3: { coins: 62, price: 50 },
    };

    const pkg = coinPackages[packageId];
    if (!pkg) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid package ID."
      );
    }

    const paidAmount = parseFloat(payment.amount);
    if (paidAmount < pkg.price) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Payment amount (₹${paidAmount}) does not match package price (₹${pkg.price}).`
      );
    }

    // 8. Record verified payment
    await admin.firestore().collection("verified_payments").add({
      paymentId: paymentId,
      userId: userId,
      packageId: packageId,
      coinsAmount: pkg.coins,
      amount: paidAmount,
      buyerName: payment.buyer_name,
      buyerEmail: payment.buyer_email,
      buyerPhone: payment.buyer_phone,
      status: payment.status,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentData: payment,
    });

    // 9. Credit coins to user
    const userRef = admin.firestore().collection("users").doc(userId);
    
    await admin.firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "User account not found."
        );
      }

      const currentCoins = userDoc.data().coins || 0;
      const newBalance = currentCoins + pkg.coins;

      // Update user's coin balance
      transaction.update(userRef, { 
        coins: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log transaction in user's coin history
      const transactionRef = userRef.collection("coinTransactions").doc();
      transaction.set(transactionRef, {
        type: 'credit',
        amount: pkg.coins,
        reason: `purchase_${packageId}`,
        balanceBefore: currentCoins,
        balanceAfter: newBalance,
        paymentId: paymentId,
        price: paidAmount,
        provider: 'instamojo_api',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.log(`[VERIFY] Successfully credited ${pkg.coins} coins to user ${userId} for payment ${paymentId}`);

    return { 
      success: true, 
      message: `Payment verified! ${pkg.coins} coins have been added to your account.`,
      coinsAdded: pkg.coins
    };

  } catch (error) {
    console.error("[VERIFY] Error verifying payment:", error);
    
    // Handle specific error types
    if (error.code) {
      throw error; // Re-throw HttpsError
    }
    
    // Handle Axios errors
    if (error.response) {
      const status = error.response.status;
      if (status === 404) {
        throw new functions.https.HttpsError(
          "not-found",
          "Payment ID not found. Please check and try again."
        );
      } else if (status === 401 || status === 403) {
        throw new functions.https.HttpsError(
          "unavailable",
          "Payment verification service temporarily unavailable."
        );
      }
    }
    
    throw new functions.https.HttpsError(
      "internal",
      "Unable to verify payment. Please try again or contact support."
    );
  }
});

