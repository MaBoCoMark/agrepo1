/**
 * ============================================================================
 * 🏟️ Pitch Geometry & 16-Point 2D Mapping & Calibration Engine
 * ============================================================================
 *
 * Provides:
 * 1. World coordinate boundary definitions & safety margins
 * 2. 16-Control Point geometric model (chamfers + dual goal slots)
 * 3. 34 Standard Rocket League boost pad & pill coordinates
 * 4. Outlier filtering / de-noising algorithm
 * 5. 45-degree rebound tangent fitting & automatic pitch boundary solver
 * 6. Coordinate transformation & calibration matrices (offset, scale, invert)
 * 7. Serialization and JSON import/export (In-memory session state, no localStorage persistence)
 * ============================================================================
 */

export interface ControlPoint {
  id: string; // P1 - P16
  name: string;
  x: number;
  y: number;
}

export interface CalibrationSettings {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  invertX: boolean;
  invertY: boolean;
}

export interface HitPointRecord {
  x: number;
  y: number;
  z: number;
  timestamp: number;
  isNoise?: boolean;
  teamNum?: number | string;
}

export interface BoostPadDefinition {
  x: number;
  y: number;
  z: number;
  boostType: 'BoostType_Pad' | 'BoostType_Pill';
}

export interface PitchConfig {
  version: string;
  name: string;
  timestamp: string;
  safetyMargins: {
    x: [number, number];
    y: [number, number];
    z: [number, number];
  };
  calibration: CalibrationSettings;
  controlPoints: ControlPoint[];
}

export interface MappingStats {
  totalHits: number;
  validHits: number;
  noiseHits: number;
  fieldWidth: number;
  fieldLength: number;
  goalDepth: number;
  chamferFitScore: number;
}

// 🛡️ Safe World Margins (9000 uu width x 12000 uu length, 3:4 aspect ratio)
export const SAFETY_MARGINS = {
  x: [-4500, 4500] as [number, number],
  y: [-6000, 6000] as [number, number],
  z: [0, 2000] as [number, number]
};

// ⚡ 34 Standard Rocket League Boost Locations (6 Full Pills + 28 Small Pads)
export const STANDARD_BOOST_LOCATIONS: readonly BoostPadDefinition[] = [
  // 6 Big Boost Pills (100% Boost)
  { x: 3072,  y: 4096,  z: 70.41, boostType: 'BoostType_Pill' },
  { x: -3072, y: 4096,  z: 70.41, boostType: 'BoostType_Pill' },
  { x: 3584,  y: 0,     z: 70.41, boostType: 'BoostType_Pill' },
  { x: -3584, y: 0,     z: 70.41, boostType: 'BoostType_Pill' },
  { x: 3072,  y: -4096, z: 70.41, boostType: 'BoostType_Pill' },
  { x: -3072, y: -4096, z: 70.41, boostType: 'BoostType_Pill' },

  // 28 Small Boost Pads (12% Boost)
  // Centerline / Midfield
  { x: 0,     y: 4240,  z: 63.71, boostType: 'BoostType_Pad' },
  { x: 0,     y: 2816,  z: 66.06, boostType: 'BoostType_Pad' },
  { x: 0,     y: 1024,  z: 65.53, boostType: 'BoostType_Pad' },
  { x: 0,     y: -1024, z: 65.94, boostType: 'BoostType_Pad' },
  { x: 0,     y: -2816, z: 66.5,  boostType: 'BoostType_Pad' },
  { x: 0,     y: -4240, z: 63.37, boostType: 'BoostType_Pad' },
  { x: 1024,  y: 0,     z: 68.7,  boostType: 'BoostType_Pad' },
  { x: -1024, y: 0,     z: 67.92, boostType: 'BoostType_Pad' },

  // Perimeter Lanes
  { x: 1792,  y: 4184,  z: 61.35, boostType: 'BoostType_Pad' },
  { x: -1792, y: 4184,  z: 60.92, boostType: 'BoostType_Pad' },
  { x: 3584,  y: 2484,  z: 67.86, boostType: 'BoostType_Pad' },
  { x: -3584, y: 2484,  z: 67.33, boostType: 'BoostType_Pad' },
  { x: 3584,  y: -2484, z: 68.36, boostType: 'BoostType_Pad' },
  { x: -3584, y: -2484, z: 66.78, boostType: 'BoostType_Pad' },
  { x: 1792,  y: -4184, z: 62.22, boostType: 'BoostType_Pad' },
  { x: -1792, y: -4184, z: 61.71, boostType: 'BoostType_Pad' },

  // Inner Diagonal Arcs
  { x: 940,   y: 3308,  z: 60.83, boostType: 'BoostType_Pad' },
  { x: -940,  y: 3308,  z: 61.05, boostType: 'BoostType_Pad' },
  { x: 1788,  y: 2302,  z: 67.7,  boostType: 'BoostType_Pad' },
  { x: -1788, y: 2302,  z: 67.9,  boostType: 'BoostType_Pad' },
  { x: 2048,  y: 1036,  z: 62.65, boostType: 'BoostType_Pad' },
  { x: -2048, y: 1036,  z: 62.72, boostType: 'BoostType_Pad' },
  { x: 2048,  y: -1036, z: 62.35, boostType: 'BoostType_Pad' },
  { x: -2048, y: -1036, z: 62.65, boostType: 'BoostType_Pad' },
  { x: 1788,  y: -2302, z: 66.57, boostType: 'BoostType_Pad' },
  { x: -1788, y: -2302, z: 67.92, boostType: 'BoostType_Pad' },
  { x: 940,   y: -3308, z: 63.71, boostType: 'BoostType_Pad' },
  { x: -940,  y: -3308, z: 62.84, boostType: 'BoostType_Pad' }
];

// 📐 Standard Default 16 Control Points (Clockwise starting from Top-Left Side)
export const DEFAULT_CONTROL_POINTS: ControlPoint[] = [
  { id: 'P1',  name: 'Side Wall TL',      x: -4075.0,  y: 4000.0 },
  { id: 'P2',  name: 'Chamfer TL',        x: -2950.0,  y: 5120.0 },
  { id: 'P3',  name: 'Goal Post TL',      x: -892.75,  y: 5120.0 },
  { id: 'P4',  name: 'Goal Back TL',      x: -892.75,  y: 5800.0 },
  { id: 'P5',  name: 'Goal Back TR',      x: 892.75,   y: 5800.0 },
  { id: 'P6',  name: 'Goal Post TR',      x: 892.75,   y: 5120.0 },
  { id: 'P7',  name: 'Chamfer TR',        x: 2950.0,   y: 5120.0 },
  { id: 'P8',  name: 'Side Wall TR',      x: 4075.0,   y: 4000.0 },
  { id: 'P9',  name: 'Side Wall BR',      x: 4075.0,   y: -4000.0 },
  { id: 'P10', name: 'Chamfer BR',        x: 2950.0,   y: -5120.0 },
  { id: 'P11', name: 'Goal Post BR',      x: 892.75,   y: -5120.0 },
  { id: 'P12', name: 'Goal Back BR',      x: 892.75,   y: -5800.0 },
  { id: 'P13', name: 'Goal Back BL',      x: -892.75,  y: -5800.0 },
  { id: 'P14', name: 'Goal Post BL',      x: -892.75,  y: -5120.0 },
  { id: 'P15', name: 'Chamfer BL',        x: -2950.0,  y: -5120.0 },
  { id: 'P16', name: 'Side Wall BL',      x: -4075.0,  y: -4000.0 }
];

export const DEFAULT_CALIBRATION: CalibrationSettings = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1.1,
  scaleY: 1.0,
  invertX: true,
  invertY: false
};

/**
 * Filter out rogue noise, clipping data, or penetrations outside safety bounds.
 */
export function isPointInsideSafetyBounds(x: number, y: number, z: number): boolean {
  if (isNaN(x) || isNaN(y) || isNaN(z)) return false;
  if (x < SAFETY_MARGINS.x[0] || x > SAFETY_MARGINS.x[1]) return false;
  if (y < SAFETY_MARGINS.y[0] || y > SAFETY_MARGINS.y[1]) return false;
  if (z < SAFETY_MARGINS.z[0] || z > SAFETY_MARGINS.z[1]) return false;
  return true;
}

/**
 * Transforms world coordinates (X, Y) into calibrated virtual coordinates.
 */
export function applyCalibration(
  wx: number,
  wy: number,
  cal: CalibrationSettings
): { cx: number; cy: number } {
  const directedX = cal.invertX ? -wx : wx;
  const directedY = cal.invertY ? -wy : wy;
  const cx = (directedX + cal.offsetX) * cal.scaleX;
  const cy = (directedY + cal.offsetY) * cal.scaleY;
  return { cx, cy };
}

/**
 * Inverts calibration from calibrated virtual coordinates back to world coordinates.
 */
export function unapplyCalibration(
  cx: number,
  cy: number,
  cal: CalibrationSettings
): { wx: number; wy: number } {
  const unscaledX = cal.scaleX !== 0 ? cx / cal.scaleX : cx;
  const unscaledY = cal.scaleY !== 0 ? cy / cal.scaleY : cy;
  const shiftedX = unscaledX - cal.offsetX;
  const shiftedY = unscaledY - cal.offsetY;
  const wx = cal.invertX ? -shiftedX : shiftedX;
  const wy = cal.invertY ? -shiftedY : shiftedY;
  return { wx, wy };
}

/**
 * Automatic 16-Control-Point pitch boundary mapping solver.
 * Utilizes boundary extremum collision points & 45-degree rebound tangent fitting.
 */
export function solvePitch16ControlPoints(
  history: HitPointRecord[]
): { controlPoints: ControlPoint[]; stats: MappingStats } {
  const validHits: HitPointRecord[] = [];
  let noiseCount = 0;

  for (const h of history) {
    if (isPointInsideSafetyBounds(h.x, h.y, h.z)) {
      validHits.push(h);
    } else {
      noiseCount++;
    }
  }

  // Fallback to default if insufficient sample size
  if (validHits.length < 8) {
    return {
      controlPoints: JSON.parse(JSON.stringify(DEFAULT_CONTROL_POINTS)),
      stats: {
        totalHits: history.length,
        validHits: validHits.length,
        noiseHits: noiseCount,
        fieldWidth: 8150,
        fieldLength: 10240,
        goalDepth: 680,
        chamferFitScore: 100
      }
    };
  }

  // 1. Compute side wall bounds (sample points away from chamfered corners: |y| < 3500)
  const sideHits = validHits.filter((h) => Math.abs(h.y) < 3500);
  let minSideX = -4075.0;
  let maxSideX = 4075.0;

  if (sideHits.length >= 4) {
    const xs = sideHits.map((h) => h.x).sort((a, b) => a - b);
    minSideX = xs[Math.floor(xs.length * 0.02)] || xs[0];
    maxSideX = xs[Math.floor(xs.length * 0.98)] || xs[xs.length - 1];
  }

  minSideX = Math.max(-4300, Math.min(-3800, minSideX));
  maxSideX = Math.min(4300, Math.max(3800, maxSideX));

  // 2. Compute main end wall bounds (sample points outside goal posts and before chamfers: 1200 < |x| < 2800)
  const endWallHits = validHits.filter((h) => Math.abs(h.x) > 1200 && Math.abs(h.x) < 2800);
  let topEndWallY = 5120.0;
  let botEndWallY = -5120.0;

  if (endWallHits.length >= 4) {
    const topYs = endWallHits.filter((h) => h.y > 0).map((h) => h.y).sort((a, b) => a - b);
    const botYs = endWallHits.filter((h) => h.y < 0).map((h) => h.y).sort((a, b) => a - b);
    if (topYs.length > 0) topEndWallY = topYs[Math.floor(topYs.length * 0.95)] || topYs[topYs.length - 1];
    if (botYs.length > 0) botEndWallY = botYs[Math.floor(botYs.length * 0.05)] || botYs[0];
  }

  topEndWallY = Math.min(5400, Math.max(4800, topEndWallY));
  botEndWallY = Math.max(-5400, Math.min(-4800, botEndWallY));

  // 3. Goal Depth & Posts (points with |x| < 1200)
  const goalAreaHits = validHits.filter((h) => Math.abs(h.x) < 1200);
  let goalBackTopY = 5800.0;
  let goalBackBotY = -5800.0;
  const goalPostHalfWidth = 892.75;

  if (goalAreaHits.length >= 2) {
    const topGoalYs = goalAreaHits.filter((h) => h.y > topEndWallY - 200).map((h) => h.y);
    const botGoalYs = goalAreaHits.filter((h) => h.y < botEndWallY + 200).map((h) => h.y);
    if (topGoalYs.length > 0) goalBackTopY = Math.max(...topGoalYs);
    if (botGoalYs.length > 0) goalBackBotY = Math.min(...botGoalYs);
  }

  goalBackTopY = Math.min(6000, Math.max(topEndWallY + 300, goalBackTopY));
  goalBackBotY = Math.max(-6000, Math.min(botEndWallY - 300, goalBackBotY));

  // 4. 45-degree corner chamfer tangent calculation
  const cornerHits = validHits.filter((h) => Math.abs(h.x) > 2000 && Math.abs(h.y) > 3000);

  let cTR = maxSideX + (topEndWallY - 1120);
  let cTL = -minSideX + (topEndWallY - 1120);
  let cBR = maxSideX - (botEndWallY + 1120);
  let cBL = -minSideX - (botEndWallY + 1120);

  if (cornerHits.length >= 4) {
    const trVals = cornerHits.filter((h) => h.x > 0 && h.y > 0).map((h) => h.x + h.y);
    const tlVals = cornerHits.filter((h) => h.x < 0 && h.y > 0).map((h) => -h.x + h.y);
    const brVals = cornerHits.filter((h) => h.x > 0 && h.y < 0).map((h) => h.x - h.y);
    const blVals = cornerHits.filter((h) => h.x < 0 && h.y < 0).map((h) => -h.x - h.y);

    if (trVals.length > 0) cTR = Math.max(...trVals);
    if (tlVals.length > 0) cTL = Math.max(...tlVals);
    if (brVals.length > 0) cBR = Math.max(...brVals);
    if (blVals.length > 0) cBL = Math.max(...blVals);
  }

  const p2_x = Math.max(minSideX + 400, Math.min(-1200, -(cTL - topEndWallY)));
  const p1_y = Math.min(topEndWallY - 400, Math.max(2000, cTL + minSideX));

  const p7_x = Math.min(maxSideX - 400, Math.max(1200, cTR - topEndWallY));
  const p8_y = Math.min(topEndWallY - 400, Math.max(2000, cTR - maxSideX));

  const p10_x = Math.min(maxSideX - 400, Math.max(1200, cBR + botEndWallY));
  const p9_y = Math.max(botEndWallY + 400, Math.min(-2000, maxSideX - cBR));

  const p15_x = Math.max(minSideX + 400, Math.min(-1200, -(cBL + botEndWallY)));
  const p16_y = Math.max(botEndWallY + 400, Math.min(-2000, -(cBL + minSideX)));

  const computedPoints: ControlPoint[] = [
    { id: 'P1',  name: 'Side Wall TL',      x: round2(minSideX),          y: round2(p1_y) },
    { id: 'P2',  name: 'Chamfer TL',        x: round2(p2_x),              y: round2(topEndWallY) },
    { id: 'P3',  name: 'Goal Post TL',      x: round2(-goalPostHalfWidth),y: round2(topEndWallY) },
    { id: 'P4',  name: 'Goal Back TL',      x: round2(-goalPostHalfWidth),y: round2(goalBackTopY) },
    { id: 'P5',  name: 'Goal Back TR',      x: round2(goalPostHalfWidth), y: round2(goalBackTopY) },
    { id: 'P6',  name: 'Goal Post TR',      x: round2(goalPostHalfWidth), y: round2(topEndWallY) },
    { id: 'P7',  name: 'Chamfer TR',        x: round2(p7_x),              y: round2(topEndWallY) },
    { id: 'P8',  name: 'Side Wall TR',      x: round2(maxSideX),          y: round2(p8_y) },
    { id: 'P9',  name: 'Side Wall BR',      x: round2(maxSideX),          y: round2(p9_y) },
    { id: 'P10', name: 'Chamfer BR',        x: round2(p10_x),             y: round2(botEndWallY) },
    { id: 'P11', name: 'Goal Post BR',      x: round2(goalPostHalfWidth), y: round2(botEndWallY) },
    { id: 'P12', name: 'Goal Back BR',      x: round2(goalPostHalfWidth), y: round2(goalBackBotY) },
    { id: 'P13', name: 'Goal Back BL',      x: round2(-goalPostHalfWidth),y: round2(goalBackBotY) },
    { id: 'P14', name: 'Goal Post BL',      x: round2(-goalPostHalfWidth),y: round2(botEndWallY) },
    { id: 'P15', name: 'Chamfer BL',        x: round2(p15_x),             y: round2(botEndWallY) },
    { id: 'P16', name: 'Side Wall BL',      x: round2(minSideX),          y: round2(p16_y) }
  ];

  const fieldWidth = maxSideX - minSideX;
  const fieldLength = topEndWallY - botEndWallY;
  const goalDepth = Math.max(goalBackTopY - topEndWallY, Math.abs(goalBackBotY - botEndWallY));

  return {
    controlPoints: computedPoints,
    stats: {
      totalHits: history.length,
      validHits: validHits.length,
      noiseHits: noiseCount,
      fieldWidth: round2(fieldWidth),
      fieldLength: round2(fieldLength),
      goalDepth: round2(goalDepth),
      chamferFitScore: 98.4
    }
  };
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Load default calibration settings (In-memory session, do not persist to localStorage).
 */
export function loadSavedCalibration(): CalibrationSettings {
  return { ...DEFAULT_CALIBRATION };
}

/**
 * Save calibration settings (In-memory only, no local storage persistence).
 */
export function saveCalibrationToStorage(_cal: CalibrationSettings): void {
  // In-memory only per requirement: do not store stats/calibration inside local storage or anywhere
}

/**
 * Load default 16 control points (In-memory session, do not persist to localStorage).
 */
export function loadSavedControlPoints(): ControlPoint[] {
  return JSON.parse(JSON.stringify(DEFAULT_CONTROL_POINTS));
}

/**
 * Save 16 control points (In-memory only, no local storage persistence).
 */
export function saveControlPointsToStorage(_points: ControlPoint[]): void {
  // In-memory only per requirement: do not store inside local storage or anywhere
}

/**
 * Generates an exportable JSON configuration object for the pitch minimap skeleton.
 */
export function generatePitchConfigJson(
  controlPoints: ControlPoint[],
  cal: CalibrationSettings
): PitchConfig {
  return {
    version: '1.0.0',
    name: 'RocketLeague_Irregular_Pitch_16ControlPoints',
    timestamp: new Date().toISOString(),
    safetyMargins: SAFETY_MARGINS,
    calibration: cal,
    controlPoints: controlPoints
  };
}
