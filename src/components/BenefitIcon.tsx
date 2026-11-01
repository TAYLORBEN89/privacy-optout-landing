// Two strokes of different colors stay apart. Round caps must not close the gap.

const STROKE = 1.25;

const ICONS: Record<string, { a: string; b: string; pathsA: string[]; pathsB: string[] }> = {
  overview: {
    a: "#ee0014",
    b: "#056cb8",
    pathsA: ["M3.2 7.6H10.2", "M4.4 12H11", "M3.2 16.4H8"],
    pathsB: ["M14.51 10.1A3.8 3.8 0 1 1 14.51 13.9", "M17.8 4.6v1.6", "M18.4 12a.6.6 0 1 1-1.2 0 .6.6 0 0 1 1.2 0"],
  },
  "how-drop-works": {
    a: "#056cb8",
    b: "#ee0014",
    pathsA: ["M4.4 8.4H12.2Q14.4 8.4 14.4 10.6V13.4Q14.4 15.4 12.2 15.4H8L5.6 17.8V15.4Q4.4 15.4 4.4 13.6V10.4Q4.4 8.4 6.2 8.4"],
    pathsB: ["M17.8 8.8 21.2 12.6", "M21.2 8.8 17.8 12.6"],
  },
  "personal-information": {
    a: "#1c8a4a",
    b: "#b8860b",
    pathsA: ["M12 3.6 18.8 6.3v5.4c0 3.7-2.7 6.4-6.8 8-4.1-1.6-6.8-4.3-6.8-8V6.3L12 3.6z"],
    pathsB: ["M9.4 12.2 11.2 14.1 14.8 10"],
  },
  "data-brokers": {
    a: "#b8860b",
    b: "#056cb8",
    pathsA: ["M16.5 6.64A7 7 0 1 0 18.58 14.39"],
    pathsB: ["M12 12V8.2", "M12 12l3.2 1.6"],
  },
  "unique-identifiers": {
    a: "#0d7a72",
    b: "#b8860b",
    pathsA: ["M11.97 9.36A4.6 4.6 0 1 0 11.97 14.64"],
    pathsB: ["M18.01 9.84A2.3 2.3 0 1 0 19.59 9.84"],
  },
  tdpsa: {
    a: "#9f1239",
    b: "#056cb8",
    pathsA: [
      "M8.2 6.8 9.43 10.3 13.15 10.39 10.2 12.65 11.26 16.21 8.2 14.1 5.14 16.21 6.2 12.65 3.25 10.39 6.97 10.3Z",
    ],
    pathsB: ["M17.1 12.4 18.6 14.1 21.5 10.4"],
  },
  children: {
    a: "#6d28d9",
    b: "#ee0014",
    pathsA: ["M14.3 11a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1 4.6 0", "M8.4 18.8c.8-2.4 2.2-3.6 3.6-3.6s2.8 1.2 3.6 3.6"],
    pathsB: ["M5 9Q12 1.2 19 9"],
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
      <g stroke={icon.a}>
        {icon.pathsA.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke={icon.b}>
        {icon.pathsB.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
