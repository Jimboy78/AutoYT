import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-8 w-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id="autoyt-mark" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff2e63" />
          <stop offset="1" stopColor="#ff9f1c" />
        </linearGradient>
      </defs>
      <rect x="2" y="7" width="42" height="36" rx="11" fill="url(#autoyt-mark)" />
      <g fill="#fff" opacity="0.6">
        <rect x="8" y="22" width="3" height="6" rx="1.5" />
        <rect x="13" y="18.5" width="3" height="13" rx="1.5" />
      </g>
      <path d="M20 16.5v17l13.5-8.5z" fill="#fff" />
      <path
        d="M40 1.5l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"
        fill="#fff"
        stroke="#0a0a12"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-2xl leading-none tracking-wide">
        AUTO<span className="text-gradient">YT</span>
      </span>
    </span>
  );
}
