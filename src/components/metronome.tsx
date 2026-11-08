// The metronome (Figma: Elements / Metronome Loader): Seeens' busy sign, a
// nod to the studio Ataris and their busy bee. The dial swings 45° each way
// at 120 BPM; with reduced motion it holds still in the middle.
export function Metronome({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`metronome ${className}`}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="metronome-face"
        d="M27.4287 9L30 30V33H28V36H24V33H16V36H12V33H10V30L12.6592 9L13.1025 5H27L27.4287 9Z"
      />
      <path
        className="metronome-ink"
        d="M27.4287 9L30 30V33H20V32H29V30.5H11V32H20V33H10V30L12.6592 9L13.1025 5H27L27.4287 9ZM11.0713 29.5H28.9316L28.6865 27.5H11.3252L11.0713 29.5ZM20.501 26.5H28.5645L26.4824 9.5H20.543L20.501 26.5ZM11.4512 26.5H19.501L19.543 9.5H13.6045L11.4512 26.5ZM13.7207 8.5H26.3691L26.1016 6H13.998L13.7207 8.5ZM22 11.5V12.5H18V11.5H22ZM23 13.5V14.5H17V13.5H23ZM22 15.5V16.5H18V15.5H22ZM23 17.5V18.5H17V17.5H23ZM22 19.5V20.5H18V19.5H22ZM23 21.5V22.5H17V21.5H23ZM22 23.5V24.5H18V23.5H22ZM16 32V36H12V32H16ZM13 35H15V33H13V35ZM28 32V36H24V32H28ZM25 35H27V33H25V35ZM21 27C21 27.5523 20.5523 28 20 28C19.4477 28 19 27.5523 19 27C19 26.4477 19.4477 26 20 26C20.5523 26 21 26.4477 21 27Z"
      />
      <path
        className="metronome-ink metronome-dial"
        d="M20.5 9.5H21.6406L20.8906 12.5H20.5V27H19.5V12.5H19.1094L18.3594 9.5H19.5V7H20.5V9.5Z"
      />
    </svg>
  );
}

/**
 * A page or panel loading (Figma: Status & Info / Page Loader). When the
 * pointer metronome is showing, this one steps aside so only one ticks.
 */
export function PageLoader({ label = "loading" }: { label?: string }) {
  return (
    <div className="page-loader" role="status">
      <Metronome />
      <p className="page-loader-label">
        {label}
        <span className="page-loader-dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  );
}
