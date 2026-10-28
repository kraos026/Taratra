import type { Company, DiscoverySession, DiscoveryAnswer } from "../../../generated/prisma/client";
import type { OrganizationContext } from "../../companies/domain/company";
import type { DiscoveryPayload } from "./discovery-schemas";
export type DiscoveryRecord = DiscoverySession & { answers: DiscoveryAnswer[] };
export interface DiscoveryRepository {
  context(userId: string): Promise<OrganizationContext | null>;
  company(organizationId: string, id: string): Promise<Company | null>;
  latest(organizationId: string, companyId: string): Promise<DiscoveryRecord | null>;
  session(organizationId: string, id: string): Promise<DiscoveryRecord | null>;
  create(
    organizationId: string,
    companyId: string,
    userId: string,
    version: number,
  ): Promise<DiscoveryRecord>;
  save(
    organizationId: string,
    id: string,
    userId: string,
    lockVersion: number,
    payload: DiscoveryPayload,
  ): Promise<DiscoveryRecord | null>;
  validate(organizationId: string, id: string, userId: string): Promise<DiscoveryRecord>;
  archive(organizationId: string, id: string): Promise<DiscoverySession>;
}
