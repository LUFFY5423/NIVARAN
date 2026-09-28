import { test, expect, type Page } from "@playwright/test";

// NOTE: written against the demo seed data. Not executed in the authoring sandbox
// (Playwright browser binaries could not be downloaded there) - run with `npm run e2e`.

const PASSWORD = "Password123!";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(student|admin|technician)/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
}

test("student submits -> admin assigns -> technician resolves -> student verifies", async ({ page }) => {
  const title = `E2E broken socket ${Date.now()}`;

  // Student submits
  await login(page, "aarav.student@nivaran.edu");
  await page.goto("/student/submit");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("The wall socket sparks when plugging in a charger.");
  await page.getByLabel("Category").selectOption({ label: "Electrical" });
  await page.getByLabel("Priority").selectOption("HIGH");
  await page.getByRole("button", { name: "Submit Complaint" }).click();
  await page.waitForURL("**/student/complaints");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await logout(page);

  // Admin assigns
  await login(page, "admin@nivaran.edu");
  await page.goto(`/admin/complaints?q=${encodeURIComponent(title)}`);
  await page.getByRole("link", { name: title }).click();
  await page.getByLabel("Assign to").selectOption({ label: "Ramesh Kumar" });
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.getByText("Complaint assigned.")).toBeVisible();
  await logout(page);

  // Technician accepts, starts, and marks ready with notes
  await login(page, "ramesh.tech@nivaran.edu");
  await page.goto("/technician/assigned");
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "Start work" }).click();
  await page.getByLabel("Work performed").fill("Replaced the faulty socket and tested with a load.");
  await page.getByRole("button", { name: "Mark ready for verification" }).click();
  await expect(page.getByText("Sent to the student for verification.")).toBeVisible();
  await logout(page);

  // Student verifies and rates
  await login(page, "aarav.student@nivaran.edu");
  await page.goto("/student/complaints");
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "Yes, it's resolved" }).click();
  await expect(page.getByText("Thanks for confirming!")).toBeVisible();
  await page.getByRole("button", { name: "Submit rating" }).click();
  await expect(page.getByText("Thanks for your feedback!")).toBeVisible();
  await expect(page.getByText("Activity Timeline")).toBeVisible();
});

test("unauthenticated and wrong-role access is redirected", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await login(page, "aarav.student@nivaran.edu");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/student$/);
});
