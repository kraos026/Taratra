interface LogContext {
  readonly action: string;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly error?: string;
  readonly [key: string]: unknown;
}

export function logInfo(context: LogContext): void {
  console.info(JSON.stringify({ level: "info", timestamp: new Date().toISOString(), ...context }));
}

export function logError(context: LogContext): void {
  console.error(
    JSON.stringify({ level: "error", timestamp: new Date().toISOString(), ...context }),
  );
}
