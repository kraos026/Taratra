import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const isPublicRoute =
    request.nextUrl.pathname === "/signup" ||
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/auth/");

  if (!isAuthenticated && !isPublicRoute) {
    return redirectWithSession("/login");
  }

  if (isAuthenticated && !isPublicRoute) {
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", data!.claims!.sub)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      const unavailable = new NextResponse(
        "Votre espace est temporairement indisponible. Réessayez.",
        {
          status: 503,
          headers: { "Cache-Control": "no-store", "Retry-After": "5" },
        },
      );
      response.cookies.getAll().forEach((cookie) => unavailable.cookies.set(cookie));
      return unavailable;
    }

    if (
      !membership &&
      request.nextUrl.pathname !== "/onboarding" &&
      !request.nextUrl.pathname.startsWith("/api/onboarding")
    ) {
      return redirectWithSession("/onboarding");
    }

    if (membership && request.nextUrl.pathname === "/onboarding") {
      return redirectWithSession("/");
    }
  }

  return response;

  function redirectWithSession(path: string) {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
}
