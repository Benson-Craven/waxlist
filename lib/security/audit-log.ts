type AuditLevel = "info" | "warn" | "error";

type AuditEvent = {
  event: string;
  requestId: string;
  route: string;
  status: number;
  subjectId?: string;
  ipId?: string;
  reason?: string;
  details?: Record<string, unknown>;
};

export function writeAuditLog(level: AuditLevel, event: AuditEvent) {
  const payload = {
    at: new Date().toISOString(),
    level,
    ...event,
  };
  const message = JSON.stringify(payload);

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
}
