import { z } from "zod";
import { loadAgentCompany } from "./agent-workspace-access";
import { listMissionLinks, findMissionRun } from "../infrastructure/mission-link-repository";
import { readHermesMission } from "../infrastructure/hermes-mission-client";

const response = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function listCompanyMissions(companyId: string) {
  const company = await loadAgentCompany(companyId);
  if (company instanceof Response) {
    company.headers.set("Cache-Control", "private, no-store");
    return company;
  }
  try {
    return response({ data: await listMissionLinks(company.id) });
  } catch {
    return response({ error: { message: "Le registre des missions est indisponible." } }, 503);
  }
}
export async function observeCompanyMission(companyId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return response({ error: { message: "Mission introuvable." } }, 404);
  const company = await loadAgentCompany(companyId);
  if (company instanceof Response) {
    company.headers.set("Cache-Control", "private, no-store");
    return company;
  }
  try {
    const runId = await findMissionRun(company.id, id);
    if (!runId) return response({ error: { message: "Mission introuvable." } }, 404);
    return response({ data: await readHermesMission(company.id, runId) });
  } catch {
    return response({ error: { message: "Le suivi est indisponible." } }, 503);
  }
}
