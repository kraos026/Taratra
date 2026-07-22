import { NextResponse } from "next/server";

export function apiSuccess<Data>(data: Data, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}
