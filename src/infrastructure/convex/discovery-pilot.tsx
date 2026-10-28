"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useConvex, type ConvexReactClient } from "convex/react";
import { ConvexError } from "convex/values";
import {
  DiscoveryWizard,
  type DiscoveryTransport,
} from "@/modules/discovery/presentation/discovery-wizard";
import { api } from "../../../convex/_generated/api";

export function createConvexDiscoveryTransport(
  client: Pick<ConvexReactClient, "query" | "mutation">,
  companyId: string,
): DiscoveryTransport {
  return async (url, init) => {
    try {
      const method = init?.method?.toUpperCase() ?? "GET";
      let data: unknown;
      if (url === `/api/companies/${companyId}/discovery`) {
        if (method === "GET")
          data = await client.query(api.discovery.companySession, { companyId });
        else if (method === "POST")
          data = await client.mutation(api.discovery.start, { companyId });
        else return Response.json({ error: { code: "METHOD_NOT_ALLOWED" } }, { status: 405 });
      } else {
        const match = url.match(/^\/api\/discovery-sessions\/([a-f0-9-]+)(\/validate)?$/i);
        if (!match) return Response.json({ error: { code: "UNSUPPORTED_ROUTE" } }, { status: 400 });
        if (match[2] && method === "POST")
          data = await client.mutation(api.discovery.validate, { id: match[1] });
        else if (!match[2] && method === "PATCH" && typeof init?.body === "string") {
          const input = JSON.parse(init.body);
          data = await client.mutation(api.discovery.save, {
            id: match[1],
            lockVersion: input.lockVersion,
            payload: input.payload,
          });
        } else return Response.json({ error: { code: "METHOD_NOT_ALLOWED" } }, { status: 405 });
      }
      return Response.json({ data });
    } catch (error) {
      if (
        error instanceof ConvexError &&
        typeof error.data === "object" &&
        error.data !== null &&
        typeof error.data.status === "number"
      )
        return Response.json({ error: { code: error.data.code } }, { status: error.data.status });
      return Response.json({ error: { code: "UNAVAILABLE" } }, { status: 503 });
    }
  };
}
export function DiscoveryWorkspace({ companyId }: { companyId: string }) {
  const client = useConvex();
  const transport = useMemo(
    () => createConvexDiscoveryTransport(client, companyId),
    [client, companyId],
  );
  return (
    <div className="space-y-6">
      <Link href="/convex-pilot" className="text-sm text-blue-300 underline">
        ← Vos entreprises
      </Link>
      <DiscoveryWizard companyId={companyId} transport={transport} nextStepHref={null} />
    </div>
  );
}
