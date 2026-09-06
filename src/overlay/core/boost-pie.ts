/**
 * ============================================================================
 * 🥧 Dual-Layer Boost Pie Geometry & Color Utilities
 * ============================================================================
 */

export interface BoostPieConfig {
  progress: number;
  rotation: number;
  outerGap: number;
  innerGap: number;
  syncGap: boolean;
  outerRadius: number;
  innerRadius: number;
  innerDynamic: boolean;
  enableBlink: boolean;
  colorCritical: string;
  colorBlink: string;
  colorLow: string;
  colorMid: string;
  colorHigh: string;
  colorFull: string;
}

export const DEFAULT_BOOST_PIE_CONFIG: BoostPieConfig = {
  progress: 77,
  rotation: 225,
  outerGap: 90,
  innerGap: 90,
  syncGap: true,
  outerRadius: 48,
  innerRadius: 26,
  innerDynamic: true,
  enableBlink: true,
  colorCritical: "#000000",
  colorBlink: "#ff4d4f",
  colorLow: "#ff4d4f",
  colorMid: "#faad14",
  colorHigh: "#52c41a",
  colorFull: "#1890ff"
};

export function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

export function createStrokeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  if (endAngle <= startAngle) return "";
  if (endAngle - startAngle >= 360) {
    endAngle = startAngle + 359.99;
  }
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, arcSweep, 0, end.x, end.y
  ].join(" ");
}

export function createPieSlice(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  if (endAngle <= startAngle) return "";
  if (endAngle - startAngle >= 360) {
    return `M ${x} ${y - radius} A ${radius} ${radius} 0 1 1 ${x - 0.01} ${y - radius} Z`;
  }
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", x, y,
    "L", start.x, start.y,
    "A", radius, radius, 0, arcSweep, 0, end.x, end.y,
    "Z"
  ].join(" ");
}

export function getBoostPieColorByValue(
  val: number,
  customProps?: any
): { type: "solid" | "blink"; color: string } {
  const enableBlink = customProps?.enableBlink !== false;
  const colCrit = customProps?.colorCritical || "#000000";
  const colBlink = customProps?.colorBlink || "#ff4d4f";
  const colLow = customProps?.colorLow || "#ff4d4f";
  const colMid = customProps?.colorMid || "#faad14";
  const colHigh = customProps?.colorHigh || "#52c41a";
  const colFull = customProps?.colorFull || "#1890ff";

  if (val < 12) return { type: "solid", color: colCrit };
  if (val < 24) return { type: enableBlink ? "blink" : "solid", color: colBlink };
  if (val < 36) return { type: "solid", color: colLow };
  if (val < 72) return { type: "solid", color: colMid };
  if (val < 96) return { type: "solid", color: colHigh };
  return { type: "solid", color: colFull };
}
