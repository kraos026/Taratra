"use client";
import { useMemo } from "react";
import { useConvex, type ConvexReactClient } from "convex/react";
import { ConvexError } from "convex/values";
import {
  InterviewWizard,
  type InterviewTransport,
} from "@/modules/interviews/presentation/interview-wizard";
import { api } from "../../../convex/_generated/api";
export function createConvexInterviewTransport(
  client: Pick<ConvexReactClient, "query" | "mutation">,
  companyId: string,
): InterviewTransport {
  return async (url, init) => {
    try {
      const method = init?.method?.toUpperCase() ?? "GET";
      let data: unknown;
      if (url === `/api/companies/${companyId}/interviews`) {
        if (method === "GET") data = await client.query(api.interviews.companyView, { companyId });
        else if (method === "POST")
          data = await client.mutation(api.interviews.start, { companyId });
        else return Response.json({ error: { code: "METHOD_NOT_ALLOWED" } }, { status: 405 });
      } else {
        const match = url.match(
          /^\/api\/interviews\/([a-f0-9-]+)\/(answer|skip|back|complete|validate)$/i,
        );
        if (!match || method !== "POST")
          return Response.json({ error: { code: "UNSUPPORTED_ROUTE" } }, { status: 400 });
        const input = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        const id = match[1];
        switch (match[2]) {
          case "answer":
            data = await client.mutation(api.interviews.answer, {
              id,
              lockVersion: input.lockVersion,
              questionId: input.questionId,
              value: input.value,
              confidence: input.confidence,
              ...(input.documentSource ? { documentSource: input.documentSource } : {}),
            });
            break;
          case "skip":
            data = await client.mutation(api.interviews.skip, {
              id,
              lockVersion: input.lockVersion,
              questionId: input.questionId,
              reason: input.reason,
            });
            break;
          case "back":
            data = await client.mutation(api.interviews.back, {
              id,
              lockVersion: input.lockVersion,
              questionId: input.questionId,
            });
            break;
          case "complete":
            data = await client.mutation(api.interviews.complete, { id });
            break;
          case "validate":
            data = await client.mutation(api.interviews.validate, { id });
            break;
        }
      }
      return Response.json({ data });
    } catch (error) {
      if (
        error instanceof ConvexError &&
        typeof error.data === "object" &&
        error.data !== null &&
        typeof error.data.status === "number"
      )
        return Response.json(
          {
            error: {
              code: error.data.code,
              message:
                typeof error.data.message === "string"
                  ? error.data.message
                  : "Entretien indisponible",
            },
          },
          { status: error.data.status },
        );
      return Response.json(
        { error: { code: "UNAVAILABLE", message: "Entretien indisponible" } },
        { status: 503 },
      );
    }
  };
}
export function InterviewWorkspace({ companyId }: { companyId: string }) {
  const client = useConvex();
  const transport = useMemo(
    () => createConvexInterviewTransport(client, companyId),
    [client, companyId],
  );
  return (
    <InterviewWizard
      companyId={companyId}
      transport={transport}
      backHref={`/convex-pilot/companies/${companyId}/discovery`}
      nextStepHref={null}
    />
  );
}
