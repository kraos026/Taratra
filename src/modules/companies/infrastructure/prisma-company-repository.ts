import { Prisma, type Company as PrismaCompany } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { CompanyRepository } from "../application/company-repository";
import type {
  Company,
  CompanyInput,
  CompanyListQuery,
  CompanyUpdate,
  OrganizationContext,
} from "../domain/company";

function mapCompany(company: PrismaCompany): Company {
  return company;
}

function cleanData(input: CompanyUpdate): CompanyUpdate {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value ?? null]),
  ) as CompanyUpdate;
}

export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly database: TransactionClient) {}

  async getOrganizationContext(userId: string): Promise<OrganizationContext | null> {
    return this.database.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async list(organizationId: string, query: CompanyListQuery) {
    const where: Prisma.CompanyWhereInput = {
      organizationId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.companySize ? { companySize: query.companySize } : {}),
      ...(query.sectorId ? { sectorId: query.sectorId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { primaryContactName: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { city: { contains: query.search, mode: "insensitive" } },
              { sectorId: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.CompanyOrderByWithRelationInput = {
      [query.sortBy]: query.sortOrder,
    };
    const [items, total] = await Promise.all([
      this.database.company.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.company.count({ where }),
    ]);
    return { items: items.map(mapCompany), total };
  }

  async findById(organizationId: string, id: string): Promise<Company | null> {
    const company = await this.database.company.findFirst({ where: { id, organizationId } });
    return company ? mapCompany(company) : null;
  }

  async create(organizationId: string, input: CompanyInput): Promise<Company> {
    return mapCompany(
      await this.database.company.create({ data: { ...input, organizationId } }),
    );
  }

  async update(organizationId: string, id: string, input: CompanyUpdate): Promise<Company | null> {
    const result = await this.database.company.updateMany({
      where: { id, organizationId },
      data: cleanData(input),
    });
    return result.count === 0 ? null : this.findById(organizationId, id);
  }

  async archive(organizationId: string, id: string): Promise<Company | null> {
    const result = await this.database.company.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count === 0 ? null : this.findById(organizationId, id);
  }

  async restore(organizationId: string, id: string): Promise<Company | null> {
    const result = await this.database.company.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return result.count === 0 ? null : this.findById(organizationId, id);
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    const result = await this.database.company.deleteMany({ where: { id, organizationId } });
    return result.count === 1;
  }
}
