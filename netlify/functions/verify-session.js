// netlify/functions/verify-session.js
// Verifies a Stripe Checkout Session (paid or not) using Stripe REST API.
// Required env vars:
//   STRIPE_SECRET_KEY = sk_live_...

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing STRIPE_SECRET_KEY in environment variables." }) };
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing session_id" }) };
  }

  const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`;

  try{
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${secret}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: data.error?.message || "Stripe error", details: data }) };
    }

    const paid = data.payment_status === "paid";
    const rid = data.metadata?.rid || null;

    return {
      statusCode: 200,
      body: JSON.stringify({
        paid,
        session_id: data.id,
        payment_status: data.payment_status,
        amount_total: data.amount_total,
        currency: data.currency,
        customer_email: data.customer_details?.email || data.customer_email || null,
        rid
      })
    };
  }catch(err){
    return { statusCode: 500, body: JSON.stringify({ error: "Server error verifying session." }) };
  }
};
