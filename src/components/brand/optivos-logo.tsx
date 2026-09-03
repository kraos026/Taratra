import type { HTMLAttributes } from "react";

type OptivosLogoProps = HTMLAttributes<HTMLDivElement> & {
  compact?: boolean;
  subtitle?: string;
};

export function OptivosLogo({
  compact = false,
  subtitle,
  className = "",
  ...props
}: OptivosLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} {...props}>
      <span
        className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-blue-300/30 bg-[linear-gradient(145deg,#1677ff_0%,#3457e8_58%,#7657f6_100%)] text-white shadow-[0_12px_32px_rgba(37,99,235,0.35)]"
        aria-hidden="true"
      >
        <span className="absolute inset-px rounded-[13px] bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.38),transparent_38%)]" />
        <svg viewBox="0 0 32 32" className="relative size-7" fill="none">
          <path
            d="M25 16c0 5.2-3.8 9-9 9s-9-3.8-9-9 3.8-9 9-9"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="m15.5 17.2 3.1 3.1 7-8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24.5" cy="7.5" r="2.5" fill="#B9D8FF" />
        </svg>
      </span>
      {!compact ? (
        <span className="optivos-logo-copy min-w-0">
          <span className="block font-['Manrope'] text-[22px] leading-none font-extrabold tracking-[-0.04em] text-white">
            Optivos
          </span>
          {subtitle ? (
            <span className="mt-1.5 block text-[10px] font-bold tracking-[0.17em] text-slate-500 uppercase">
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
