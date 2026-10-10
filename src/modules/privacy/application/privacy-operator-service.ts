import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { z } from "zod";
import { PrivacyRequestError } from "./privacy-request-service";
import { privacyOperatorInput, privacyTransitionAllowed } from "./privacy-operator-policy";

export async function authorizePrivacyOperator(
  db: TransactionClient,
  userId: string,
  sessionId: string,
) {
  const rows = await db.$queryRaw<{ allowed: boolean }[]>`
    SELECT true AS allowed FROM private.privacy_request_operators o
    JOIN auth.users u ON u.id = o.user_id
    JOIN auth.sessions s ON s.user_id = u.id AND s.id = ${sessionId}::uuid
    WHERE o.user_id = ${userId}::uuid AND o.expires_at > now()
      AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until <= now())
      AND (s.not_after IS NULL OR s.not_after > now())
    FOR SHARE OF o, s
  `;
  if (!rows[0]?.allowed)
    throw new PrivacyRequestError("FORBIDDEN", 403, "Accès réservé au responsable autorisé.");
}

type OperatorRow = {
  id: string;
  kind: string;
  description: string;
  status: string;
  publicResponse: string | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};
export async function listOperatorPrivacyRequests(db: TransactionClient) {
  const rows = await db.$queryRaw<OperatorRow[]>`
    SELECT id, kind, description, status, public_response AS "publicResponse", revision,
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM public.privacy_requests ORDER BY created_at DESC, id DESC LIMIT 51
  `;
  // Two bounded queries, not fifty sequential history queries in one transaction.
  const history = await db.$queryRaw<
    {
      requestId: string;
      fromStatus: string;
      toStatus: string;
      response: string;
      revision: number;
      createdAt: Date;
    }[]
  >`
    SELECT r.id AS "requestId", e.from_status AS "fromStatus", e.to_status AS "toStatus",
      e.response, e.revision, e.created_at AS "createdAt"
    FROM (SELECT id FROM public.privacy_requests ORDER BY created_at DESC, id DESC LIMIT 50) r
    CROSS JOIN LATERAL (
      SELECT from_status, to_status, response, revision, created_at
      FROM private.privacy_request_events WHERE request_id = r.id ORDER BY revision DESC LIMIT 10
    ) e
    ORDER BY r.id, e.revision DESC
  `;
  const requests = rows.slice(0, 50).map((row) => ({
    ...row,
    history: history
      .filter((event) => event.requestId === row.id)
      .map((event) => ({
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        response: event.response,
        revision: event.revision,
        createdAt: event.createdAt,
      })),
  }));
  return { requests, hasMore: rows.length > 50 };
}

// Caller must authorize inside the SAME transaction before invoking these functions.
export async function updateOperatorPrivacyRequest(
  db: TransactionClient,
  operatorId: string,
  input: z.infer<typeof privacyOperatorInput>,
) {
  const rows = await db.$queryRaw<OperatorRow[]>`
    SELECT id, kind, description, status, public_response AS "publicResponse", revision,
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM public.privacy_requests WHERE id = ${input.id}::uuid FOR UPDATE
  `;
  const row = rows[0];
  if (!row) throw new PrivacyRequestError("NOT_FOUND", 404, "Demande introuvable.");
  if (row.revision !== input.expectedRevision) {
    if (
      row.revision === input.expectedRevision + 1 &&
      row.status === input.status &&
      row.publicResponse === input.response
    ) {
      const retry = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM private.privacy_request_events WHERE request_id = ${row.id}::uuid
          AND revision = ${row.revision} AND operator_id = ${operatorId}::uuid
          AND to_status = ${input.status} AND response = ${input.response}
      `;
      if (retry[0]) return row;
    }
    throw new PrivacyRequestError(
      "REQUEST_CONFLICT",
      409,
      "La demande a changé. Actualisez avant de répondre.",
    );
  }
  if (!privacyTransitionAllowed(row.status, input.status))
    throw new PrivacyRequestError(
      "INVALID_TRANSITION",
      409,
      "Ce changement de statut n’est pas autorisé.",
    );
  await db.$executeRaw`
    INSERT INTO private.privacy_request_events (request_id, operator_id, from_status, to_status, response, revision)
    VALUES (${row.id}::uuid, ${operatorId}::uuid, ${row.status}, ${input.status}, ${input.response}, ${row.revision + 1})
  `;
  const updated = await db.$queryRaw<OperatorRow[]>`
    UPDATE public.privacy_requests SET status = ${input.status}, public_response = ${input.response},
      revision = revision + 1, updated_at = now()
    WHERE id = ${row.id}::uuid AND revision = ${input.expectedRevision}
    RETURNING id, kind, description, status, public_response AS "publicResponse", revision,
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  if (!updated[0]) throw new PrivacyRequestError("REQUEST_CONFLICT", 409, "La demande a changé.");
  return updated[0];
}
