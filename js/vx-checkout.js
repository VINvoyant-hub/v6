(function () {
  const toast = (msg) => {
    // If your vx-access.js already defines a toast UI, you can replace this later.
    // Keeping it simple + reliable for now.
    alert(msg);
  };

  async function startCheckout(tier) {
    try {
      const res = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          siteUrl: window.location.origin, // fallback if SITE_URL missing (still set it!)
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast(data.error || "Checkout failed.");
        return;
      }

      if (!data.url) {
        toast("Stripe session created but missing redirect URL.");
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      toast("Network error starting checkout.");
    }
  }

  // Wire any element with data-vx-checkout="CORE|ORACLE|CONCIERGE"
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-vx-checkout]");
    if (!btn) return;
    const tier = String(btn.getAttribute("data-vx-checkout") || "").toUpperCase();
    startCheckout(tier);
  });
})();