/** HTTP 403 whose JSON body is exactly { "error": "step_up_required" }. */
export function isStepUpRequired(status: number, body: unknown): boolean {
  if (status !== 403 || !body || typeof body !== "object" || Array.isArray(body)) return false;
  return (body as { error?: unknown }).error === "step_up_required";
}

export interface StepUpChoices {
  providers: string[];
}

const STEP_UP_PROVIDERS = new Set(["google", "microsoft"]);

/** Linked Google or Microsoft accounts. */
export function stepUpChoices(
  providers: { provider: string }[] | null | undefined,
): StepUpChoices {
  const linked = (providers ?? [])
    .map((item) => item.provider.trim().toLowerCase())
    .filter((provider) => STEP_UP_PROVIDERS.has(provider));
  return {
    providers: linked,
  };
}
