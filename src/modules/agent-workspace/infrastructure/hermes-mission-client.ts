import "server-only";
import { z } from "zod";
import {
  hermesRunIdSchema,
  hermesRunStates,
  type MissionObservation,
} from "../domain/hermes-missions";
import { readHermesJson } from "./hermes-json-client";

const statusSchema = z.object({
  object: z.literal("hermes.run"),
  run_id: hermesRunIdSchema,
  status: z.enum(hermesRunStates),
});
export async function readHermesMission(
  companyId: string,
  runId: string,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<MissionObservation> {
  const result = (
    availability: MissionObservation["availability"],
    status: MissionObservation["status"] = null,
  ): MissionObservation => ({ availability, status, checkedAt: new Date().toISOString() });
  if (!hermesRunIdSchema.safeParse(runId).success) return result("unavailable");
  const response = await readHermesJson(companyId, `/v1/runs/${runId}`, env, fetcher);
  if (response.state !== "available") return result(response.state);
  const parsed = statusSchema.safeParse(response.data);
  if (!parsed.success || parsed.data.run_id !== runId) return result("unavailable");
  return result("available", parsed.data.status);
}
