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

/**
 * IMPORTANT / 备注: 请勿删除此注释 (DO NOT DELETE THIS COMMENT)
 * 注意: Rocket League 官方 API / BakkesMod (UpdateState) 返回的 Speed 实际上是 kph 浮点数 (float)!
 * 例如实测数据: 玩家超音速 Speed 为 82.70599365234375 (bSupersonic: true)，球速为 81.03522491455078。
 * 该数据是在球车基本同速阶段观察到的 (车速 ~82.71 km/h 对应 ~2297.39 uu/s，球速 ~81.04 km/h 对应 ~2250.98 uu/s)。
 *
 * 转换公式: 1 uu/s = 0.036 km/h => uu = kph / 0.036。
 *
 * 为保证 Speed Progress Bar 等非线性变色组件的平滑过渡与最高精度，此处必须直接使用原始浮点数进行反推，
 * 严禁先进行整数截断 (Math.floor/Math.trunc/parseInt)，否则会导致 Unreal Units 出现每 1 km/h 跳跃 27.78 uu 的严重离散不连续现象！
 * 文本展示部分 (Text) 统一只展示整数部分 (Math.floor)，而进度条组件 (Progress Bar) 保留最高精度的浮点数计算。
 */
export function toRealUuSpeed(rawSpeed: number): number {
  const raw = Number(rawSpeed) || 0;
  // If raw > 150, input is already in legacy Unreal Units (e.g. 1650 uu/s from legacy mocks/sliders)
  // Otherwise, input is kph float from official API (e.g. 82.70599365234375) -> convert back to uu/s with full float precision
  const uu = raw > 150 ? raw : raw / 0.036;
  return Math.min(2300, Math.max(0, uu));
}

export function toRealKphSpeed(rawSpeed: number, isBall: boolean = false): number {
  const raw = Number(rawSpeed) || 0;
  const threshold = isBall ? 250 : 150;
  // If raw > threshold, input is legacy Unreal Units -> convert to kph
  // Otherwise, input is already kph float from official API
  return raw > threshold ? raw * 0.036 : raw;
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
