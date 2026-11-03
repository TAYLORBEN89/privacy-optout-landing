import { afterEach, describe, expect, it } from "vitest";
import { fieldErrorEvents, setAnalyticsSink, track } from "../src/analytics";

describe("analytics", () => {
  afterEach(() => {
    setAnalyticsSink(() => {});
  });

  it("records field codes and not messages or values", () => {
    const events = fieldErrorEvents({
      email: { code: "invalid", message: "bad-email@example.com was rejected" },
      firstName: { code: "required", message: "Enter your first name." },
    });
    expect(events).toEqual([
      { event: "field_error", field: "firstName", code: "required" },
      { event: "field_error", field: "email", code: "invalid" },
    ]);
    expect(JSON.stringify(events)).not.toContain("bad-email@example.com");
    expect(JSON.stringify(events)).not.toContain("message");
  });

  it("uses a no-op sink unless one is installed", () => {
    expect(() => track({ event: "form_started" })).not.toThrow();
    const seen: string[] = [];
    setAnalyticsSink((event) => {
      seen.push(event.event);
    });
    track({ event: "submitted" });
    expect(seen).toEqual(["submitted"]);
  });
});
