import type { WorkActivityRepository } from "../application/work-activity-repository";
import { WorkActivity, WorkIntelligenceError } from "../domain/work-intelligence";

export class InMemoryWorkActivityRepository implements WorkActivityRepository {
  private readonly records = new Map<string, WorkActivity[]>();

  async append(activity: WorkActivity, expectedVersion: number): Promise<void> {
    const key = this.key(activity.tenantId, activity.companyId, activity.lineageId);
    const history = this.records.get(key) ?? [];
    const actualVersion = history.at(-1)?.version ?? 0;
    if (actualVersion !== expectedVersion)
      throw new WorkIntelligenceError("Work activity version conflict");
    this.records.set(key, [...history, activity]);
  }

  async appendBatch(activities: readonly WorkActivity[]): Promise<void> {
    const keys = new Set<string>();
    for (const activity of activities) {
      const key = this.key(activity.tenantId, activity.companyId, activity.lineageId);
      if (keys.has(key) || this.records.has(key))
        throw new WorkIntelligenceError("Atomic activity batch contains a version conflict");
      keys.add(key);
    }
    for (const activity of activities)
      this.records.set(this.key(activity.tenantId, activity.companyId, activity.lineageId), [
        activity,
      ]);
  }

  async latest(
    tenantId: string,
    companyId: string,
    lineageId: string,
  ): Promise<WorkActivity | null> {
    return this.records.get(this.key(tenantId, companyId, lineageId))?.at(-1) ?? null;
  }

  async list(tenantId: string, companyId: string): Promise<readonly WorkActivity[]> {
    return Object.freeze(
      [...this.records.entries()]
        .filter(([key]) => key.startsWith(`${tenantId}:${companyId}:`))
        .map(([, history]) => history.at(-1))
        .filter((activity): activity is WorkActivity => activity !== undefined)
        .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime()),
    );
  }

  async history(
    tenantId: string,
    companyId: string,
    lineageId: string,
  ): Promise<readonly WorkActivity[]> {
    return Object.freeze([...(this.records.get(this.key(tenantId, companyId, lineageId)) ?? [])]);
  }

  private key(tenantId: string, companyId: string, lineageId: string): string {
    return `${tenantId}:${companyId}:${lineageId}`;
  }
}
