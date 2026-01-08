const axios = require('axios');

exports.handler = async function (event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { packageId } = data;

    // --- CONFIGURATION (MOVE TO ENV VARS IN PRODUCTION) ---
    const INSTAMOJO_CLIENT_ID = "t3DvU9c4jXQB8ng5ro60jmw7fqvFdLdMk104ekFv";
    const INSTAMOJO_CLIENT_SECRET = "WsmwStFWfaeb6MFmR9BsUGZY9IuMNUeC2xITVL1XqtQ0wK7JFE7yGcuBTc9F2utOAWV0cB5iSLvJtO2DjDwdvZvTBktUmP0fhdCRZzOk2GTfnhDyMlppT2Vgmr3kAoRx";
    const INSTAMOJO_API_ENDPOINT = "https://api.instamojo.com/v2";
    const INSTAMOJO_OAUTH_ENDPOINT = "https://api.instamojo.com/oauth2/token/";
    // ------------------------------------------------------

    const coinPackages = {
      1: { coins: 10, price: 10, name: "10 Coins" },
      2: { coins: 25, price: 20, name: "25 Coins" },
      3: { coins: 65, price: 50, name: "65 Coins" },
    };

    const pkg = coinPackages[packageId];
    if (!pkg) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid Package ID" }) };
    }

    // 1. Get Access Token
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', INSTAMOJO_CLIENT_ID);
    params.append('client_secret', INSTAMOJO_CLIENT_SECRET);

    const tokenResponse = await axios.post(INSTAMOJO_OAUTH_ENDPOINT, params);
    const accessToken = tokenResponse.data.access_token;

    // 2. Create Payment Request
    const redirectUrl = "https://bi-chat.online/coins";
    
    const payload = new URLSearchParams();
    payload.append('amount', pkg.price);
    payload.append('purpose', `Purchase ${pkg.name}`);
    payload.append('redirect_url', redirectUrl);
    payload.append('allow_repeated_payments', 'False');

    const paymentResponse = await axios.post(
      `${INSTAMOJO_API_ENDPOINT}/payment_requests/`,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ paymentUrl: paymentResponse.data.longurl })
    };

  } catch (error) {
    console.error("Payment Error:", error.response ? error.response.data : error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create payment link", details: error.message })
    };
  }
};
