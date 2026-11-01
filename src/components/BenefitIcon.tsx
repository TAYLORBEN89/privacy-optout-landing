// One outline in the card color, one gold detail inside it. The two strokes do not meet.

const STROKE = 1.5;
const ACCENT = "#e39b14";

const ICONS: Record<string, { color: string; accent: string; outline: string[]; detail: string[] }> = {
  overview: {
    color: "#ee0014",
    accent: ACCENT,
    outline: ["M7.7 7.5h8.6a4.5 4.5 0 0 1 0 9H7.7a4.5 4.5 0 0 1 0-9z"],
    detail: ["M16.55 12a1.45 1.45 0 1 1-2.9 0 1.45 1.45 0 0 1 2.9 0"],
  },
  "how-drop-works": {
    color: "#056cb8",
    accent: ACCENT,
    outline: [
      "M4.2 7h15.6a1.4 1.4 0 0 1 1.4 1.4v8.2a1.4 1.4 0 0 1-1.4 1.4H4.2a1.4 1.4 0 0 1-1.4-1.4V8.4A1.4 1.4 0 0 1 4.2 7z",
    ],
    detail: ["M6.8 9.6 12 13.4 17.2 9.6"],
  },
  "personal-information": {
    color: "#1c8a4a",
    accent: ACCENT,
    outline: ["M12 3.5 19.2 6.2v5.8c0 4-3 6.8-7.2 8.5-4.2-1.7-7.2-4.5-7.2-8.5V6.2L12 3.5z"],
    detail: ["M9.5 12.2 11.2 14 14.7 10.1"],
  },
  "data-brokers": {
    color: "#b8860b",
    accent: "#056cb8",
    outline: ["M19.6 12a7.6 7.6 0 1 1-15.2 0 7.6 7.6 0 0 1 15.2 0"],
    detail: ["M12 12V7.6", "M12 12l2.8 2.2"],
  },
  "unique-identifiers": {
    color: "#0d7a72",
    accent: ACCENT,
    outline: ["M5.4 8h8.2l4.6 4-4.6 4H5.4a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5.4 8z"],
    detail: ["M9.35 12a1.05 1.05 0 1 1-2.1 0 1.05 1.05 0 0 1 2.1 0"],
  },
  tdpsa: {
    color: "#9f1239",
    accent: ACCENT,
    outline: [
      "M7.6 4h6.2L18.4 8.4V19.2a1.5 1.5 0 0 1-1.5 1.5H7.6a1.5 1.5 0 0 1-1.5-1.5V5.5A1.5 1.5 0 0 1 7.6 4z",
      "M13.8 4v4.4H18.4",
    ],
    detail: ["M12 12.35 12.51 13.7 13.95 13.77 12.82 14.67 13.2 16.06 12 15.26 10.8 16.06 11.18 14.67 10.05 13.77 11.49 13.7Z"],
  },
  children: {
    color: "#6d28d9",
    accent: ACCENT,
    outline: ["M4.6 11.4 12 4.8 19.4 11.4V19a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4V11.4z"],
    detail: [
      "M13.2 12.6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0",
      "M9.7 17.8c.45-1.5 1.25-2.2 2.3-2.2s1.85.7 2.3 2.2",
    ],
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
