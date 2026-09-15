/**
 * Maak v2 brand system — inline SVG mark + lockup.
 *
 * The mark is a green "service tile": a rounded square holding a stylised
 * م (meem) whose tail resolves into a check — "with you, and done".
 * Drawn inline so it recolors with the surface it sits on (no raster blur,
 * no extra requests).
 */

type MarkProps = {
  size?: number;
  tile?: string;
  glyph?: string;
  className?: string;
};

export function MaakMark({ size = 30, tile, glyph, className }: MarkProps) {
  const tileColor = tile ?? "var(--mk-brand, #0e6b55)";
  const glyphColor = glyph ?? "#f4faf7";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      className={className}
      role="img"
      aria-label="Maak"
    >
      {/* service tile: rounded brand square */}
      <rect width="96" height="96" rx="26" fill={tileColor} />
      {/* speech card: "with you" */}
      <rect x="15" y="21" width="66" height="48" rx="18" fill={glyphColor} />
      <path d="M30 66 L30 82 L47 66 Z" fill={glyphColor} />
      {/* the job, done */}
      <polyline
        points="32,45 44,57 65,35"
        stroke={tileColor}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function MaakLockup({
  word,
  sub,
  markSize = 30,
  color,
}: {
  word: string;
  sub?: string;
  markSize?: number;
  color?: string;
}) {
  return (
    <span className="mk-brandline">
      <MaakMark size={markSize} />
      <span className="mk-wordmark" style={color ? { color } : undefined}>
        {word}
        {sub ? <small>{sub}</small> : null}
      </span>
    </span>
  );
}
