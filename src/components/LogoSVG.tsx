
interface LogoSVGProps {
  className?: string;
  size?: number;
}

export function LogoSVG({ className = "", size = 48 }: LogoSVGProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: "drop-shadow(0 4px 12px rgba(245, 158, 11, 0.3))" }}
    >
      <defs>
        {/* Luxury Brushed Gold Gradient */}
        <linearGradient id="luxury-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" /> {/* Yellow-300 */}
          <stop offset="30%" stopColor="#F59E0B" /> {/* Amber-500 */}
          <stop offset="70%" stopColor="#D97706" /> {/* Amber-600 */}
          <stop offset="100%" stopColor="#92400E" /> {/* Amber-800 */}
        </linearGradient>
        {/* Shimmer overlay for extra luster */}
        <linearGradient id="gold-shimmer" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* Stylized Luxury 2B-N Winged Trident Icon */}
      <g>
        {/* Left wing component */}
        <path
          d="M 50 85 C 38 72, 18 55, 18 36 C 18 24, 28 16, 35 25 C 41 33, 44 48, 50 58"
          fill="url(#luxury-gold)"
        />
        {/* Right wing component */}
        <path
          d="M 50 85 C 62 72, 82 55, 82 36 C 82 24, 72 16, 65 25 C 59 33, 56 48, 50 58"
          fill="url(#luxury-gold)"
        />
        {/* Center column/trident spear */}
        <path
          d="M 50 90 L 50 10 L 46 22 L 54 22 Z"
          fill="url(#luxury-gold)"
        />
        {/* Base foundation bracket */}
        <path
          d="M 32 62 L 50 74 L 68 62"
          stroke="url(#luxury-gold)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Highlight Shimmer overlay */}
        <path
          d="M 50 90 L 50 10 C 56 30, 82 40, 82 36 C 82 24, 72 16, 65 25 Z"
          fill="url(#gold-shimmer)"
          style={{ mixBlendMode: "overlay" }}
        />
      </g>
    </svg>
  );
}
