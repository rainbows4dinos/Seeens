// Rub-down wear on display headings (#62): like transfer lettering that's
// been handled. An SVG filter knocks out tiny specks and nudges edges a
// pixel or so, so letters sit a little unevenly. The text stays real text.
//
// - Which headings: big h1 and h2 (display-m and up), never one holding a
//   link or control, plus anything with the rub-down class. The CSS in
//   globals.css picks them, and picks one of these VARIANTS by where the
//   heading sits on the page, so each page wears the same way every visit.
//   (Not by script: marking headings after load clashed with hydration.)
// - Off for print, forced colors, and reduced motion (globals.css).

const VARIANTS = 4;

export function RubDown() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute">
      <defs>
        {Array.from({ length: VARIANTS }, (_, i) => (
          <filter key={i} id={`rub-${i}`} x="-2%" y="-10%" width="104%" height="120%" colorInterpolationFilters="sRGB">
            {/* Slow noise pushes edges around a little: uneven letters. */}
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={i + 1} result="warp" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warp"
              scale={1.2}
              xChannelSelector="R"
              yChannelSelector="G"
              result="worn"
            />
            {/* Fine noise, thresholded to sparse specks, knocked out of the ink. */}
            <feTurbulence type="fractalNoise" baseFrequency="0.38" numOctaves={1} seed={i + 11} result="grit" />
            <feColorMatrix
              in="grit"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  26 0 0 0 -19.1"
              result="specks"
            />
            <feComposite in="worn" in2="specks" operator="out" />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
