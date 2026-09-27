# Activate direct inquiry delivery

The website can submit inquiries to Formspree from GitHub Pages. Formspree verifies Cloudflare Turnstile tokens on its servers and emails the inquiry to the destination configured in your Formspree account. No private keys or email credentials belong in the website.

**Current state:** direct sending is enabled in the site using the supplied Formspree form ID `mppwybbl` and Turnstile public site key in `site-config.js`. LinkedIn and copy options remain available. The recipient email address is not included in the public page or scripts. Formspree's recipient, email verification and CAPTCHA secret are managed in your account; these private settings and live email delivery have not been verified from this workspace. Deploy the updated files to activate this configuration on the hosted site.

## 1. Create the destination form

1. Create a form in [Formspree](https://formspree.io/) and set its recipient to your preferred inquiry mailbox.
2. Complete Formspree's email verification and enable its email notification workflow.
3. Copy the form ID from the endpoint `https://formspree.io/f/YOUR_FORM_ID`. The form ID is public; an account API token is not needed.

Check [Formspree's current plan limits](https://formspree.io/plans) for your intended usage. As of this implementation, the free plan lists 50 submissions per month and is described as intended for testing and development.

## 2. Require CAPTCHA verification on the server

1. In [Cloudflare Turnstile](https://dash.cloudflare.com/), create a widget in **Managed** mode.
2. Allow `hibbisoft.se`. Also allow `www.hibbisoft.se` only if the site actually runs there; add other hostnames only if they serve this form. The site does not need to move to Cloudflare hosting or use Cloudflare DNS.
3. Copy the **site key** for the website. Keep the **secret key** out of source files, GitHub Pages, and chat messages.
4. In the Formspree form's CAPTCHA settings, **enable CAPTCHA**, choose **Cloudflare Turnstile**, enter the secret key, and save.
5. If your Formspree plan offers domain restrictions, restrict submissions to your production site as an additional measure.

Both the widget and server setting are required: disabling the Send button in the browser alone cannot prevent spam. Follow the [official Formspree Turnstile instructions](https://help.formspree.io/articles/form-and-project-settings/protecting-your-forms-with-cloudflare-turnstile) for the current dashboard controls.

## 3. Set the two public values

Edit `site-config.js`:

```js
window.HIBBISOFT_CONFIG = {
  formspreeFormId: "YOUR_FORM_ID",
  turnstileSiteKey: "YOUR_PUBLIC_SITE_KEY",
};
```

Use the actual form ID, not the whole URL. The template values above are illustrative; the supplied public values are already set in the site. Clearing either value disables direct sending and leaves the LinkedIn/copy fallbacks available.

Deploy using the existing GitHub Pages workflow. It includes `site-config.js` and `inquiry-delivery.js` in the public site.

## Visitor experience

- Checkout collects the visitor's name, reply email, optional company, project description, desired timing and selected expertise.
- The final step previews the complete message. Turnstile loads only when this review step is opened, and it must complete before direct sending is enabled.
- **Send inquiry** submits the reviewed details and CAPTCHA token to Formspree. The `email` field supplies the notification's reply address; the destination stays in Formspree's server configuration.
- The form shows confirmation only after Formspree acknowledges acceptance. This is not a guarantee that the destination mailbox has delivered or read the message.
- Failed or uncertain submissions keep the details visible. Retrying requires a fresh CAPTCHA check. There is no automatic resubmission, and pending/successful sends cannot be accidentally submitted again through the UI.
- A honeypot supplements Turnstile. LinkedIn and copy fallbacks remain available when verification or sending is unavailable.
- Project details remain in browser memory until the visitor chooses to send. After direct submission, Formspree processes the inquiry under its account retention settings; Cloudflare processes the spam check. The review step links to both privacy policies. No form data is saved in local storage or analytics.

## Validate the live setup

Local automated tests mock Formspree and Turnstile. They cover verified success, blocked/expired CAPTCHA, rate-limit rejection, network uncertainty, fresh-token retries, duplicate prevention, reply email, accessibility and mobile layout without sending real emails.

Before considering production delivery verified, submit an inquiry you intentionally send from the deployed hostname, confirm it appears in the Formspree dashboard and arrives at the configured recipient mailbox, then confirm Reply addresses the visitor. Also check a submission with an absent or invalid CAPTCHA token is rejected by Formspree. Do not disable CAPTCHA to make a failing test pass.

For local CAPTCHA development, use a separate development widget or [Cloudflare's documented test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). Never deploy the always-pass test keys in production.

Reference: [Formspree reply-address handling](https://help.formspree.io/articles/building-your-form/email-reply-to-address), [subject fields](https://help.formspree.io/articles/building-your-form/email-subject-line), and [honeypot filtering](https://help.formspree.io/articles/building-your-form/honeypot-spam-filtering).
