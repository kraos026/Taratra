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
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth/");

  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && !isPublicRoute) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .limit(1)
      .maybeSingle();

    if (
      !membership &&
      request.nextUrl.pathname !== "/onboarding" &&
      !request.nextUrl.pathname.startsWith("/api/onboarding")
    ) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    if (membership && request.nextUrl.pathname === "/onboarding") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}
