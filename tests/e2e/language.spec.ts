import { expect, test } from "@playwright/test";

// Start as a first-time visitor: no language chosen yet.
test.use({ storageState: { cookies: [], origins: [] } });

test("the front page is the language choice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible();
  await expect(page.getByText("භාෂාව තෝරන්න")).toBeVisible();
  await expect(page.getByText("மொழியைத் தெரிவு செய்யவும்")).toBeVisible();

  await page.getByRole("button", { name: /සිංහල/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ඔබේ SLAA හැඳුනුම් අංකය ලබා ගන්න");
  await expect(page.locator("html")).toHaveAttribute("lang", "si");

  // the choice carries over, including decoded NIC details
  await page.getByRole("link", { name: /ක්‍රීඩකයෙකු ලෙස ලියාපදිංචි වන්න/ }).click();
  await expect(page.getByRole("heading", { name: "ඔබේ හැඳුනුම්පත පරීක්ෂා කරන්න" })).toBeVisible();
  await page.getByLabel("ජාතික හැඳුනුම්පත් අංකය").fill("853202937V");
  await expect(page.getByTestId("nic-decoded")).toContainText("1985 නොවැම්බර් 15");

  // change language from the header: back to the language screen, then to the same page
  await page.getByRole("link", { name: "භාෂාව වෙනස් කරන්න" }).click();
  await expect(page.getByRole("button", { name: /සිංහල/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /தமிழ்/ }).click();
  await expect(page).toHaveURL(/\/register\/check$/);
  await expect(page.getByRole("heading", { name: "உங்கள் அடையாள அட்டையைச் சரிபார்க்கவும்" })).toBeVisible();
  await page.getByLabel("தேசிய அடையாள அட்டை இலக்கம்").fill("854002937V");
  await page.getByRole("button", { name: "தொடரவும்" }).click();
  await expect(page.getByText("இந்த அடையாள அட்டை இலக்கம் செல்லுபடியற்றது (பிறந்த நாள் இலக்கங்கள் வரம்புக்கு வெளியே உள்ளன).").first())
    .toBeVisible();

  // remembered after a reload; no second trip to the language screen
  await page.reload();
  await expect(page).toHaveURL(/\/register\/check$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ta");
});

test("a deep link (e.g. from a QR code) also asks first, then continues there", async ({ page }) => {
  await page.goto("/register/check");
  await expect(page).toHaveURL(/localhost:\d+\/\?next=%2Fregister%2Fcheck$/);
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page).toHaveURL(/\/register\/check$/);
  await expect(page.getByRole("heading", { name: "Check your ID" })).toBeVisible();
});

test("the language screen will not redirect to another website", async ({ page }) => {
  for (const evil of ["//evil.example.com", "/\\evil.example.com", "https://evil.example.com"]) {
    await page.goto(`/?next=${encodeURIComponent(evil)}`);
    await page.getByRole("button", { name: /English/ }).click();
    await expect(page).toHaveURL(/localhost:\d+\/home$/);
  }
});

test("returning visitors still see the language choice on the front page", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/e2e/english.storage.json" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible();
  await expect(page.getByRole("button", { name: /English/ })).toHaveAttribute("aria-pressed", "true");
  // the old address still works
  await page.goto("/language");
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await ctx.close();
});
