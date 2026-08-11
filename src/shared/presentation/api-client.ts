type ApiEnvelope<Data> = {
  success?: boolean;
  data?: Data;
  error?: { code?: string; message?: string };
};

export class PublicApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}

export async function readApiResponse<Data>(
  response: Response,
  fallbackMessage: string,
): Promise<Data> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new PublicApiError(fallbackMessage, response.status || 500, "INVALID_API_RESPONSE");
  }

  let payload: ApiEnvelope<Data>;
  try {
    payload = (await response.json()) as ApiEnvelope<Data>;
  } catch {
    throw new PublicApiError(fallbackMessage, response.status || 500, "INVALID_API_RESPONSE");
  }

  if (!response.ok || payload.data === undefined) {
    throw new PublicApiError(
      payload.error?.message ?? fallbackMessage,
      response.status,
      payload.error?.code,
    );
  }

  return payload.data;
}
