import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

/**
 * GrottoLogo — single-mark brand icon, no text.
 *
 * A smooth grotto mountain silhouette (evenodd arch cutout) with a small
 * mark inside the opening. One colour, works on any background.
 *
 * variant : 'dark'  → gold mark  (use on dark backgrounds)
 *           'light' → near-black (use on light backgrounds)
 *
 * mark    : 'house' → roof + walls + arched door  (default)
 *           'heart' → single heart path
 *           'paw'   → paw print (4 toes + pad)
 */

const GOLD  = '#C9A84C';
const DARK  = '#1C1917';

interface Props {
  size?:    number;
  variant?: 'dark' | 'light';
  mark?:    'house' | 'heart' | 'paw';
}

// ─── Geometry (100 × 100 viewBox) ────────────────────────────────────────────
//
// Mountain outer: smooth bezier dome, flat base at y=92, peak at (50,8)
// Arch hole:      center (50,72), r=16  → crown y=56, spring x=34..66
// House:          roof peak (50,64), eaves y=72, body to y=82, arched door r=3
// Heart:          bottom point (50,80), lobes to ~y=54
// Paw:            center pad cx=50 cy=75 r=6.5, four toes r=3.5

const MOUNTAIN =
  'M 2,92 C 2,78 6,56 14,44 C 22,32 32,14 50,8 C 68,14 78,32 86,44 C 94,56 98,78 98,92 L 2,92 Z ' +
  'M 34,92 L 34,72 A 16,16 0 0,0 66,72 L 66,92 Z';

const HOUSE =
  'M 41,72 L 50,63 L 59,72 ' +           // roof triangle
  'L 56,72 L 56,82 ' +                    // right wall down
  'L 53,82 L 53,77 A 3,3 0 0,0 47,77 L 47,82 ' + // arched door
  'L 44,82 L 44,72 Z';                    // left wall up

const HEART =
  'M 50,80 ' +
  'C 44,76 34,68 36,60 ' +   // down to left lobe
  'C 38,54 45,52 50,60 ' +   // over left bump → centre dip
  'C 55,52 62,54 64,60 ' +   // over right bump
  'C 66,68 56,76 50,80 Z';   // back to bottom point

export default function GrottoLogo({ size = 64, variant = 'dark', mark = 'house' }: Props) {
  const fg = variant === 'dark' ? GOLD : DARK;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">

      {/* Grotto mountain with transparent arch opening */}
      <Path d={MOUNTAIN} fill={fg} fillRule="evenodd" />

      {/* Mark floating inside the arch */}
      {mark === 'house' && (
        <Path d={HOUSE} fill={fg} />
      )}

      {mark === 'heart' && (
        <Path d={HEART} fill={fg} />
      )}

      {mark === 'paw' && (
        <>
          {/* Four toe pads */}
          <Circle cx={40} cy={64} r={3.5} fill={fg} />
          <Circle cx={47} cy={60} r={3.5} fill={fg} />
          <Circle cx={53} cy={60} r={3.5} fill={fg} />
          <Circle cx={60} cy={64} r={3.5} fill={fg} />
          {/* Central pad */}
          <Circle cx={50} cy={75} r={6.5} fill={fg} />
        </>
      )}

    </Svg>
  );
}
