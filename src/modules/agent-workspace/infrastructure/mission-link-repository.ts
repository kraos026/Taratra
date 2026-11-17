import "server-only";
import { createClient } from "@/infrastructure/supabase/server";
import { hermesRunIdSchema, missionLinkSchema } from "../domain/hermes-missions";

export async function listMissionLinks(companyId: string) {
  const client = await createClient();
  const { data, error } = await client
    .from("agent_mission_links")
    .select("id,title,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(21);
  if (error) throw new Error("Mission registry unavailable");
  return {
    items: (data ?? []).slice(0, 20).map((row) => missionLinkSchema.parse(row)),
    hasMore: (data?.length ?? 0) > 20,
  };
}
export async function findMissionRun(companyId: string, id: string): Promise<string | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("agent_mission_links")
    .select("run_id")
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Mission registry unavailable");
  return data ? hermesRunIdSchema.parse(data.run_id) : null;
}
