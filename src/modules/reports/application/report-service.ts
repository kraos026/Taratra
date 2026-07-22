import { ReportBuilder } from "./report-builder";
import type { PrismaReportRepository } from "../infrastructure/prisma-report-repository";
export class ReportService {
  constructor(
    private readonly repository: PrismaReportRepository,
    private readonly userId: string,
    private readonly builder = new ReportBuilder(),
  ) {}
  async get(auditId: string) {
    const context = await this.repository.context(this.userId);
    if (!context) throw new Error("FORBIDDEN");
    const audit = await this.repository.load(context.organizationId, auditId);
    if (!audit) throw new Error("NOT_FOUND");
    return this.builder.build({ audit });
  }
}
