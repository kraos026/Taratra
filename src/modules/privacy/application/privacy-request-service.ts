import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";

export const privacyRequestInput = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["ACCESS", "CORRECTION", "DELETION"]),
    description: z.string().trim().min(5).max(1000),
  })
  .strict();

export class PrivacyRequestError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const projection = {
  id: true,
  kind: true,
  description: true,
  status: true,
  publicResponse: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listPrivacyRequests(db: TransactionClient, userId: string) {
  const rows = await db.privacyRequest.findMany({
    where: { requesterId: userId },
    select: projection,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
  });
  return { requests: rows.slice(0, 50), hasMore: rows.length > 50 };
}

export async function createPrivacyRequest(
  db: TransactionClient,
  userId: string,
  input: z.infer<typeof privacyRequestInput>,
) {
  const existing = await db.privacyRequest.findFirst({
    where: { id: input.id, requesterId: userId },
    select: projection,
  });
  if (existing) {
    if (existing.kind !== input.kind || existing.description !== input.description)
      throw new PrivacyRequestError(
        "REQUEST_CONFLICT",
        409,
        "Cette référence correspond à une autre demande.",
      );
    return existing;
  }
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  if (!membership)
    throw new PrivacyRequestError(
      "WORKSPACE_REQUIRED",
      403,
      "Un espace est nécessaire. Vous pouvez contacter le responsable par email.",
    );
  const open = await db.privacyRequest.findFirst({
    where: {
      requesterId: userId,
      kind: input.kind,
      status: { in: ["RECEIVED", "IN_REVIEW", "NEEDS_INFORMATION"] },
    },
    select: { id: true },
  });
  if (open)
    throw new PrivacyRequestError(
      "OPEN_REQUEST",
      409,
      "Une demande de ce type est déjà ouverte. Consultez son suivi.",
    );
  try {
    // Prisma's create also inserts default columns, outside the self-service grant.
    // Keep status/response/timestamps database-owned; bind only permitted fields.
    const rows = await db.$queryRaw<
      Prisma.PrivacyRequestGetPayload<{ select: typeof projection }>[]
    >`
      INSERT INTO public.privacy_requests
        (id, requester_id, organization_id, kind, description)
      VALUES (${input.id}::uuid, ${userId}::uuid, ${membership.organizationId}::uuid,
        ${input.kind}, ${input.description})
      RETURNING id, kind, description, status, public_response AS "publicResponse",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    if (!rows[0]) throw new Error("EMPTY_INSERT_RESULT");
    return rows[0];
  } catch (caught) {
    // Prevent Prisma validation/query errors containing user text reaching DB logs.
    const failure = caught as {
      code?: string;
      meta?: { code?: string; driverAdapterError?: { cause?: { code?: string } } };
    };
    if (
      failure?.code === "P2002" ||
      failure?.meta?.code === "23505" ||
      failure?.meta?.driverAdapterError?.cause?.code === "23505"
    )
      throw new PrivacyRequestError(
        "REQUEST_CONFLICT",
        409,
        "Une demande existe déjà. Actualisez le suivi avant de réessayer.",
      );
    throw new PrivacyRequestError(
      "REQUEST_UNAVAILABLE",
      500,
      "Enregistrement indisponible. Contactez le responsable par email.",
    );
  }
}
