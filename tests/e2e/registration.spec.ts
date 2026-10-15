import { expect, test, type Page } from "@playwright/test";

async function checkIdentity(page: Page, nic: string) {
  await page.goto("/home");
  await page.getByRole("link", { name: /Register as an Athlete/ }).click();
  await page.getByLabel("NIC number").fill(nic);
  await expect(page.getByTestId("nic-decoded")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("there is no way to register as a coach", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("link", { name: /Coach/ })).toHaveCount(0);
  const res = await page.goto("/register/coach");
  expect(res?.status()).toBe(404);
});

test("a registered person's NIC (other format) lands on 'already registered'", async ({ page }) => {
  await checkIdentity(page, "781231234V"); // seeded coach 197812301234
  await expect(page.getByTestId("already-registered")).toBeVisible();
  await expect(page.getByText("S. P*****")).toBeVisible();
  await expect(page.getByText("Colombo")).toBeVisible();
});

test("athlete registers with a listed coach and a past coach", async ({ page }) => {
  await checkIdentity(page, "201015501234"); // 2010, male, under 18
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Tharindu Lakshan Wijesinghe");
  await page.getByLabel("Name with initials").fill("T. L. Wijesinghe");
  await page.getByLabel("District", { exact: true }).selectOption("Colombo");
  await expect(page.getByTestId("province")).toHaveText("Province: Western");
  await page.getByLabel("Mobile number (athlete or guardian)").fill("0712345678");
  await page.getByLabel("School or club").fill("Royal College");
  // three main events, one with a personal best
  await page.getByLabel("Event 1").selectOption("400m");
  await page.getByRole("button", { name: /Add personal best/ }).first().click();
  await page.getByLabel("Personal best").first().fill("49.80");
  await page.locator("#pbyear-0").fill("2025");
  await page.locator("#pbcomp-0").fill("Junior Nationals");
  await page.getByLabel("Event 2").selectOption("200m");
  await page.getByLabel("Event 3").selectOption("LJ");
  // personal-best fields are folded away until asked for; long jump is measured in metres
  await expect(page.locator("#pb-2")).toHaveCount(0);
  await page.getByTestId("event-row").nth(2).getByRole("button", { name: /Add personal best/ }).click();
  await expect(page.getByText("Metres, e.g. 6.45")).toBeVisible();
  // an additional event
  await page.getByRole("button", { name: "Add another event" }).click();
  await page.getByLabel("Event 4").selectOption("4x400m");

  // under 18, so the guardian section appears
  await expect(page.getByRole("heading", { name: "Parent or guardian" })).toBeVisible();
  await page.getByLabel("Guardian's full name").fill("Lakshman Wijesinghe");
  await page.getByLabel("Relationship to athlete").fill("Father");
  await page.getByLabel("Guardian's mobile number").fill("0779998887");

  // 1. Who coaches you now? The athlete lives in Colombo, so the Colombo coach is suggested
  //    before anything is typed.
  const finder = page.getByRole("combobox", { name: "Coach's name or SLAA ID" });
  await finder.first().click();
  await expect(page.getByText("Coaches in Colombo")).toBeVisible();
  await page.getByRole("option", { name: /S\. K\. Perera/ }).click();
  const main = page.getByTestId("coach-card").first();
  await expect(main).toContainText("Main coach");
  await main.getByLabel("Coaching me since").selectOption("2023");

  // 2. Did anyone coach you before? Yes: one registered coach found by search...
  await page.getByRole("radio", { name: "Yes" }).click();
  await finder.last().fill("fernando");
  await page.getByRole("option", { name: /D\. C\. Fernando/ }).click();
  const pastCard = page.getByTestId("coach-card").nth(1);
  await pastCard.getByLabel("From year").selectOption("2019");
  await pastCard.getByLabel("To year").selectOption("2022");

  // ...and one who is not registered: typing a name offers "Add as a new coach"
  await page.getByRole("button", { name: "Add another past coach" }).click();
  await finder.last().fill("Mr. Bandara");
  await page.getByRole("option", { name: /Add “Mr\. Bandara” as a new coach/ }).click();
  const newCard = page.locator('[data-testid="coach-card"][data-kind="new"]');
  await expect(newCard).toContainText("New: SLAA will contact them");
  await newCard.getByLabel("From year").selectOption("2017");

  for (const box of await page.getByRole("checkbox", { name: /agree/ }).all()) await box.check();
  await page.getByRole("button", { name: /Register and get my SLAA ID/ }).click();

  await expect(page.getByTestId("slaa-id")).toHaveText(/^A\d{2}-\d{6}-\d$/);
  await expect(page.getByText(/coaches you listed must confirm/)).toBeVisible();
  // after registering, the athlete sees why the SLAA ID matters
  await expect(page.getByRole("heading", { name: "What your SLAA ID gives you" })).toBeVisible();
  for (const title of ["Compete in official championships", "Make your results count", "Open doors to scholarships and support"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  // no horizontal scroll at phone width
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
