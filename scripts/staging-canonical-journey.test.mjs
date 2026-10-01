import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { discoveryPayloads, answerFor } from "./staging-canonical-fixture.mjs";
import { certifyStagingJourney } from "./staging-canonical-journey.mjs";

describe("staging canonical certification safety", () => {
  it("keeps the discovery fixture identical to the locally certified journey", () => {
    const source = readFileSync(
      new URL("./run-canonical-certification.mjs", import.meta.url),
      "utf8",
    );
    const original = source.slice(
      source.indexOf("function discoveryPayloads()"),
      source.indexOf("function nextQuestion(view)"),
    );
    expect(discoveryPayloads.toString().replace(/\s/g, "")).toBe(original.replace(/\s/g, ""));
  });

  it("explicitly declares the measurement instead of treating headcount as KPI evidence", () => {
    const answer = answerFor({ type: "text", label: "Process measurement" });
    expect(answer).toContain("monthly invoice-volume KPI");
    expect(answer).toContain("85 invoices");
    expect(answer).toContain("45 manual hours");
  });

  it("rejects non-staging environments before any data access", async () => {
    let accessed = false;
    await expect(
      certifyStagingJourney({
        evidence: { environment: "PRODUCTION" },
        admin: {
          from() {
            accessed = true;
          },
        },
      }),
    ).rejects.toThrow();
    expect(accessed).toBe(false);
  });

  it("stops before product writes when the scoped company readback is unavailable", async () => {
    let mutated = false;
    const query = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      async single() {
        return { error: { code: "UNAVAILABLE" }, data: null };
      },
    };
    await expect(
      certifyStagingJourney({
        evidence: { environment: "STAGING" },
        admin: {
          from() {
            return query;
          },
        },
        api() {
          mutated = true;
        },
      }),
    ).rejects.toThrow("company readback unavailable");
    expect(mutated).toBe(false);
  });
});
