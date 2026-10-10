import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loginAsTenantA, loginAsTenantB } from "./support/auth";
import { pilotBrowserContextOptions, readPilotE2EConfig } from "./support/env";
const config = readPilotE2EConfig(process.env);
test("local self-only privacy request persists and tracks manual response without erasure", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  test.skip(
    !config ||
      config.baseUrl !== "http://localhost:3000" ||
      process.env.AUTOMATEX_CERTIFICATION_DB !== "true" ||
      process.env.AUTOMATEX_CERTIFICATION_TARGET !== "local",
    "LOCAL FICTITIOUS ONLY",
  );
  const url = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  expect(url.port).toBe("55022");
  const aContext = await browser.newContext(pilotBrowserContextOptions(config!));
  const bContext = await browser.newContext(pilotBrowserContextOptions(config!));
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const description = `Synthetic privacy test ${randomUUID()}`;
  let requestId: string | undefined;
  try {
    const a = await aContext.newPage();
    const b = await bContext.newPage();
    await loginAsTenantA(a, config!);
    await loginAsTenantB(b, config!);
    await a.goto("/settings");
    await expect(a.getByRole("button", { name: "Enregistrer ma demande" })).toBeEnabled();
    await a.getByLabel("Périmètre de ma demande").fill(description);
    const saved = a.waitForResponse(
      (r) => r.url().endsWith("/api/privacy-requests") && r.request().method() === "POST",
    );
    await a.getByRole("button", { name: "Enregistrer ma demande" }).click();
    const response = await saved;
    expect(response.status()).toBe(201);
    const record = (await response.json()).data;
    requestId = record.id;
    expect(record.status).toBe("RECEIVED");
    expect(record).not.toHaveProperty("requesterId");
    expect(response.headers()["cache-control"]).toContain("no-store");
    await expect(a.getByText("Demande enregistrée.", { exact: false })).toBeVisible();
    await a.reload();
    await expect(a.getByText(description, { exact: true })).toBeVisible();
    const foreign = await b.request.get("/api/privacy-requests");
    expect(foreign.status()).toBe(200);
    expect(
      (await foreign.json()).data.requests.some((row: { id: string }) => row.id === requestId),
    ).toBe(false);
    const origin = "http://localhost:3000";
    const retry = await a.request.post("/api/privacy-requests", {
      headers: { origin },
      data: { id: requestId, kind: "ACCESS", description },
    });
    expect(retry.status()).toBe(201);
    expect((await retry.json()).data.id).toBe(requestId);
    expect(
      (
        await a.request.post("/api/privacy-requests", {
          headers: { origin },
          data: { id: randomUUID(), kind: "ACCESS", description },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await a.request.patch("/api/privacy-requests", {
          data: { id: requestId, status: "COMPLETED" },
        })
      ).status(),
    ).toBe(405);
    // Privileged response is exercised ONLY on this same-run local fixture.
    await client.query(
      "update public.privacy_requests set status='NEEDS_INFORMATION', public_response=$1, updated_at=now() where id=$2 and description=$3",
      ["Synthetic response: specify scope", requestId, description],
    );
    await a.reload();
    await expect(
      a.getByText("Informations complémentaires nécessaires", { exact: true }),
    ).toBeVisible();
    await expect(
      a.getByText("Réponse du responsable : Synthetic response: specify scope", { exact: true }),
    ).toBeVisible();
  } finally {
    // Only this uniquely identified same-run synthetic request is disposable.
    if (requestId)
      await client.query("delete from public.privacy_requests where id=$1 and description=$2", [
        requestId,
        description,
      ]);
    await client.end();
    await aContext.close();
    await bContext.close();
  }
});
