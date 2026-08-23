export type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
};

export type ApiPage<T> = {
  items?: T[];
};

export function apiData<T>(payload: ApiEnvelope<T>): T | undefined {
  return payload.data;
}

export function apiItems<T>(payload: ApiEnvelope<ApiPage<T> | T[]>): T[] {
  const data = payload.data;
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}
