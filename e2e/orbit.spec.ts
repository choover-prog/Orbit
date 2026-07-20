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

test("weather fixture stays read-only and explains its evidence", async ({
  page,
}) => {
  await page.goto("/?context=weather&state=action");
  await expect(
    page.getByRole("heading", { name: /precipitation is likely/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve mocked change" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Talk it through" }).click();
  await page.getByRole("button", { name: "Show the evidence" }).click();
  await expect(page.getByText("Fictional weather fixture")).toBeVisible();
  await expect(page.getByText(/This context is read-only/i)).toBeVisible();

  await page.getByRole("textbox", { name: "Ask Orbit" }).fill("Move it");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /precipitation is likely/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve mocked change" }),
  ).toHaveCount(0);
});

test("all routes render and main routes pass accessibility smoke checks", async ({
  page,
}) => {
  test.setTimeout(60_000);

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
  await page.getByRole("button", { name: "Orbit Trail", exact: true }).click();
  await page.getByRole("button", { name: "Speaking", exact: true }).click();
  await page.getByRole("button", { name: "Compare all" }).click();
  await expect(
    page
      .getByRole("region", { name: "Compare personality" })
      .locator("article"),
  ).toHaveCount(9);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Orbit Trail", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Replay sequence" }).click();
  await expect(page.getByRole("button", { name: "Playing..." })).toBeDisabled();
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

test("local request boundary rejects DNS-rebinding hosts before rendering", async ({
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "single request-boundary lane",
  );

  for (const path of ["/", "/connections", "/api/orbit/snapshot"]) {
    const response = await request.get(path, {
      failOnStatusCode: false,
      headers: {
        host: "attacker.example:3100",
        origin: "http://attacker.example:3100",
      },
    });
    expect(response.status(), `${path} rebinding status`).toBe(403);
    expect(await response.text()).not.toContain("Project Review");
  }

  const rscResponse = await request.get("/", {
    failOnStatusCode: false,
    headers: { host: "attacker.example:3100", rsc: "1" },
  });
  expect(rscResponse.status()).toBe(403);

  const localResponse = await request.get("/api/orbit/snapshot");
  expect(localResponse.status()).toBe(200);
});

test("phone Connections remains contained and touch-friendly", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile project only");
  await page.goto("/connections");
  const connect = page.getByRole("button", {
    name: "Connect fictional Calendar fixture",
  });
  await expect(connect).toBeVisible();
  const box = await connect.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("local Calendar lifecycle stays read-only from consent through deletion", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "single local connector lane");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/connections");
  await expect(
    page.getByRole("heading", { name: "Calendar demo" }),
  ).toBeVisible();
  await expect(
    page.getByText(/cannot create, change, or delete events/i),
  ).toBeVisible();
  const connectRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname ===
        "/api/connectors/google-calendar/connect",
  );
  const connectResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        "/api/connectors/google-calendar/connect",
  );
  await page
    .getByRole("button", { name: "Connect fictional Calendar fixture" })
    .click();
  const connectRequest = await connectRequestPromise;
  const connectResponse = await connectResponsePromise;
  expect(await connectRequest.headerValue("host")).toBe("127.0.0.1:3100");
  expect(await connectRequest.headerValue("origin")).toBe(
    "http://127.0.0.1:3100",
  );
  expect(await connectRequest.headerValue("sec-fetch-site")).toBe(
    "same-origin",
  );
  expect({
    status: connectResponse.status(),
    rejection: await connectResponse.headerValue("x-orbit-local-rejection"),
    location: await connectResponse.headerValue("location"),
  }).toEqual({
    status: 303,
    rejection: null,
    location: "http://127.0.0.1:3100/connections?calendar=connected",
  });

  await expect(page.getByRole("status")).toContainText(
    "fictional Calendar fixture is active",
  );
  await expect(page.getByText("Read only")).toBeVisible();
  await expect(page.getByText("3", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const snapshotResponse = await page.request.get(
    "/api/orbit/snapshot?context=calendar",
  );
  const serializedSnapshot = await snapshotResponse.text();
  expect(serializedSnapshot).not.toContain("fixture-refresh-token");
  expect(serializedSnapshot).not.toContain("fixture-access-token");
  expect(serializedSnapshot).not.toContain("client_secret");

  await page.goto("/?context=calendar&state=action");
  await expect(
    page.getByRole("heading", {
      name: /Airport arrival buffer overlaps Project Review/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve mocked change" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Talk it through" }).click();
  await page.getByRole("button", { name: "Show the evidence" }).click();
  await expect(page.getByText(/This context is read-only/i)).toBeVisible();
  await expect(
    page.getByText("Fictional Google Calendar fixture").first(),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "Ask Orbit" }).fill("Move it");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approve mocked change" }),
  ).toHaveCount(0);

  await page.goto("/connections");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(
    page.getByText(/makes no Google request and changes no real calendar/i),
  ).toBeVisible();
  const removeFixture = page.getByRole("button", {
    name: "Remove fictional fixture",
  });
  await expect(removeFixture).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await removeFixture.click();
  await expect(page.getByRole("status")).toContainText(
    "fictional Calendar fixture was disconnected",
  );

  await page.goto("/?context=calendar");
  await expect(
    page.getByRole("heading", { name: "Nothing needs your attention." }),
  ).toBeVisible();
  await expect(
    page.getByText(/Google Calendar is not connected/i),
  ).toBeVisible();
  const disconnectedSnapshot = await page.request.get("/api/orbit/snapshot");
  expect(disconnectedSnapshot.ok()).toBe(true);
  const disconnectedJson = (await disconnectedSnapshot.json()) as {
    calendar: { status: string; records: unknown[] };
  };
  expect(disconnectedJson.calendar).toMatchObject({
    status: "disconnected",
    records: [],
  });
  expect(consoleErrors).toEqual([]);
});

test("local Gmail lifecycle stays bounded and clears its state", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "single local connector lane");
  await page.goto("/connections");
  const gmail = page.getByRole("article", { name: "Gmail" });
  await gmail
    .getByRole("button", { name: "Connect fictional Gmail fixture" })
    .click();
  await expect(gmail.getByRole("status")).toContainText(
    "fictional Gmail fixture is active",
  );
  await expect(gmail.getByText("Restricted read only")).toBeVisible();

  const connected = await page.request.get("/api/orbit/snapshot");
  const connectedJson = (await connected.json()) as {
    email: { status: string; records: unknown[]; complete: boolean };
  };
  expect(connectedJson.email.status).toBe("fresh");
  expect(connectedJson.email.records.length).toBeGreaterThan(0);
  expect(connectedJson.email.complete).toBe(true);

  await gmail.getByRole("button", { name: "Disconnect" }).click();
  await gmail.getByRole("button", { name: "Remove fictional fixture" }).click();
  await expect(gmail.getByRole("status")).toContainText(
    "fictional Gmail fixture was disconnected",
  );
  const disconnected = await page.request.get("/api/orbit/snapshot");
  const disconnectedJson = (await disconnected.json()) as {
    email: { status: string; records: unknown[] };
  };
  expect(disconnectedJson.email).toMatchObject({
    status: "disconnected",
    records: [],
  });
});

test("local Nest lifecycle streams on request and controls only after approval", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "single local connector lane");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/connections");
  await page.waitForLoadState("networkidle");
  const nest = page.getByRole("article", { name: "Google Home / Nest" });
  const connect = nest.getByRole("button", {
    name: "Connect fictional Nest home",
  });
  if (!(await connect.isVisible())) {
    await nest.getByRole("button", { name: "Disconnect" }).click();
    await nest.getByRole("button", { name: "Remove Nest connection" }).click();
  }
  await connect.click();
  await page.waitForLoadState("networkidle");

  await expect(nest.getByRole("status").first()).toContainText(
    /connected|fresh/i,
  );
  await expect(nest.getByText("Kitchen speaker")).toBeVisible();
  await expect(nest.getByText("not supported by this connector")).toBeVisible();

  await nest.getByRole("button", { name: "View live video" }).click();
  await expect(
    nest.getByRole("dialog", { name: /View Front door camera live/i }),
  ).toContainText(/recorded or analyzed/i);
  await nest.getByRole("button", { name: "Start live video" }).click();
  await expect(
    nest.getByRole("img", { name: "Fictional camera stream preview" }),
  ).toBeVisible();
  await nest.getByRole("button", { name: "Stop video" }).click();

  await nest.getByRole("button", { name: "Set cool" }).click();
  const approval = nest.getByRole("dialog", {
    name: "Approve this device change?",
  });
  await expect(approval).toContainText("Mode was heat");
  await expect(approval).toContainText("execute this once");
  await approval.getByRole("button", { name: "Approve change" }).click();
  await expect(nest.getByRole("status").last()).toContainText("Verified");
  await expect(nest.getByRole("button", { name: "Review undo" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await nest.getByRole("button", { name: "Disconnect" }).click();
  await nest.getByRole("button", { name: "Remove Nest connection" }).click();
  await expect(nest.getByRole("status").first()).toContainText(/disconnected/i);
  const snapshot = await page.request.get("/api/orbit/snapshot");
  const json = (await snapshot.json()) as {
    home: { status: string; records: unknown[] };
  };
  expect(json.home).toMatchObject({ status: "disconnected", records: [] });
  expect(consoleErrors).toEqual([]);
});
