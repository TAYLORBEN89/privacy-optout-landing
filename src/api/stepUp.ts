/** HTTP 403 whose JSON body is exactly { "error": "step_up_required" }. */
export function isStepUpRequired(status: number, body: unknown): boolean {
  if (status !== 403 || !body || typeof body !== "object" || Array.isArray(body)) return false;
  return (body as { error?: unknown }).error === "step_up_required";
}

export interface StepUpStart {
  url: string;
}

export interface StepUpChoices {
  providers: string[];
  offerPassword: boolean;
  needsAnotherMethod: boolean;
}

/** Providers that can confirm the user, excluding Apple. Password is a separate option. */
export function stepUpChoices(
  providers: { provider: string }[] | null | undefined,
  hasPassword: boolean,
): StepUpChoices {
  const linked = (providers ?? []).map((item) => item.provider.trim()).filter((provider) => provider.length > 0);
  const usable = linked.filter((provider) => provider.toLowerCase() !== "apple");
  const onlyApple = linked.length > 0 && linked.every((provider) => provider.toLowerCase() === "apple");
  return {
    providers: usable,
    offerPassword: hasPassword,
    needsAnotherMethod: onlyApple && !hasPassword,
  };
}
