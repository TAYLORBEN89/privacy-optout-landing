function Mark({ size }: { size: number }) {
  return (
    <svg className="mark" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#ee0014" />
      <path
        fill="#ffffff"
        d="M11.2 14.2V11.6a4.8 4.8 0 0 1 9.6 0v2.6h-2.4V11.6a2.4 2.4 0 0 0-4.8 0v2.6h-2.4z"
      />
      <rect x="8" y="14" width="16" height="12" rx="2" fill="#ffffff" />
    </svg>
  );
}

export function Wordmark({ header = false }: { header?: boolean }) {
  if (header) {
    return (
      <div className="brand-lockup">
        <Mark size={36} />
        <div className="brand-text">
          <p className="brand" aria-label="DROP Texas">
            <span>DROP Texas</span>
          </p>
          <p className="tagline">Demanding privacy for the people, by the people</p>
        </div>
      </div>
    );
  }

  return (
    <p className="brand">
      <Mark size={28} />
      <span>DROP Texas</span>
    </p>
  );
}

export function UserGlyph() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <circle cx="16" cy="11" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 26c1.6-4.2 4.8-6 9-6s7.4 1.8 9 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SmallLock() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 7V5.2a3 3 0 0 1 6 0V7h.6A1.4 1.4 0 0 1 13 8.4v5.2A1.4 1.4 0 0 1 11.6 15H4.4A1.4 1.4 0 0 1 3 13.6V8.4A1.4 1.4 0 0 1 4.4 7H5zm1.2 0h3.6V5.2a1.8 1.8 0 0 0-3.6 0V7z"
      />
    </svg>
  );
}
