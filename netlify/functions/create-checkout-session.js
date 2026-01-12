// netlify/functions/create-checkout-session.js

const Stripe = require("stripe");

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return json(500, { error: "Missing STRIPE_SECRET_KEY env var" });

    const stripe = new Stripe(secret, { apiVersion: "2025-11-17.clover" });

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    // You’ll send tier like: "CORE" | "ORACLE" | "CONCIERGE"
    const tier = String(payload.tier || "").toUpperCase().trim();

    // Map tier -> Stripe Price ID (set these in Netlify env vars)
    const priceMap = {
      CORE: process.env.STRIPE_PRICE_CORE,
      ORACLE: process.env.STRIPE_PRICE_ORACLE,
      CONCIERGE: process.env.STRIPE_PRICE_CONCIERGE,
    };

    const price = priceMap[tier];
    if (!price) {
      return json(400, {
        error:
          "Unknown tier or missing STRIPE_PRICE_* env var. Expected CORE, ORACLE, or CONCIERGE.",
      });
    }

    const siteUrl =
      (process.env.SITE_URL || payload.siteUrl || "").replace(/\/$/, "") ||
      null;

    if (!siteUrl) {
      return json(500, {
        error:
          "Missing SITE_URL. Set SITE_URL in Netlify env vars (e.g. https://vinvoyant.com).",
      });
    }

    // Optional: attach any metadata you want to see in Stripe
    const vin = payload.vin ? String(payload.vin).trim() : "";
    const email = payload.email ? String(payload.email).trim() : "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      // If you want to collect email at checkout, Stripe can do it automatically
      customer_email: email || undefined,

      // This is the magic: Stripe returns with the session_id
      success_url: `${siteUrl}/sections/tiers.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/sections/tiers.html?canceled=1`,

      // Metadata shows up in Stripe dashboard
      metadata: {
        tier,
        vin: vin || "",
        source: "vinvoyant-site",
      },
    });

    return json(200, { url: session.url, id: session.id });
  } catch (err) {
    return json(500, {
      error: "Failed to create checkout session",
      detail: err?.message || String(err),
    });
  }
};