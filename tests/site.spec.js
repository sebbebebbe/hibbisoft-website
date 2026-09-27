const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

// These tests cover the LinkedIn/copy fallback independently of production settings.
// Direct sending and CAPTCHA are exercised in inquiry-delivery.spec.js.
test.beforeEach(async ({ page }) => {
  await page.route("**/site-config.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'window.HIBBISOFT_CONFIG = { formspreeFormId: "", turnstileSiteKey: "" };',
    }),
  );
  await page.route("https://formspree.io/**", (route) => route.abort());
});

test("expertise filters and cart stay in sync", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Commerce", exact: true }).click();
  await expect(page.locator(".product-card:visible")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Add Ecommerce & integrations to your cart",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "All expertise 3" }).click();
  await expect(page.locator(".product-card:visible")).toHaveCount(3);
  await page.getByRole("button", { name: "Open your cart" }).click();
  await expect(page.locator("#brief-items li")).toHaveCount(1);
  await page.locator("#brief-items button").click();
  await expect(page.locator("#brief-empty")).toBeVisible();
  await expect(page.locator("#checkout-button")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open your cart" }),
  ).toBeFocused();
  await expect(page.locator(".bag-count")).toHaveText("0");
});

test("checkout validates details and produces an accurate inquiry to copy", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Add to team" }).click();
  await expect(page.locator("#brief-items li")).toHaveCount(3);
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await page.getByRole("button", { name: "Prepare my inquiry" }).click();
  await expect(page.locator("#client-name")).toBeFocused();
  await page.getByLabel("Your name").fill("Alex & Sam");
  await page.getByLabel("Your email").fill("alex@example.com");
  await page
    .getByRole("textbox", { name: "Company (optional)", exact: true })
    .fill("Shop + Co");
  await page
    .getByLabel("What are we building?")
    .fill("A React storefront & .NET API.\nPayments: Klarna + Kustom.");
  await page
    .getByLabel("When would you like to start?")
    .selectOption("Within 1–3 months");
  await page.getByRole("button", { name: "Prepare my inquiry" }).click();
  await expect(page.locator("#linkedin-inquiry")).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/sebastian-johansson/",
  );
  const body = await page.locator("#inquiry-preview").textContent();
  expect(body).toContain("Alex & Sam from Shop + Co");
  expect(body).toContain(
    "Backend & architecture, Frontend & product development, Ecommerce & integrations",
  );
  expect(body).toContain(
    "A React storefront & .NET API.\nPayments: Klarna + Kustom.",
  );
  expect(body).toContain("Within 1–3 months");
  await page.getByRole("button", { name: "Copy inquiry instead" }).click();
  await expect(page.locator("#copy-feedback")).toContainText("Copied!");
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).replace(
      /\r\n/g,
      "\n",
    ),
  ).toBe(body);
  await page.getByRole("button", { name: "Edit your details" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Alex & Sam");
});

test("Say hello opens checkout without a selected product and handles blocked clipboard", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Say hello" }).click();
  await expect(page.locator("#checkout-step")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Say hello" })).toBeFocused();
  await page.getByRole("button", { name: "Say hello" }).click();
  await page.getByLabel("Your name").fill("   ");
  await page.getByLabel("Your email").fill("test@example.com");
  await page.getByLabel("What are we building?").fill("Test project");
  await page.getByRole("button", { name: "Prepare my inquiry" }).click();
  await expect(page.locator("#inquiry-step")).toBeHidden();
  await page.getByLabel("Your name").fill("Test Person");
  await page.getByRole("button", { name: "Prepare my inquiry" }).click();
  await expect(page.locator("#inquiry-preview")).toContainText(
    "Let’s work out what fits",
  );
  await page.getByRole("button", { name: "Copy inquiry instead" }).click();
  await expect(page.locator("#copy-feedback")).toContainText(
    "copy it manually",
  );
  expect(await page.evaluate(() => window.getSelection().toString())).toContain(
    "Test project",
  );
});

test("CV and assets load, no page errors, no overflow at common screen widths", async ({
  page,
  request,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  expect(await page.content()).not.toContain("website@hibbisoft.se");
  await page.evaluate(() => document.fonts.ready);
  expect(
    (await request.get("/Sebastian%20Johansson%20-%20CV.pdf")).status(),
  ).toBe(200);
  for (const width of [320, 390, 600, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Overflow at ${width}px`,
    ).toBe(true);
  }
  await page.setViewportSize(testInfo.project.use.viewport);
  await page.screenshot({
    path: `tmp/${testInfo.project.name}-full.png`,
    fullPage: true,
  });
  await page.screenshot({ path: `tmp/${testInfo.project.name}-hero.png` });
  expect(errors).toEqual([]);
});

test("page and all checkout steps pass automated accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  const audit = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  };
  await audit();
  await page.getByRole("button", { name: "Add to team" }).click();
  await audit();
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await audit();
  await page.getByLabel("Your name").fill("Test Person");
  await page.getByLabel("What are we building?").fill("An accessible shop");
  await page.getByLabel("Your email").fill("test@example.com");
  await page.getByRole("button", { name: "Prepare my inquiry" }).click();
  await audit();
});

test("content and contact remain usable without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await expect(
    page.getByRole("heading", { name: "Good software. One human." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A solid foundation." }),
  ).toBeVisible();
  await expect(page.locator("#start-inquiry")).toBeHidden();
  await expect(page.locator(".contact-link")).toBeVisible();
  await expect(page.locator(".contact-link")).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/sebastian-johansson/",
  );
  await page.locator("#project-mirror summary").click();
  await expect(
    page.getByText("A digital signage solution that started"),
  ).toBeVisible();
  await context.close();
});
