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
  let operatorId: string | undefined;
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
    const owner = await client.query(
      "select requester_id from public.privacy_requests where id=$1 and description=$2",
      [requestId, description],
    );
    operatorId = owner.rows[0].requester_id;
    // An existing operator fixture must not be overwritten by this test.
    const previous = await client.query(
      "select 1 from private.privacy_request_operators where user_id=$1",
      [operatorId],
    );
    expect(previous.rowCount).toBe(0);
    await client.query(
      "insert into private.privacy_request_operators(user_id,expires_at,reason) values($1,now()+interval '1 hour',$2)",
      [operatorId, description],
    );
    expect((await b.request.get("/api/privacy-requests/operator")).status()).toBe(403);
    const change = {
      id: requestId,
      expectedRevision: 0,
      status: "NEEDS_INFORMATION",
      response: "Synthetic response: specify scope",
    };
    expect(
      (
        await b.request.patch("/api/privacy-requests/operator", {
          headers: { origin },
          data: change,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await a.request.patch("/api/privacy-requests/operator", {
          headers: { origin: "https://foreign.invalid" },
          data: change,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await a.request.patch("/api/privacy-requests/operator", {
          headers: { origin },
          data: { ...change, operatorId },
        })
      ).status(),
    ).toBe(400);
    const updated = await a.request.patch("/api/privacy-requests/operator", {
      headers: { origin },
      data: change,
    });
    expect(updated.status()).toBe(200);
    expect((await updated.json()).data.revision).toBe(1);
    expect(
      (
        await a.request.patch("/api/privacy-requests/operator", {
          headers: { origin },
          data: change,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await a.request.patch("/api/privacy-requests/operator", {
          headers: { origin },
          data: { ...change, response: "Another stale response" },
        })
      ).status(),
    ).toBe(409);
    const events = await client.query(
      "select count(*)::int as count from private.privacy_request_events where request_id=$1",
      [requestId],
    );
    expect(events.rows[0].count).toBe(1);
    await a.reload();
    await expect(
      a.getByText("Informations complémentaires nécessaires", { exact: true }),
    ).toBeVisible();
    await expect(
      a.getByText("Réponse du responsable : Synthetic response: specify scope", { exact: true }),
    ).toBeVisible();
    await a.goto("/settings/privacy-requests");
    const card = a.getByRole("article").filter({ hasText: description });
    await expect(card).toBeVisible();
    await card.getByLabel("Nouveau statut").selectOption("COMPLETED");
    await card
      .getByLabel("Réponse visible par le demandeur")
      .fill("Test fictif terminé : aucune donnée effacée.");
    await card.getByRole("button", { name: "Enregistrer la réponse" }).click();
    await expect(card.getByRole("status")).toContainText("Réponse enregistrée");
    await a.reload();
    await expect(
      a.getByRole("article").filter({ hasText: description }).getByRole("heading"),
    ).toContainText("Traitement terminé");
    expect(
      (
        await a.request.patch("/api/privacy-requests/operator", {
          headers: { origin },
          data: { ...change, expectedRevision: 2, status: "IN_REVIEW" },
        })
      ).status(),
    ).toBe(409);
    await client.query(
      "update private.privacy_request_operators set expires_at=now()-interval '1 second',granted_at=now()-interval '2 seconds' where user_id=$1 and reason=$2",
      [operatorId, description],
    );
    expect((await a.request.get("/api/privacy-requests/operator")).status()).toBe(403);
    await client.query(
      "delete from private.privacy_request_operators where user_id=$1 and reason=$2",
      [operatorId, description],
    );
    expect((await a.request.get("/api/privacy-requests/operator")).status()).toBe(403);
  } finally {
    // Only this uniquely identified same-run synthetic request is disposable.
    if (operatorId)
      await client.query(
        "delete from private.privacy_request_operators where user_id=$1 and reason=$2",
        [operatorId, description],
      );
    if (requestId) {
      await client.query(
        "delete from private.privacy_request_events where request_id=$1 and exists(select 1 from public.privacy_requests where id=$1 and description=$2)",
        [requestId, description],
      );
      await client.query("delete from public.privacy_requests where id=$1 and description=$2", [
        requestId,
        description,
      ]);
    }
    await client.end();
    await aContext.close();
    await bContext.close();
  }
});
