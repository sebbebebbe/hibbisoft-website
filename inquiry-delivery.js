// Formspree verifies Turnstile tokens and delivers the email on its servers.
// This file contains only browser-side UI and public configuration.
window.inquiryDelivery = (() => {
  const config = window.HIBBISOFT_CONFIG || {};
  const formId = String(config.formspreeFormId || "").trim();
  const siteKey = String(config.turnstileSiteKey || "").trim();
  const enabled = /^[a-z0-9]{6,32}$/i.test(formId) && siteKey.length > 0;
  const panel = document.querySelector("#direct-delivery");
  const sendButton = document.querySelector("#send-inquiry");
  const retryButton = document.querySelector("#retry-verification");
  const status = document.querySelector("#delivery-status");
  const editButton = document.querySelector(".back-to-checkout");
  const smallScreen = window.matchMedia("(max-width: 360px)");
  let payload;
  let token = "";
  let widgetId;
  let loadingScript;
  let sending = false;
  let sent = false;

  function setStatus(message, error = false) {
    status.textContent = message;
    status.dataset.state = error ? "error" : "info";
  }

  function updateButton() {
    sendButton.disabled = !token || sending || sent;
    sendButton.textContent = sending ? "Sending inquiry…" : "Send inquiry ↗";
    sendButton.setAttribute("aria-busy", String(sending));
    editButton.disabled = sending;
    retryButton.disabled = sending;
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (loadingScript) return loadingScript;
    loadingScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = setTimeout(fail, 15000);
      function fail() {
        clearTimeout(timeout);
        script.remove();
        loadingScript = undefined;
        reject(new Error("Spam check unavailable"));
      }
      window.hibbisoftTurnstileReady = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=hibbisoftTurnstileReady";
      script.async = true;
      script.onerror = fail;
      document.head.append(script);
    });
    return loadingScript;
  }

  async function verify() {
    if (!enabled || sending || sent) return;
    token = "";
    retryButton.hidden = true;
    updateButton();
    setStatus("Checking for spam…");
    try {
      await loadTurnstile();
      if (widgetId !== undefined) {
        window.turnstile.reset(widgetId);
        return;
      }
      widgetId = window.turnstile.render("#turnstile-container", {
        sitekey: siteKey,
        theme: "light",
        size: smallScreen.matches ? "compact" : "flexible",
        action: "inquiry",
        "response-field": false,
        callback(value) {
          token = value;
          retryButton.hidden = true;
          if (!sending)
            setStatus("Spam check complete. Your inquiry is ready to send.");
          updateButton();
        },
        "expired-callback"() {
          token = "";
          updateButton();
          if (!sending) {
            setStatus("The spam check expired. Please verify again.");
            retryButton.hidden = false;
          }
        },
        "error-callback"() {
          token = "";
          updateButton();
          if (!sending) {
            setStatus(
              "The spam check couldn’t finish. Retry it, or copy your inquiry and connect on LinkedIn below.",
              true,
            );
            retryButton.hidden = false;
          }
        },
        "timeout-callback"() {
          token = "";
          updateButton();
          if (!sending) {
            setStatus("The spam check timed out. Please try it again.", true);
            retryButton.hidden = false;
          }
        },
      });
    } catch {
      setStatus(
        "The spam check couldn’t load. Retry it, or copy your inquiry and connect on LinkedIn below.",
        true,
      );
      retryButton.hidden = false;
    }
  }

  function reset() {
    payload = undefined;
    token = "";
    sent = false;
    document.querySelector("#inquiry-actions").hidden = false;
    document.querySelector("#new-inquiry").hidden = true;
    document.querySelector("#inquiry-title").textContent =
      "Your next project starts with hello.";
    document.querySelector("#inquiry-intro").textContent = enabled
      ? "Check your details below, then send your inquiry directly to me."
      : "Your inquiry is ready. Direct sending is unavailable; copy it into a LinkedIn message to start a conversation.";
    updateButton();
  }

  async function send() {
    if (!enabled || !payload || !token || sending || sent) return;
    const honeypot = document.querySelector("#company-website").value;
    if (honeypot) {
      setStatus(
        "Your inquiry couldn’t be sent. Please copy it and connect on LinkedIn below.",
        true,
      );
      return;
    }
    sending = true;
    retryButton.hidden = true;
    updateButton();
    setStatus("Sending your inquiry…");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const data = new FormData();
      for (const [key, value] of Object.entries(payload)) data.set(key, value);
      data.set("cf-turnstile-response", token);
      data.set("_gotcha", honeypot);
      const response = await fetch(`https://formspree.io/f/${formId}`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
        credentials: "omit",
        signal: controller.signal,
      });
      if (!response.ok) {
        setStatus(
          response.status === 429
            ? "Too many attempts. Please wait a few minutes, or copy your inquiry and connect on LinkedIn below."
            : "Your inquiry wasn’t accepted. Check your details and retry the spam check, or copy your inquiry and connect on LinkedIn below.",
          true,
        );
        return;
      }
      const result = await response.json();
      if (result.ok !== true) throw new Error("Submission not confirmed");
      sent = true;
      document.querySelector("#inquiry-actions").hidden = true;
      document.querySelector("#new-inquiry").hidden = false;
      document.querySelector("#brief-heading").textContent =
        "Inquiry submitted";
      document.querySelector("#inquiry-title").textContent =
        "Thanks for saying hello.";
      document.querySelector("#inquiry-intro").textContent =
        `Your inquiry has been submitted. I’ll reply to ${payload.email}.`;
      document.querySelector(".inquiry-disclaimer").textContent =
        "This starts a conversation. No time has been booked and no order has been placed.";
      if (document.querySelector(".brief-dialog").open) {
        document.querySelector("#brief-heading").focus();
        document.querySelector(".brief-dialog").scrollTop = 0;
      }
      window.turnstile.remove(widgetId);
      widgetId = undefined;
    } catch {
      setStatus(
        "We couldn’t confirm whether your inquiry was sent. Please wait before trying again, or copy your inquiry and connect on LinkedIn below.",
        true,
      );
    } finally {
      clearTimeout(timeout);
      sending = false;
      // Tokens are single-use. A retry must complete a new server-verified check.
      token = "";
      updateButton();
      if (!sent) retryButton.hidden = false;
    }
  }

  sendButton.addEventListener("click", send);
  retryButton.addEventListener("click", verify);
  smallScreen.addEventListener("change", () => {
    if (widgetId === undefined || sending || sent) return;
    window.turnstile.remove(widgetId);
    widgetId = undefined;
    verify();
  });
  if (enabled) {
    panel.hidden = false;
    document
      .querySelector("#linkedin-inquiry")
      .classList.add("inquiry-fallback");
    document.querySelector(".brief-privacy").textContent =
      "Your project details are shared only when you choose to send them. Cloudflare checks for spam when you review your inquiry.";
  }
  return {
    enabled,
    isSending: () => sending,
    wasSent: () => sent,
    reset,
    prepare(details) {
      reset();
      payload = Object.freeze({ ...details });
      if (enabled) {
        document.querySelector(".inquiry-disclaimer").textContent =
          "Sending an inquiry starts a conversation. It does not book time or place an order.";
        verify();
      }
    },
  };
})();
