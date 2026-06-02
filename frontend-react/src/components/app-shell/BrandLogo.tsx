/**
 * BrandLogo — inline SVG mark + wordmark for Rectrace.
 *
 * Design: a stylized capital "R" whose leg extends past the baseline as a
 * trace line ending in a small filled dot. Reads as the letter "R" at first
 * glance; reveals a trace-probe metaphor on a closer look. The dot is the
 * single accent — everything else is monochrome foreground.
 *
 * Theming: strokes + wordmark inherit `currentColor` from the
 * `text-foreground` class on the SVG element. The trace-endpoint dot uses
 * the `--color-primary` token via `fill-primary`. Dark/light mode is
 * handled by the CSS cascade — no `useTheme` hook needed.
 *
 * Sizing: aspect ratio is 5:1. Caller sets height via className (e.g.
 * `h-6 w-auto` for navbar, `h-20 w-auto` for hero) and width scales.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 32"
      role="img"
      aria-label="Rectrace"
      fill="none"
      className={`text-foreground ${className ?? ''}`}
    >
      <title>Rectrace</title>
      {/* "R" mark — strokes inherit currentColor (foreground) */}
      <g
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Stem */}
        <path d="M 5 5 V 27" />
        {/* Top bar + bowl arc + lower edge back to stem */}
        <path d="M 5 5 H 15 a 7 7 0 0 1 0 14 H 5" />
        {/* Trace leg — exits the bowl junction down to the endpoint dot */}
        <path d="M 13 19 L 23.5 27" />
      </g>
      {/* Trace-endpoint accent — primary token */}
      <circle cx="23.75" cy="27" r="2.25" className="fill-primary" />
      {/* Wordmark — Geist Variable is shipped via @fontsource-variable */}
      <text
        x="36"
        y="23"
        fontFamily='"Geist Variable", system-ui, sans-serif'
        fontSize="19"
        fontWeight="600"
        letterSpacing="-0.4"
        fill="currentColor"
      >
        rectrace
      </text>
    </svg>
  )
}
