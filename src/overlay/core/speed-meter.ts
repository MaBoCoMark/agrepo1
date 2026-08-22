/**
 * ============================================================================
 * 🏎️ Speed Meter Non-Linear Calculation & Color Engine
 * ============================================================================
 *
 * Physics / Game constants:
 * - 0 to 1410 uu/s: Low speed zone (ground driving speed limit without boost)
 * - 1410 to 2200 uu/s: Mid speed transition zone (boosting / dodging)
 * - 2200 to 2300 uu/s: Supersonic zone (2200 threshold, 2300 absolute max)
 *
 * Non-linear progress mapping:
 * - 1410 speed position is customizable between 10% and 60% (default 40%).
 * - Supersonic (2200 uu/s) marker is fixed at 85%.
 * - 2200-2300 uu/s zone is fixed at the last 15% (85% to 100%).
 *
 * Color dynamics:
 * - 3 user-customizable colors:
 *     1. colorLow: Low speed zone solid color (default #d4af37)
 *     2. colorMidStart: Mid speed start color at 1410 uu/s (default #77ca7a)
 *     3. colorMidEnd: Mid speed end color at 2200 uu/s (default #59f168)
 * - Supersonic color is non-customizable: fixed #a020f0 with purple heartbeat animation.
 * ============================================================================
 */

export function hexToRgb(hex: string): [number, number, number] {
  if (!hex) return [212, 175, 55];
  let clean = hex.trim();
  if (clean.startsWith('#')) clean = clean.slice(1);
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const bigint = parseInt(clean, 16);
  if (isNaN(bigint)) return [212, 175, 55];
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export function interpolateRgb(
  startRgb: [number, number, number],
  endRgb: [number, number, number],
  ratio: number
): string {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const r = Math.round(startRgb[0] + (endRgb[0] - startRgb[0]) * clampedRatio);
  const g = Math.round(startRgb[1] + (endRgb[1] - startRgb[1]) * clampedRatio);
  const b = Math.round(startRgb[2] + (endRgb[2] - startRgb[2]) * clampedRatio);
  return `rgb(${r}, ${g}, ${b})`;
}

export function toRealUuSpeed(rawSpeed: number): number {
  // Real unit of speed is uu/s (0 - 2300). If rawSpeed is in KPH (<= 150), convert to uu/s.
  const uu = rawSpeed > 150 ? rawSpeed : rawSpeed / 0.036;
  return Math.min(2300, Math.max(0, uu));
}

export function calcNonlinearSpeedProgress(uuSpeed: number, split1410Pos: number = 40): number {
  const v = Math.min(2300, Math.max(0, uuSpeed));
  const split = Math.max(10, Math.min(60, Number(split1410Pos) || 40));
  let p = 0;
  if (v <= 1410) {
    p = (v / 1410) * split;
  } else if (v <= 2200) {
    p = split + ((v - 1410) / (2200 - 1410)) * (85 - split);
  } else {
    p = 85 + ((v - 2200) / (2300 - 2200)) * 15;
  }
  return Math.min(100, Math.max(0, p));
}

export function calcSpeedColor(
  uuSpeed: number,
  colorLow: string = '#d4af37',
  colorMidStart: string = '#77ca7a',
  colorMidEnd: string = '#59f168'
): { color: string; isSupersonic: boolean } {
  if (uuSpeed >= 2200) {
    return { color: '#a020f0', isSupersonic: true };
  }
  if (uuSpeed <= 1410) {
    return { color: colorLow || '#d4af37', isSupersonic: false };
  }
  const ratio = (uuSpeed - 1410) / (2200 - 1410);
  const rgbStart = hexToRgb(colorMidStart || '#77ca7a');
  const rgbEnd = hexToRgb(colorMidEnd || '#59f168');
  const currentColor = interpolateRgb(rgbStart, rgbEnd, ratio);
  return { color: currentColor, isSupersonic: false };
}
