const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

// All remote submission and CAPTCHA traffic is intercepted. No real mail is sent.
const captchaScript = `
  let sequence = 0;
  let options;
  const container = () => document.querySelector('#turnstile-container');
  function showCheck() {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Complete test spam check';
    button.onclick = () => {
      options.callback('test-token-' + (++sequence));
      button.textContent = 'Spam check passed';
      button.disabled = true;
    };
    container().replaceChildren(button);
  }
  window.turnstile = {
    render: (selector, config) => {
      options = config;
      window.testCaptcha = config;
      showCheck();
      return 'test-widget';
    },
    reset: () => showCheck(),
    remove: () => container().replaceChildren()
  };
  window.hibbisoftTurnstileReady();
`;

async function setup(page, { captchaFails = false, configured = true } = {}) {
  await page.route("https://formspree.io/**", (route) => route.abort());
  await page.route("**/site-config.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.HIBBISOFT_CONFIG = ${JSON.stringify(
        configured
          ? {
              formspreeFormId: "testform",
              turnstileSiteKey: "test-public-site-key",
            }
          : { formspreeFormId: "testform", turnstileSiteKey: "" },
      )};`,
    }),
  );
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    captchaFails
      ? route.abort()
      : route.fulfill({ contentType: "text/javascript", body: captchaScript }),
  );
  await page.goto("/");
}

async function prepare(page) {
  await page.getByRole("button", { name: "Add to team" }).click();
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await page.getByLabel("Your name").fill("Alex & Sam");
  await page
    .getByRole("textbox", { name: "Company (optional)", exact: true })
    .fill("Shop + Co");
  await page.getByLabel("Your email").fill("alex@example.com");
  await page
    .getByLabel("What are we building?")
    .fill("React & .NET\nA checkout with Klarna.");
  await page.getByRole("button", { name: "Prepare my inquiry" }).click();
}

test("sends only after verification and confirmation, preserves the reply address, prevents duplicate sends", async ({
  page,
}) => {
  await setup(page);
  const posts = [];
  let release;
  const responseReady = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("https://formspree.io/f/testform", async (route) => {
    posts.push(route.request().postData());
    await responseReady;
    await route.fulfill({
      contentType: "application/json",
      body: '{"ok":true}',
    });
  });
  await prepare(page);
  expect(posts).toHaveLength(0);
  await expect(page.locator("#send-inquiry")).toBeDisabled();
  await page.getByRole("button", { name: "Complete test spam check" }).click();
  expect(posts).toHaveLength(0);
  await page.locator("#send-inquiry").click();
  await expect(page.locator("#send-inquiry")).toHaveText("Sending inquiry…");
  await expect(page.locator("#send-inquiry")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Edit your details" }),
  ).toBeDisabled();
  await page.locator("#send-inquiry").dispatchEvent("click");
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toContain('name="email"\r\n\r\nalex@example.com');
  expect(posts[0]).toContain("Shop + Co");
  expect(posts[0]).toContain("Backend & architecture");
  expect(posts[0]).toContain("A checkout with Klarna.");
  expect(posts[0]).toContain("test-token-1");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open your cart" }).click();
  await expect(page.locator("#send-inquiry")).toHaveText("Sending inquiry…");
  release();
  await expect(page.locator("#brief-heading")).toHaveText("Inquiry submitted");
  await expect(page.locator("#inquiry-intro")).toContainText(
    "alex@example.com",
  );
  await expect(page.locator("#send-inquiry")).toBeHidden();
  await expect(page.locator("#brief-heading")).toBeFocused();
  await page.getByRole("button", { name: "Start another inquiry" }).click();
  await expect(page.getByLabel("Your email")).toBeEmpty();
  await expect(page.locator(".bag-count")).toHaveText("0");
  expect(posts).toHaveLength(1);
});

test("rejected submissions retain details and require fresh verification for retry", async ({
  page,
}) => {
  await setup(page);
  const posts = [];
  await page.route("https://formspree.io/f/testform", (route) => {
    posts.push(route.request().postData());
    return route.fulfill({
      status: posts.length === 1 ? 429 : 200,
      contentType: "application/json",
      body: posts.length === 1 ? '{"errors":[]}' : '{"ok":true}',
    });
  });
  await prepare(page);
  await page.getByRole("button", { name: "Complete test spam check" }).click();
  await page.locator("#send-inquiry").click();
  await expect(page.locator("#delivery-status")).toContainText(
    "Too many attempts",
  );
  await expect(page.locator("#inquiry-preview")).toContainText(
    "A checkout with Klarna.",
  );
  await expect(page.locator("#send-inquiry")).toBeDisabled();
  await page.getByRole("button", { name: "Retry spam check" }).click();
  await page.getByRole("button", { name: "Complete test spam check" }).click();
  await page.locator("#send-inquiry").click();
  await expect(page.locator("#brief-heading")).toHaveText("Inquiry submitted");
  expect(posts).toHaveLength(2);
  expect(posts[1]).toContain("test-token-2");
});

test("expired verification and honeypot both prevent a submission", async ({
  page,
}) => {
  await setup(page);
  let attempts = 0;
  page.on("request", (request) => {
    if (request.url().startsWith("https://formspree.io/f/")) attempts++;
  });
  await prepare(page);
  await page.getByRole("button", { name: "Complete test spam check" }).click();
  await page.evaluate(() => window.testCaptcha["expired-callback"]());
  await expect(page.locator("#send-inquiry")).toBeDisabled();
  await page.getByRole("button", { name: "Retry spam check" }).click();
  await page.getByRole("button", { name: "Complete test spam check" }).click();
  await page.locator("#company-website").evaluate((input) => {
    input.value = "spam";
  });
  await page.locator("#send-inquiry").click();
  await expect(page.locator("#delivery-status")).toContainText(
    "couldn’t be sent",
  );
  expect(attempts).toBe(0);
});

test("blocked CAPTCHA and incomplete setup retain LinkedIn and copy fallbacks", async ({
  page,
}) => {
  await setup(page, { captchaFails: true });
  await prepare(page);
  await expect(page.locator("#delivery-status")).toContainText("couldn’t load");
  await expect(page.locator("#send-inquiry")).toBeDisabled();
  await expect(page.locator("#linkedin-inquiry")).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/sebastian-johansson/",
  );
  await expect(page.locator("#copy-brief")).toBeVisible();
  await setup(page, { configured: false });
  await prepare(page);
  await expect(page.locator("#direct-delivery")).toBeHidden();
  await expect(page.locator("#linkedin-inquiry")).toBeVisible();
  await expect(page.locator("#inquiry-intro")).toContainText(
    "Direct sending is unavailable",
  );
});

test("uncertain network results never show success and preserve the inquiry", async ({
  page,
}) => {
  await setup(page);
  await page.route("https://formspree.io/f/testform", (route) => route.abort());
  await prepare(page);
  await page.getByRole("button", { name: "Complete test spam check" }).click();
  await page.locator("#send-inquiry").click();
  await expect(page.locator("#delivery-status")).toContainText(
    "couldn’t confirm whether",
  );
  await expect(page.locator("#new-inquiry")).toBeHidden();
  await expect(page.locator("#inquiry-preview")).toContainText(
    "A checkout with Klarna.",
  );
});

test("direct inquiry review and confirmation are accessible and fit small screens", async ({
  page,
}) => {
  await setup(page);
  await page.route("https://formspree.io/f/testform", (route) =>
    route.fulfill({ contentType: "application/json", body: '{"ok":true}' }),
  );
  await prepare(page);
  await page.getByRole("button", { name: "Complete test spam check" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => window.testCaptcha.size))
    .toBe("compact");
  await expect(page.locator("#send-inquiry")).toBeDisabled();
  await page.getByRole("button", { name: "Complete test spam check" }).click();
  expect(
    await page
      .locator(".brief-dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.locator("#send-inquiry").click();
  await expect(page.locator("#brief-heading")).toHaveText("Inquiry submitted");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
