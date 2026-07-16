import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("complete mocked scheduling flow through undo", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /flight lands ten minutes/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Talk it through" }).click();
  await page.getByRole("button", { name: "Show the evidence" }).click();
  await expect(page.getByText("Travel itinerary")).toBeVisible();
  await page.getByRole("button", { name: "What can I do?" }).click();
  await page.getByRole("button", { name: "Draft this" }).click();
  await expect(
    page.getByRole("heading", { name: /Move Project Review to 4:30 PM/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve mocked change" }).click();
  await expect(
    page.getByRole("heading", { name: /now at 4:30 PM/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View action history" }).click();
  await expect(page.getByText("verification succeeded")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByText("Undo was verified in the mock calendar."),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("all routes render and main routes pass accessibility smoke checks", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/history",
    "/connections",
    "/settings",
    "/design-lab/presence",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${route} accessibility violations`).toEqual([]);
  }
});

test("Presence Lab compares every variant, sequences states, and persists selection", async ({
  page,
}) => {
  await page.goto("/design-lab/presence");
  await page.getByRole("button", { name: "Trail", exact: true }).click();
  await page.getByRole("button", { name: "Speaking", exact: true }).click();
  await page.getByRole("button", { name: "Compare all" }).click();
  await expect(
    page
      .getByRole("region", { name: /all variants in speaking state/i })
      .locator("article"),
  ).toHaveCount(5);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Trail", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Replay sequence" }).click();
  await expect(page.getByRole("button", { name: "Playing…" })).toBeDisabled();
});

test("phone layout keeps the focal concern and input in view", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile project only");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /flight lands ten minutes/i }),
  ).toBeVisible();
  await expect(page.getByRole("form", { name: "Ask Orbit" })).toBeVisible();
  const bodyBox = await page.locator("body").boundingBox();
  expect(bodyBox?.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});
