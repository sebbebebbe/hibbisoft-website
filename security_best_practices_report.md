# Site security review

Reviewed: 27 September 2026. Scope: the local site and deployment artifact, browser JavaScript, the Node.js preview server, GitHub Pages workflow, dependency audit, and a read-only request to the live domain.

## Executive summary

No critical or high-severity vulnerability was confirmed in the reviewed code. Two medium-priority issues need attention: the live domain redirects to a different site over HTTP, and the development server exposes non-public project files without checking the request hostname. Two low-priority improvements concern Content Security Policy and immutable GitHub Actions versions.

The inquiry UI handled an HTML/script injection probe as text. All 26 existing tests passed, and `npm audit` reported zero known dependency vulnerabilities. These results do not verify Formspree's private configuration: server-side CAPTCHA enforcement must still be checked before launch.

This was a review. Application code and hosting/account configuration were not changed. Temporary local probes are in `tmp/`; this report is excluded from the existing GitHub Pages deployment allowlist.

## Medium-priority findings

### SEC-01 — The live domain redirects HTTPS visitors to an HTTP destination

- **Rule:** Transport and deployment configuration.
- **Severity:** Medium. Confirmed live configuration issue, separate from the local implementation.
- **Location:** Hosting/forwarding configuration for `hibbisoft.se`, not available in this workspace. The intended domain is recorded in [CNAME:1](C:/Projects/hibbisoft-web/CNAME:1) and [index.html:56](C:/Projects/hibbisoft-web/index.html:56).
- **Evidence:** An ordinary GET to `https://hibbisoft.se/`, without following redirects, returned the following on 27 September 2026 at 11:56 UTC:

  ```http
  HTTP/1.1 302 Moved Temporarily
  Location: http://www.mirrorsignage.io
  ```

  Headers are retained in [tmp/live-security-headers.txt:1](C:/Projects/hibbisoft-web/tmp/live-security-headers.txt:1). Both GET and HEAD showed this redirect.

- **Impact:** Visitors leave the intended consultancy domain. Browsers that follow the HTTP destination without upgrading it expose that request to network observation or modification. The current public URL does not serve the site reviewed here.
- **Fix:** Remove or replace the old forwarding rule when deploying this site, connect the domain to the intended GitHub Pages deployment, and enable HTTPS there. Any necessary redirect should target the intended HTTPS URL.
- **Mitigation:** Keep sharing the local preview for review until the domain is configured. If the old redirect must remain temporarily, use an HTTPS destination.
- **Limits:** This does not demonstrate compromise. The forwarding may be an intentional legacy setting. The destination was not followed or audited, and browser HTTPS upgrades/HSTS may mitigate the HTTP hop for some visitors. The GitHub Pages migration steps are already in [README.md:69](C:/Projects/hibbisoft-web/README.md:69).

### SEC-02 — Local preview serves development files and accepts arbitrary hostnames

- **Rules:** CWE-552, CWE-346.
- **Severity:** Medium, development environment only.
- **Location:** [scripts/serve.mjs:5](C:/Projects/hibbisoft-web/scripts/serve.mjs:5), [scripts/serve.mjs:31](C:/Projects/hibbisoft-web/scripts/serve.mjs:31), [scripts/serve.mjs:39](C:/Projects/hibbisoft-web/scripts/serve.mjs:39).
- **Evidence:** The document root is `process.cwd()`. The server checks whether a resolved path is inside that directory, then calls `readFile(file)`. It has no public-file allowlist or request `Host` validation. An isolated instance of the unchanged server returned:

  | Request                         | Host header              | Result                        |
  | ------------------------------- | ------------------------ | ----------------------------- |
  | `/.github/workflows/deploy.yml` | `localhost:4187`         | 200; workflow served          |
  | `/scripts/serve.mjs`            | `untrusted.invalid:4187` | 200; server source served     |
  | `/%2e%2e%5Cpackage.json`        | `localhost:4187`         | 403; tested traversal blocked |

- **Impact:** Anything later placed in the workspace, including development notes, logs or credentials, may be reachable through the preview server if its path is known. Accepting arbitrary hostnames also leaves a possible DNS-rebinding route from an attacker-controlled website to these files, depending on browser/network protections.
- **Fix:** Serve only the public asset set, using an explicit allowlist or a clean public directory. Reject unexpected `Host` values; allow only the intended localhost names/IPs and port. Keep the loopback binding, deny dotfiles/private directories, and verify resolved real paths remain inside the public directory so symlinks cannot bypass containment.
- **Mitigation:** Do not expose this server through a tunnel or LAN binding, avoid storing secrets under its document root, and stop it when not needed.
- **Limits:** The server currently binds to `127.0.0.1` at [scripts/serve.mjs:48](C:/Projects/hibbisoft-web/scripts/serve.mjs:48). No malicious browser-origin read or DNS-rebinding exploit was performed, and no secret was extracted. Same-origin restrictions and local-network access protections can prevent some attacks. GitHub Pages does not run this server; the workflow copies only selected files. The risk concerns the development preview, not arbitrary file access on the production host.

## Low-priority hardening

### SEC-03 — No Content Security Policy is defined for the new site

- **Rule:** JS-CSP-001.
- **Severity:** Low for this static site; defense in depth, not a demonstrated XSS vulnerability.
- **Location:** [index.html:1](C:/Projects/hibbisoft-web/index.html:1), [inquiry-delivery.js:51](C:/Projects/hibbisoft-web/inquiry-delivery.js:51), [scripts/serve.mjs:40](C:/Projects/hibbisoft-web/scripts/serve.mjs:40).
- **Evidence:** The HTML has no CSP meta element and the local response has no CSP header. The code loads same-origin scripts and the fixed Cloudflare Turnstile script. Inquiry content is currently rendered safely with `textContent`.
- **Impact:** If a future change introduces an injection flaw, the browser has no additional script-source restriction to limit it. This observation alone does not imply that the existing inputs execute code.
- **Fix:** Add a narrowly scoped CSP, preferably as a response header. For static hosting without header control, an early CSP meta element can provide script-source protection. Allow the site's own scripts, Cloudflare's challenge scripts/frames, and the Formspree connection. Consider `object-src 'none'` and `base-uri 'none'`. Hash any necessary inline blocks instead of broadly allowing inline scripts, and test JSON-LD, the noscript styles, and the real Turnstile flow.
- **Mitigation and limits:** Preserve the existing safe text rendering. A CSP cannot make an allowed third-party script harmless. Meta policies cannot enforce `frame-ancestors`; framing protection requires a real HTTP header. Production headers for the new site remain unverified because the live domain serves a redirect. See [MDN's CSP documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) and [Cloudflare's Turnstile CSP requirements](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

### SEC-04 — Deployment actions use movable version tags

- **Rule:** CI dependency immutability / supply-chain hardening.
- **Severity:** Low; no compromised dependency was identified.
- **Location:** [.github/workflows/deploy.yml:24](C:/Projects/hibbisoft-web/.github/workflows/deploy.yml:24), lines 25, 32 and 37. Token permissions are declared at line 8.
- **Evidence:** The workflow references `actions/checkout@v6`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4` and `actions/deploy-pages@v4`.
- **Impact:** A changed or compromised upstream tag could change code executed during deployment without a local workflow diff. These jobs have Pages deployment permissions.
- **Fix:** Pin reviewed action releases to full commit SHAs, retain readable version comments, and arrange reviewed updates such as Dependabot pull requests.
- **Mitigation and limits:** These are GitHub-maintained actions, the workflow does not run on pull requests, and `contents` is read-only. Tag usage is common, but a full SHA provides an immutable reference. [GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions) explains this tradeoff.

## Verification required before launch

### VERIFY-01 — Confirm server-side CAPTCHA enforcement in Formspree

**Status: unverified configuration, not a confirmed bypass.** The public form ID and site key are present in [site-config.js:3](C:/Projects/hibbisoft-web/site-config.js:3). The browser disables submission without a token and submits `cf-turnstile-response` at [inquiry-delivery.js:154](C:/Projects/hibbisoft-web/inquiry-delivery.js:154). Those controls cannot stop someone making a direct request to the public endpoint.

The actual protection depends on enabling Turnstile and configuring its secret in Formspree. This account state is explicitly unverified in [CONTACT_SETUP.md:5](C:/Projects/hibbisoft-web/CONTACT_SETUP.md:5); the automated tests substitute both services at [tests/inquiry-delivery.spec.js:33](C:/Projects/hibbisoft-web/tests/inquiry-delivery.spec.js:33).

Confirm CAPTCHA is enabled in Formspree, the secret is correct, and Cloudflare's allowed hostnames are limited to the real deployment domains. Then perform a controlled integration check to confirm that missing, invalid and reused tokens are rejected. A successful client-side widget alone is not proof. Keep secrets in Formspree, never in this repository. If enforcement is absent, spam could reach the mailbox and consume submission quota. See [Formspree's setup instructions](https://help.formspree.io/articles/form-and-project-settings/protecting-your-forms-with-cloudflare-turnstile) and [Cloudflare's server-side validation requirements](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

No production submissions were sent during this review, including invalid-token probes that might have delivered an unwanted message if protection were disabled.

## Controls verified and review limits

- **Input rendering:** HTML and script strings entered into the name, company and project fields remained literal text in the inquiry preview. No injected element was created and no probe script executed. See [app.js:171](C:/Projects/hibbisoft-web/app.js:171).
- **Network destinations:** Formspree's origin is fixed, the form ID is constrained to alphanumerics, and submission uses `credentials: "omit"`. There is no user-controlled script URL or redirect in the reviewed code.
- **Privacy:** No external network request occurred on initial load in the local check. The checked flow created no local/session storage entries. External links had `noopener noreferrer`. The portrait's metadata scan did not find a GPS-directory tag; this was not an exhaustive privacy review of the original CV or every binary asset.
- **Credentials:** A targeted scan of public source and relevant configuration found no private-key or common secret-token patterns. The Formspree form ID and Turnstile site key are intentionally public, not leaked secrets. No Git history was available to audit.
- **Assets:** Checked SVG assets contained no script elements, event attributes, foreign-object markup or external executable URL references.
- **Dependencies and checks:** `npm audit --json --ignore-scripts` reported zero known vulnerabilities; the package has no production npm dependencies. Syntax checks and all 26 Playwright tests passed. The Windows test runner needed its own preview child terminated to finish teardown; the tests then exited successfully.
- **Hosting:** The live response was checked using ordinary GET/HEAD requests without following its external redirect. No account access, DNS changes, deployment, stress testing or third-party security testing was performed.

Reproduction output: [tmp/security-review-results.json](C:/Projects/hibbisoft-web/tmp/security-review-results.json). Review helper: [tmp/security-review.mjs](C:/Projects/hibbisoft-web/tmp/security-review.mjs). These files are not deployment assets.

Recommended order: correct the live redirect when publishing, narrow access to the local preview, verify Formspree enforcement, then add CSP and immutable action references.
