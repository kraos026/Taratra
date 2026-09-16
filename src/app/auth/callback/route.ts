import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const requestedNext = url.searchParams.get("next");
  const next = safeReturnUrl(type === "recovery" ? "/reset-password" : requestedNext, url.origin);
  const ambiguous = ["code", "token_hash", "type", "next"].some(
    (key) => url.searchParams.getAll(key).length > 1,
  );
  const tokenFlow =
    !ambiguous &&
    !url.searchParams.has("code") &&
    Boolean(tokenHash?.trim()) &&
    (type === "email" || type === "recovery");
  const codeFlow =
    !ambiguous &&
    !url.searchParams.has("token_hash") &&
    !url.searchParams.has("type") &&
    Boolean(code?.trim());

  if (tokenFlow || codeFlow) {
    try {
      const supabase = await createClient();
      // Email links can establish SSR cookies in a new browser without a PKCE verifier.
      // Retain code exchange for existing links and other PKCE flows during transition.
      const { error } = tokenFlow
        ? await supabase.auth.verifyOtp({
            token_hash: tokenHash!,
            type: type as "email" | "recovery",
          })
        : await supabase.auth.exchangeCodeForSession(code!);

      if (!error) {
        return privateRedirect(next);
      }
    } catch {
      /* Failed exchanges must not expose provider details or strand the user. */
    }
  }

  return privateRedirect(
    new URL(
      next.pathname === "/reset-password"
        ? "/forgot-password?error=recovery"
        : "/signup?error=confirmation",
      url.origin,
    ),
  );
}

function privateRedirect(destination: URL) {
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function safeReturnUrl(value: string | null, origin: string): URL {
  const fallback = new URL("/onboarding", origin);
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value))
    return fallback;
  try {
    // Reject encoded slashes/backslashes/control characters that a downstream redirect could decode.
    if (/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|20)/i.test(value)) return fallback;
    const destination = new URL(value, origin);
    if (
      ["code", "token", "token_hash", "access_token", "refresh_token"].some((key) =>
        destination.searchParams.has(key),
      )
    )
      return fallback;
    destination.hash = "";
    return destination.origin === origin ? destination : fallback;
  } catch {
    return fallback;
  }
}
