import "server-only";
import { z } from "zod";
import { skillSchema, toolsetSchema, type HermesInventory } from "../domain/hermes-inventory";
import { readHermesJson } from "./hermes-json-client";
import type { HermesRuntimeScope } from "../domain/hermes-runtime-scope";

export async function readHermesInventory(
  scope: HermesRuntimeScope,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HermesInventory> {
  const [skills, toolsets] = await Promise.all([
    readHermesJson(scope, "/v1/skills", env, fetcher),
    readHermesJson(scope, "/v1/toolsets", env, fetcher),
  ]);
  function list<T>(
    response: Awaited<ReturnType<typeof readHermesJson>>,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  ) {
    if (response.state !== "available")
      return {
        state: response.state === "not_found" ? ("unavailable" as const) : response.state,
        items: [],
      };
    const parsed = z
      .object({ object: z.literal("list"), data: z.array(schema).max(100) })
      .safeParse(response.data);
    return parsed.success
      ? { state: "available" as const, items: parsed.data.data }
      : { state: "unavailable" as const, items: [] };
  }
  return {
    checkedAt: new Date().toISOString(),
    skills: list(skills, skillSchema),
    toolsets: list(toolsets, toolsetSchema),
    modelCalls: 0,
  };
}
