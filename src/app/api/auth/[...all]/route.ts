import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

async function handle(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (process.env.NEXT_PUBLIC_OPTIVOS_CONVEX_PILOT !== "1" || !convexUrl || !convexSiteUrl) {
    return Response.json({ error: "Authentication unavailable" }, { status: 503 });
  }
  const { handler } = convexBetterAuthNextJs({ convexUrl, convexSiteUrl });
  return request.method === "GET" ? handler.GET(request) : handler.POST(request);
}
export const GET = handle;
export const POST = handle;
