# Sebastian Johansson — the one-person software shop

A responsive, one-page consultancy CV with a playful ecommerce storefront. Built with plain HTML, CSS and JavaScript, hosted as static files on GitHub Pages without a build step. Fonts and artwork are local. Google Analytics loads on initial page load using measurement ID `G-JT6ZPNE18S` to track site traffic. Optional direct inquiry delivery uses Formspree and loads Cloudflare Turnstile when the visitor reviews an inquiry.

## Preview

With Node.js installed:

```sh
npm start
```

Open http://localhost:4173. You can also open `index.html` directly; the local server provides the most accurate preview, including clipboard support.

The preview server reads files directly from disk and disables HTTP caching. Refresh the page after saving a change; no compilation is needed. Restart `npm start` after changing the server script itself. The version in the HTML stylesheet URL also refreshes previously cached CSS.

## The shopping experience

- Browse and filter three expertise products, or use **Add to team** to add the complete selection.
- Add or remove expertise in the cart. There is always one developer; the selections describe the project scope.
- Checkout collects a name, reply email, optional company, project description and preferred timing.
- The final step shows the complete inquiry. Once configured, **Send inquiry** submits it directly through Formspree after a Turnstile spam check. Formspree handles server-side verification and email delivery.
- **Say hello** opens the inquiry form directly. The recipient email address is managed in Formspree and is not included in the public page or scripts.
- **Connect on LinkedIn** and a copy button remain available as fallbacks, including while direct delivery is not configured. Copying supports manual selection when clipboard access is denied.
- Nothing is sent automatically, booked or charged. Cart and form state are held in memory for the current page session. Reloading clears them. When the visitor chooses direct sending, Formspree receives and processes the inquiry.

Direct delivery is enabled with the supplied public Formspree form ID and Turnstile site key in `site-config.js`. See [CONTACT_SETUP.md](CONTACT_SETUP.md) for the destination form and required server-side CAPTCHA settings. No secret keys go into the website. Live delivery still needs verification on the deployed site.

## Content and design

- `index.html`: biography, project history, education, services, contact details and metadata.
- `styles.css`: responsive editorial layout, photographic collage, image hover effects, scroll animations and reduced-motion support.
- `app.js`: filtering, cart, checkout, clipboard, focus handling and scroll reveals.
- `inquiry-delivery.js`: Turnstile loading, direct submission, success/failure states and retry handling. `site-config.js` holds the public Formspree form ID and Turnstile site key.
- `assets/fonts/`: self-hosted DM Sans and Instrument Serif fonts, with their OFL licenses. Manrope is retained from the earlier design but is no longer loaded.
- `assets/images/sebastian-johansson.jpg`: supplied portrait, displayed above the fold beside the intro and in the maker card, with responsive CSS crops.
- `assets/images/hibbisoft-logo.png`: supplied company logo, used beside Sebastian’s name in the header and footer and as the browser icon.
- `assets/images/*-640.webp` and `*-1200.webp`: responsive, compressed versions of the supplied workspace and product-planning photos. The intro uses `intro-development` and `intro-planning`, alongside the unchanged supplied screenshot `intro-ecommerce.png`. Photo credits are in `assets/images/SOURCES.md`.
- `assets/logos/`: company logos from official websites, served locally. Source URLs are recorded in `assets/logos/SOURCES.md`. The featured projects and expandable project archive use CV-based descriptions of Sebastian’s work.
- `assets/icons/`: eight project illustrations used alongside company names for the older and personal projects.
- The education section includes Jönköping University’s official logo, degree details and a certification icon. `assets/flags/` supplies local SVG flags beside all four language names, with source and license information included.
- `Sebastian Johansson - CV.pdf`: supplied CV, linked for download. Replace it under the same filename to update the download.

Content is based on the supplied CV and the confirmed technologies and target clients. Kjell & Company is marked current. The Mirror collaboration ended on 16 October 2026, as confirmed; its website link has been removed. Availability uses “Let’s discuss”; no availability date or rate is assumed. English is used for this version.

The photographic design takes inspiration from Stills’ spacious layouts, large serif headlines and overlapping imagery. The provided photos appear in the opening collage and skill cards as illustrations of development and product thinking. A supplied storefront screenshot adds ecommerce context to the intro, without attributing it to a specific client project. The green Hibbisoft logo and small green accents connect the quieter black-and-white palette to the company identity.

All 20 projects from the CV and Riksdagsspelet are individually represented: two featured projects and 19 expandable archive entries. Kjell & Company and Riksdagsspelet are featured; Mirror is the first archive entry. Telia’s two assignments, Laerdal’s two applications, the GS1 systems and the early-career projects each have their own dates, descriptions, technology tags and logo or icon.

## Search and AI discovery

- The page has a descriptive title, summary, canonical URL, author metadata and large-image preview permission. Open Graph and Twitter cards use the local 1200 × 630 `assets/images/social-preview.png`.
- Static JSON-LD identifies Sebastian as a `Person`, Hibbisoft as an `Organization`, the `WebSite`/`WebPage`, and the three `Service` offerings. LinkedIn and GitHub identify the same person. The playful cart is not marked up as a real retail product or paid offer.
- The full CV content is available in HTML without JavaScript. `robots.txt` permits crawling and points to the one-page canonical sitemap. Stable service and project anchors make individual experience entries linkable.
- `llms.txt` provides a concise guide to the site and links to `index.md`, a Markdown profile with all 21 projects, education, languages and contact options. HTML discovery links advertise both files. GitHub Pages publishes them as static assets.
- When changing experience, skills or services, keep visible content, JSON-LD, `index.md` and `llms.txt` consistent. Update the sharing image when the brand or headline changes. Do not include the recipient email address in these files.

`llms.txt` follows the [llms.txt proposal](https://llmstxt.org/); it is supplementary context, not a ranking signal or a guarantee of AI citations. [Google's guidance for AI search features](https://developers.google.com/search/docs/appearance/ai-features) emphasizes standard SEO, crawlable useful text, and structured data that matches visible content; no special AI file is required.

After deployment, verify domain ownership in [Google Search Console](https://search.google.com/search-console/), submit `https://hibbisoft.se/sitemap.xml`, and inspect the canonical homepage. Check the live page with [Rich Results Test](https://search.google.com/test/rich-results), [Schema.org Validator](https://validator.schema.org/) and [PageSpeed Insights](https://pagespeed.web.dev/). These account and live-host checks are not performed by the local tests. Use the existing domain instructions below to keep `hibbisoft.se` as the canonical HTTPS destination.

## GitHub Pages

The included `.github/workflows/deploy.yml` deploys on pushes to `main` or `master`, or through **Run workflow**. It uploads only the public site files, assets and downloadable CV; tooling and test output are excluded.

1. Push this project to your GitHub repository, including the PDF and font assets.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. Run the **Deploy to GitHub Pages** workflow or push to the default branch.
4. In **Settings → Pages → Custom domain**, set `hibbisoft.se`. The included `CNAME` also supports branch-based publishing, but GitHub ignores it for Actions deployments; set the domain in repository settings.
5. At your DNS provider, point `hibbisoft.se` to GitHub Pages using the records in [GitHub’s custom domain guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). Set the domain in GitHub before changing DNS, and retain your email DNS records.
6. Enable **Enforce HTTPS** when the certificate is ready.
7. Configure an HTTPS redirect for `hibbisoft.com` and its `www` hostname to `https://hibbisoft.se` through your domain/redirect provider. Pointing a second unrelated domain at the same GitHub Pages site is not a redirect setup.

The canonical URL, sitemap, and `CNAME` use `https://hibbisoft.se`. All local asset links are relative, so previews also work under a GitHub project repository path.

No repository, DNS, or live hosting settings have been changed by creating these files. See [GitHub’s workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for the deployment mechanism.

## Development checks

```sh
npm ci
npm run check
npm test
```

Tests use the installed Chrome at its standard Windows location when available. On other systems, run `npx playwright install chromium` once. Playwright checks desktop and mobile cart/checkout behavior, email encoding, clipboard success/failure, keyboard focus, validation, horizontal overflow from 320–1440px, PDF access, JavaScript-free content and automated WCAG accessibility. Tests never send email.

```sh
npm run format
```

Automated accessibility checks supplement visual and keyboard checks; they do not establish full accessibility conformance.
