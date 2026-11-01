/**
 * @vitest-environment happy-dom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Reveal } from "../src/components/Reveal";
import { HomePage } from "../src/pages/HomePage";

afterEach(() => {
  cleanup();
});

describe("hero visibility", () => {
  it("does not hide the hero on mount", () => {
    render(<HomePage getStartedHref="/start" />);
    const title = document.getElementById("page-title");
    expect(title?.textContent).toContain("Privacy is a right.");
    expect(title?.closest(".reveal")).toBeNull();
    expect(title?.closest(".is-waiting")).toBeNull();
    expect(getComputedStyle(title as HTMLElement).color).not.toBe("transparent");
  });

  it("starts reveal sections visible before an observer runs", () => {
    const { container } = render(
      <Reveal>
        <p>Section copy</p>
      </Reveal>,
    );
    const node = container.querySelector(".reveal");
    expect(node?.className).toContain("is-in");
    expect(node?.className).not.toContain("is-waiting");
  });
});
