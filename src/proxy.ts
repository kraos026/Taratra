import type { NextRequest } from "next/server";

import { updateSession } from "@/infrastructure/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/companies/:path*",
    "/crm/:path*",
    "/audits/:path*",
    "/recommendations/:path*",
    "/reports/:path*",
    "/knowledge/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/analysis/:path*",
    "/ai-opportunities/:path*",
    "/automation-opportunities/:path*",
    "/roi/:path*",
    "/solution-blueprints/:path*",
    "/automation-specifications/:path*",
    "/process-maps/:path*",
    "/knowledge-snapshots/:path*",
  ],
};
