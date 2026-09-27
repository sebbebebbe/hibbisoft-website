const { test, expect } = require("@playwright/test");

test("search metadata and AI discovery files describe the same public profile", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const canonical = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  expect(canonical).toBe("https://hibbisoft.se/");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    canonical,
  );
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
    "content",
    /noindex|nosnippet/,
  );
  const graph = JSON.parse(
    await page.locator('script[type="application/ld+json"]').textContent(),
  )["@graph"];
  const person = graph.find((node) => node["@type"] === "Person");
  expect(person.name).toBe("Sebastian Johansson");
  expect(person.sameAs).toContain(
    "https://www.linkedin.com/in/sebastian-johansson/",
  );
  const ids = new Set(graph.map((node) => node["@id"]));
  const references = [
    ...JSON.stringify(graph).matchAll(/"@id":"([^"]+)"/g),
  ].map((match) => match[1]);
  for (const reference of references) expect(ids.has(reference)).toBe(true);
  for (const service of graph.filter((node) => node["@type"] === "Service")) {
    const article = page.locator(new URL(service.url).hash);
    await expect(article).toHaveCount(1);
    await expect(article.locator(".add-button")).toHaveAttribute(
      "data-service",
      service.name,
    );
  }
  const [guide, profile, robots, sitemap] = await Promise.all(
    ["/llms.txt", "/index.md", "/robots.txt", "/sitemap.xml"].map(
      async (path) => {
        const response = await request.get(path);
        expect(response.status(), path).toBe(200);
        return response.text();
      },
    ),
  );
  expect(guide).toMatch(/^# Sebastian Johansson/);
  expect(guide).toContain("https://hibbisoft.se/index.md");
  expect(robots).toMatch(/User-agent: \*\s+Allow: \//);
  expect(sitemap).toContain(`<loc>${canonical}</loc>`);
  const projectIds = await page
    .locator(".featured-project, .experience-list > details")
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  for (const id of projectIds)
    expect(profile).toContain(`https://hibbisoft.se/#${id}`);
  for (const content of [await page.content(), guide, profile]) {
    expect(content).not.toContain("website@hibbisoft.se");
    expect(content).not.toContain("mirrorsignage.io");
  }
  // Local discovery links must resolve, including each fragment in the text profile.
  for (const match of (guide + profile).matchAll(
    /\]\((https:\/\/hibbisoft\.se\/[^)]*)\)/g,
  )) {
    const url = new URL(match[1]);
    if (url.hash) await expect(page.locator(url.hash)).toHaveCount(1);
  }
  await expect(page.locator('link[rel="describedby"]')).toHaveAttribute(
    "href",
    "./llms.txt",
  );
  await expect(
    page.locator('link[rel="alternate"][type="text/markdown"]'),
  ).toHaveAttribute("href", "./index.md");
  const imageUrl = new URL(
    await page.locator('meta[property="og:image"]').getAttribute("content"),
  );
  const image = await request.get(imageUrl.pathname);
  expect(image.status()).toBe(200);
  const png = await image.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
  await expect(page.locator(".about-links .social-link img")).toHaveAttribute(
    "src",
    "./assets/logos/linkedin.svg",
  );
});
