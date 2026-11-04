// Brand mark — Career Reef: an orange reef fish on deep-sea teal over sand.
// Matches the favicon (src/app/icon.svg) one-for-one. The component keeps its
// old name so every caller stays unchanged.
export function CoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className="inline-block shrink-0"
    >
      <rect width="96" height="96" rx="20" fill="#0a7194" />
      <path d="M0 70 Q24 62 48 70 T96 70 V96 H0 Z" fill="#e8cf95" />
      <path d="M14 76 Q12 62 18 54" stroke="#3ea35e" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M82 78 Q86 64 80 56" stroke="#2f8a4e" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M26 40 L12 28 L12 52 Z" fill="#ff8a3d" />
      <ellipse cx="50" cy="40" rx="26" ry="18" fill="#ff8a3d" />
      <path d="M42 22 Q50 13 59 23" fill="#ffb37a" />
      <circle cx="63" cy="35" r="7.5" fill="#fff" />
      <circle cx="65" cy="35" r="3.8" fill="#0d2a3a" />
      <path d="M64 47 Q69 49 72 45" stroke="#0d2a3a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
