/** A 401 or 403 whose error text mentions step-up. */
export function isStepUpRequired(status: number, body: unknown): boolean {
  if (status !== 401 && status !== 403) return false;
  return /step[_-]?up/i.test(errorText(body));
}

function errorText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  const parts: unknown[] = [record.error, record.code, record.message];
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    parts.push(nested.code, nested.message, nested.type);
  }
  return parts.filter((part): part is string => typeof part === "string").join(" ");
}

export interface StepUpStart {
  url: string;
}
