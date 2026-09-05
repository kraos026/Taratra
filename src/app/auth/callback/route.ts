import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const next = safeReturnUrl(requestedNext, url.origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(next);
    }
  }

  return NextResponse.redirect(new URL("/signup?error=confirmation", url.origin));
}

function safeReturnUrl(value: string | null, origin: string): URL {
  const fallback = new URL("/onboarding", origin);
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value))
    return fallback;
  try {
    const destination = new URL(value, origin);
    return destination.origin === origin ? destination : fallback;
  } catch {
    return fallback;
  }
}
