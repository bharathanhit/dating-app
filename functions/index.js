const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const crypto = require("crypto");
const axios = require("axios");
const Razorpay = require("razorpay");

// Initialize Firebase Admin
admin.initializeApp();

// RAZORPAY CONFIGURATION
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_live_SZ2hAjWVwfPAA5";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "gIUEGeeEzhtY5LZgVetJAkl2";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "bichat@2161";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// UPI CONFIGURATION
// Loaded from .env file
const ADMIN_UPI_ID = process.env.UPI_ID || "abharathan61-2@okaxis";
const INSTAMOJO_WEBHOOK_SECRET = process.env.INSTAMOJO_WEBHOOK_SECRET || "";

// INSTAMOJO CREDENTIALS (Sourced from project configuration)
const INSTAMOJO_CLIENT_ID = "t3DvU9c4jXQB8ng5ro60jmw7fqvFdLdMk104ekFv";
const INSTAMOJO_CLIENT_SECRET = "WsmwStFWfaeb6MFmR9BsUGZY9IuMNUeC2xITVL1XqtQ0wK7JFE7yGcuBTc9F2utOAWV0cB5iSLvJtO2DjDwdvZvTBktUmP0fhdCRZzOk2GTFnhDyMlppT2Vgmr3kAoRx";
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
      1: { coins: 10, price: 10, name: "10 Coins" },
      2: { coins: 25, price: 20, name: "25 Coins" },
      3: { coins: 65, price: 50, name: "65 Coins" },
    };

    const pkg = coinPackages[packageId];
    if (!pkg) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid package ID.");
    }

    // 5. Create Payment Request
    const redirectUrl = "https://bi-chat.online/coins";
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
  let { paymentId, packageId } = data;

  // 2. Validate input
  if (!paymentId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Payment ID is required."
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
        return { 
          success: true, 
          message: "This payment was already verified. Your coins are already credited.",
          coinsAdded: existingDoc.coinsAmount || 0 
        };
      } else {
        throw new functions.https.HttpsError("permission-denied", "This payment ID belongs to another user.");
      }
    }

    // 5. Verify payment with Instamojo API
    console.log(`[VERIFY] Fetching details for ${paymentId} (User: ${userId})`);
    
    const response = await axios.get(
      `${INSTAMOJO_API_ENDPOINT}/payments/${paymentId}/`,
      {
        headers: { "Authorization": `Bearer ${accessToken}` },
      }
    );

    const payment = response.data;
    console.log(`[VERIFY] API Response for ${paymentId}:`, JSON.stringify(payment));
    
    // 6. Validate payment status
    if (payment.status !== "Credit") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Payment status is ${payment.status}. We can only credit coins for successful payments.`
      );
    }

    // 7. Map amount to Package if packageId is missing
    const coinPackages = {
      1: { id: 1, coins: 10, price: 10 },
      2: { id: 2, coins: 25, price: 20 },
      3: { id: 3, coins: 65, price: 50 },
    };

    const paidAmount = parseFloat(payment.amount);
    
    // If packageId is missing, try to find it by price
    if (!packageId) {
       console.log(`[VERIFY] packageId missing, searching by amount: ₹${paidAmount}`);
       const foundPkg = Object.values(coinPackages).find(p => p.price === Math.floor(paidAmount));
       if (foundPkg) {
           packageId = foundPkg.id;
           console.log(`[VERIFY] Inferred packageId: ${packageId}`);
       }
    }

    const pkg = coinPackages[packageId];
    if (!pkg) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Could not identify the coin package for amount ₹${paidAmount}. Please contact support.`
      );
    }

    if (paidAmount < pkg.price) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Paid amount (₹${paidAmount}) is less than package price (₹${pkg.price}).`
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

/**
 * Create Razorpay Order
 * Callable Function: Generates a Razorpay order ID
 */
exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { amount, packageId } = data;
  if (!amount || !packageId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing parameters.");
  }

  try {
    const options = {
      amount: Math.round(amount * 100), // Razorpay handles in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: context.auth.uid,
        packageId: packageId,
        coinsAmount: data.coinsAmount // Pass coinsAmount from frontend or lookup
      }
    };

    const order = await razorpay.orders.create(options);
    return { orderId: order.id, keyId: RAZORPAY_KEY_ID };
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    throw new functions.https.HttpsError("internal", "Failed to create order.");
  }
});

/**
 * Verify Razorpay Payment
 * Callable Function: Securely verifies signature and credits coins
 */
exports.verifyRazorpayPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    packageId,
    coinsAmount
  } = data;

  const userId = context.auth.uid;

  // 1. Verify Request
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new functions.https.HttpsError("permission-denied", "Invalid payment signature.");
  }

  try {
    // 2. Prevent Double Credit
    const existingPayment = await admin.firestore()
      .collection("verified_payments")
      .where("paymentId", "==", razorpay_payment_id)
      .limit(1)
      .get();

    if (!existingPayment.empty) {
      return { success: true, message: "Payment already processed." };
    }

    // 3. Update User Balance
    const userRef = admin.firestore().collection("users").doc(userId);
    
    await admin.firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");

      const currentCoins = userDoc.data().coins || 0;
      const newBalance = currentCoins + coinsAmount;

      transaction.update(userRef, {
        coins: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log transaction
      const transactionRef = userRef.collection("coinTransactions").doc();
      transaction.set(transactionRef, {
        type: 'credit',
        amount: coinsAmount,
        reason: `purchase_razorpay_${packageId}`,
        balanceBefore: currentCoins,
        balanceAfter: newBalance,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        provider: 'razorpay',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // 4. Log in verified_payments
    await admin.firestore().collection("verified_payments").add({
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      userId: userId,
      packageId: packageId,
      coinsAmount: coinsAmount,
      status: "success",
      provider: "razorpay",
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, coinsAdded: coinsAmount };
  } catch (error) {
    console.error("Razorpay verification error:", error);
    throw new functions.https.HttpsError("internal", "Verification failed.");
  }
});

/**
 * Razorpay Webhook Handler
 */
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!signature) {
    return res.status(400).send("No signature provided.");
  }

  // 1. Verify Signature
  // In Firebase Functions, req.rawBody is sometimes required for signature verification 
  // but if req.body is already parsed, we can stringify it.
  const shasum = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET);
  shasum.update(JSON.stringify(req.body));
  const expectedSignature = shasum.digest("hex");

  if (expectedSignature !== signature) {
    console.error("Invalid webhook signature.");
    return res.status(403).send("Forbidden.");
  }

  const event = req.body.event;
  console.log(`Received Razorpay event: ${event}`);

  // 2. Process Success Event
  if (event === "payment.captured" || event === "order.paid") {
    const payment = req.body.payload.payment.entity;
    const orderId = payment.order_id;
    const paymentId = payment.id;
    
    // Notes contain mapping info
    const userId = payment.notes.userId;
    const packageId = payment.notes.packageId;
    const coinsAmount = parseInt(payment.notes.coinsAmount || 0);

    if (!userId || !coinsAmount) {
      console.warn("Invalid webhook data (missing userId or coinsAmount).");
      return res.status(200).send("OK - Data missing");
    }

    try {
      // Check duplicate
      const existing = await admin.firestore()
        .collection("verified_payments")
        .where("paymentId", "==", paymentId)
        .limit(1)
        .get();

      if (!existing.empty) {
        return res.status(200).send("OK - Already processed");
      }

      // Record & Credit
      await admin.firestore().runTransaction(async (transaction) => {
        const userRef = admin.firestore().collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) return;

        const currentCoins = userDoc.data().coins || 0;
        const newBalance = currentCoins + coinsAmount;

        transaction.update(userRef, {
          coins: newBalance,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // History
        const transactionRef = userRef.collection("coinTransactions").doc();
        transaction.set(transactionRef, {
          type: "credit",
          amount: coinsAmount,
          reason: `purchase_razorpay_webhook_${packageId}`,
          balanceBefore: currentCoins,
          balanceAfter: newBalance,
          paymentId: paymentId,
          orderId: orderId,
          provider: "razorpay_webhook",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      // verified_payments record
      await admin.firestore().collection("verified_payments").add({
        paymentId: paymentId,
        orderId: orderId,
        userId: userId,
        packageId: packageId,
        coinsAmount: coinsAmount,
        status: "success",
        webhook: true,
        provider: "razorpay",
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Successfully credited ${coinsAmount} coins to ${userId} via webhook.`);
      return res.status(200).send("OK");
    } catch (err) {
      console.error("Error processing Razorpay webhook:", err);
      return res.status(500).send("Internal Server Error");
    }
  }

  return res.status(200).send("OK");
});

