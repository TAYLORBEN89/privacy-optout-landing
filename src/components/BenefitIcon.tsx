// Thin product-icon line. The gold mark sits inside the outline and does not meet it.

const STROKE = 0.9;
const ACCENT = "#e39b14";

const ICONS: Record<string, { color: string; accent: string; outline: string[]; detail: string[] }> = {
  overview: {
    color: "#ee0014",
    accent: ACCENT,
    outline: [
      "M15.2 8.4a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0",
      "M12 11.6v7",
      "M12 15.2h2.5",
      "M12 17.6h2.1",
    ],
    detail: ["M13.35 8.4a1.35 1.35 0 1 1-2.7 0 1.35 1.35 0 0 1 2.7 0"],
  },
  "how-drop-works": {
    color: "#056cb8",
    accent: ACCENT,
    outline: [
      "M4.4 7.2h15.2a1.3 1.3 0 0 1 1.3 1.3v7.6a1.3 1.3 0 0 1-1.3 1.3H4.4a1.3 1.3 0 0 1-1.3-1.3V8.5a1.3 1.3 0 0 1 1.3-1.3z",
    ],
    detail: ["M7.2 11.4c1.2-1.3 1.7.9 2.8 0s1.4 1.2 2.6.1 1.5 1 2.6-.1"],
  },
  "personal-information": {
    color: "#1c8a4a",
    accent: ACCENT,
    outline: [
      "M8 11.2h8a1.5 1.5 0 0 1 1.5 1.5v5.2a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5v-5.2a1.5 1.5 0 0 1 1.5-1.5z",
      "M9.2 11.2V8.5a2.8 2.8 0 0 1 5.6 0v2.7",
    ],
    detail: ["M12.9 14.3a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0", "M12 15.3v1.5"],
  },
  "data-brokers": {
    color: "#b8860b",
    accent: "#056cb8",
    outline: [
      "M7.6 4.8h8.8",
      "M7.6 19.2h8.8",
      "M7.6 4.8c.3 3.7 4.4 4.7 4.4 7.2s-4.1 3.5-4.4 7.2",
      "M16.4 4.8c-.3 3.7-4.4 4.7-4.4 7.2s4.1 3.5 4.4 7.2",
    ],
    detail: ["M10.5 16.4c.45 1 2.55 1 3 0"],
  },
  "unique-identifiers": {
    color: "#0d7a72",
    accent: ACCENT,
    outline: ["M19.4 12a7.4 7.4 0 1 1-14.8 0 7.4 7.4 0 0 1 14.8 0"],
    detail: [
      "M10.65 10.6a.32.32 0 1 1-.64 0 .32.32 0 0 1 .64 0",
      "M14.25 10.6a.32.32 0 1 1-.64 0 .32.32 0 0 1 .64 0",
      "M9.9 12.6c.7 1.3 3.5 1.3 4.2 0",
    ],
  },
  tdpsa: {
    color: "#9f1239",
    accent: ACCENT,
    outline: [
      "M7.4 4.2h6.4l4.6 4.4V19.4a1.4 1.4 0 0 1-1.4 1.4H7.4a1.4 1.4 0 0 1-1.4-1.4V5.6a1.4 1.4 0 0 1 1.4-1.4z",
      "M13.8 4.2V8.6h4.6",
    ],
    detail: ["M8.2 14.6c1.2-1.6 1.8.8 3-.2 1.1-1 1.4 1 2.7-.1 1.2-1 1.6.8 2.5 0"],
  },
  children: {
    color: "#6d28d9",
    accent: ACCENT,
    outline: ["M4.8 13.2a7.2 7.2 0 0 1 14.4 0", "M12 13.2v5.4", "M12 18.6c0 1.3 1.7 1.3 1.7 0"],
    detail: ["M6.5 16.3c0-.8.6-1.35 1.3-1.35.4 0 .75.25 1 .6.25-.35.6-.6 1-.6.7 0 1.3.55 1.3 1.35 0 1-1.15 1.75-2.3 1.75s-2.3-.75-2.3-1.75z"],
  },
};

export function BenefitIcon({ id }: { id: string }) {
  const icon = ICONS[id] ?? ICONS.overview;
  return (
    <svg
      className={`tile-icon benefit-icon icon-${id}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={48}
      height={48}
      fill="none"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g stroke={icon.color}>
        {icon.outline.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke={icon.accent}>
        {icon.detail.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
