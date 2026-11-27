"use client";

export function PixelLogo({ className = "h-6 w-[104px] shrink-0" }: { className?: string }) {
  const P = 4;
  const O = "#ff6a00";
  const H = "#ff8a33";
  const W = "#e0e0e0";
  const D = "#333333";
  const G = "#00ff88";
  const C = "#00d4ff";

  // Pixel keyboard (left) + musical 8th-note & equalizer pulse (right)
  const pixels: [number, number, string][] = [
    // Keyboard chassis frame
    [0, 1, D], [1, 1, D], [2, 1, D], [3, 1, D], [4, 1, D], [5, 1, D], [6, 1, D], [7, 1, D], [8, 1, D], [9, 1, D], [10, 1, D], [11, 1, D],
    // Keys top row (with black keys)
    [0, 2, D], [1, 2, W], [2, 2, "#0a0a0a"], [3, 2, W], [4, 2, "#0a0a0a"], [5, 2, O], [6, 2, W], [7, 2, "#0a0a0a"], [8, 2, W], [9, 2, "#0a0a0a"], [10, 2, G], [11, 2, D],
    [0, 3, D], [1, 3, W], [2, 3, "#0a0a0a"], [3, 3, W], [4, 3, "#0a0a0a"], [5, 3, O], [6, 3, W], [7, 3, "#0a0a0a"], [8, 3, W], [9, 3, "#0a0a0a"], [10, 3, G], [11, 3, D],
    // Keys bottom row (white keys)
    [0, 4, D], [1, 4, W], [2, 4, W], [3, 4, W], [4, 4, W], [5, 4, H], [6, 4, W], [7, 4, W], [8, 4, W], [9, 4, W], [10, 4, G], [11, 4, D],
    [0, 5, D], [1, 5, D], [2, 5, D], [3, 5, D], [4, 5, D], [5, 5, D], [6, 5, D], [7, 5, D], [8, 5, D], [9, 5, D], [10, 5, D], [11, 5, D],
    // Musical beamed note + waveform
    [14, 1, O], [15, 1, O], [16, 1, O], [17, 1, O], [18, 1, H], [19, 1, H],
    [14, 2, O],                               [19, 2, O],
    [14, 3, O],                               [19, 3, O],
    [13, 4, O], [14, 4, H],       [18, 4, G], [19, 4, G],
    [13, 5, O], [14, 5, O],       [18, 5, G], [19, 5, G],
    // Equalizer bar on far right
    [22, 4, C], [22, 5, C],
    [24, 3, G], [24, 4, G], [24, 5, G],
  ];

  return (
    <svg
      viewBox="0 0 104 24"
      aria-hidden="true"
      className={className}
      style={{ imageRendering: "pixelated" }}
    >
      <g shapeRendering="crispEdges">
        {pixels.map(([c, r, color]) => (
          <rect key={`${c}-${r}`} x={c * P} y={r * P} width={P} height={P} fill={color} />
        ))}
        {/* Pulsing key indicator */}
        <rect x={5 * P} y={2 * P} width={P} height={3 * P} fill={O}>
          <animate attributeName="fill" values={`${O};#ffffff;${O}`} dur="1.6s" repeatCount="indefinite" />
        </rect>
      </g>
    </svg>
  );
}
