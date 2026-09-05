import { describe, expect, it, vi } from "vitest";
import { assertForeignCompanyDenied, knowledgeCounts } from "./canonical-read-checks.mjs";

describe("canonical certification evidence", () => {
  it("counts only the current organization and knowledge snapshot", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ count: 0 }] });
    expect(await knowledgeCounts({ query }, "org-a", "fresh-snapshot")).toEqual({
      knowledge_sources: 0,
      knowledge_facts: 0,
      knowledge_nodes: 0,
    });
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain("where organization_id = $1 and snapshot_id = $2");
      expect(params).toEqual(["org-a", "fresh-snapshot"]);
    }
  });
  it("requires all foreign-company API reads to return 404", async () => {
    const get = vi.fn().mockResolvedValue({ status: () => 404 });
    await assertForeignCompanyDenied({ get }, "company-a");
    expect(get).toHaveBeenCalledTimes(3);
  });
  it.each([200, 401, 500])("rejects a false isolation green with HTTP %s", async (status) => {
    const get = vi.fn().mockResolvedValue({ status: () => status });
    await expect(assertForeignCompanyDenied({ get }, "company-a")).rejects.toThrow(
      "isolation failed",
    );
  });
});
