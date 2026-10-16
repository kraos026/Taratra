/** Original lightweight characters. Decorative beside the visible agent name. */
export function AgentAvatar({ variant = 0, size = 48 }: { variant?: number; size?: number }) {
  const color = ["#93c5fd", "#c4b5fd", "#5eead4"][variant % 3];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <rect x="2" y="2" width="60" height="60" rx="20" fill={color} fillOpacity=".09" />
      <path d="M21 51c0-7 5-12 11-12s11 5 11 12" fill={color} fillOpacity=".5" />
      <rect x="16" y="16" width="32" height="28" rx={variant % 3 === 1 ? 9 : 14} fill={color} />
      <rect x="20" y="23" width="24" height="13" rx="6" fill="#172033" />
      <circle cx="27" cy="29" r="2" fill={color} />
      <circle cx="37" cy="29" r="2" fill={color} />
      <path d="M29 39h6M32 16v-5" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="10" r="3" fill={color} />
      {variant % 3 === 0 && (
        <path d="M13 25v9m38-9v9m-1-1v6h-7" stroke={color} strokeWidth="3" strokeLinecap="round" />
      )}
      {variant % 3 === 1 && <path d="m25 49 7-5 7 5-7 6-7-6Z" stroke={color} strokeWidth="2" />}
      {variant % 3 === 2 && (
        <path d="M22 26h8v7h-8zm12 0h8v7h-8zm-4 3h4" stroke={color} strokeWidth="1.5" />
      )}
    </svg>
  );
}
