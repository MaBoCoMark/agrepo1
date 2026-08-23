import { overlayState } from './telemetry-state';
import {
  ControlPoint,
  CalibrationSettings,
  HitPointRecord,
  MappingStats,
  DEFAULT_CONTROL_POINTS,
  DEFAULT_CALIBRATION,
  SAFETY_MARGINS,
  isPointInsideSafetyBounds,
  applyCalibration,
  unapplyCalibration,
  loadSavedCalibration,
  saveCalibrationToStorage,
  loadSavedControlPoints,
  saveControlPointsToStorage,
  generatePitchConfigJson
} from './pitch-geometry';

/**
 * ============================================================================
 * 🎮 Ball Hit & Boost Pickup Inspector & 2D Pitch Mapping Controller
 * ============================================================================
 */

export interface BallHitLocation {
  X: number;
  Y: number;
  Z: number;
}

export interface BallHitPlayer {
  Name?: string;
  Shortcut?: number | string;
  TeamNum?: number | string;
  [key: string]: any;
}

export interface BallHitBall {
  PreHitSpeed?: number;
  PostHitSpeed?: number;
  Location?: BallHitLocation;
  [key: string]: any;
}

export interface BallHitPayloadData {
  MatchGuid?: string;
  Players?: BallHitPlayer[];
  Ball?: BallHitBall;
  [key: string]: any;
}

export interface BallHitWebSocketMessage {
  Event?: string;
  Data?: string | BallHitPayloadData | any;
  Ball?: BallHitBall;
  Players?: BallHitPlayer[];
  [key: string]: any;
}

export interface BoostPickupLocation {
  X?: number;
  Y?: number;
  Z?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface BoostPickupPlayer {
  Name?: string;
  name?: string;
  Shortcut?: number | string;
  shortcut?: number | string;
  TeamNum?: number | string;
  teamNum?: number | string;
  [key: string]: any;
}

export interface BoostPickupPayloadData {
  MatchGuid?: string;
  Player?: BoostPickupPlayer;
  Location?: BoostPickupLocation;
  BoostAmount?: number;
  boostAmount?: number;
  BoostType?: string;
  boostType?: string;
  bReplay?: boolean;
  [key: string]: any;
}

export interface BoostPickupWebSocketMessage {
  Event?: string;
  Data?: string | BoostPickupPayloadData | any;
  Location?: BoostPickupLocation;
  BoostType?: string;
  BoostAmount?: number;
  Player?: BoostPickupPlayer;
  [key: string]: any;
}

export interface BoostPickupRecord {
  x: number;
  y: number;
  z: number;
  boostType: string;
  boostAmount?: number;
  playerName?: string;
  shortcut?: number | string;
  teamNum?: number | string;
  timestamp: number;
  isNoise?: boolean;
}

export interface SessionExtremes {
  minX: number | null;
  maxX: number | null;
  minY: number | null;
  maxY: number | null;
  minZ: number | null;
  maxZ: number | null;
}

export interface LastBallHitSnapshot {
  hasData: boolean;
  timestamp: string;
  playerName: string;
  shortcut: number | string;
  teamNum: number | string;
  preHitSpeed: number;
  postHitSpeed: number;
  speedDelta: number;
  x: number | null;
  y: number | null;
  z: number | null;
}

export interface LastBoostPickupSnapshot {
  hasData: boolean;
  timestamp: string;
  playerName: string;
  shortcut: number | string;
  teamNum: number | string;
  boostType: string;
  boostAmount: number;
  x: number | null;
  y: number | null;
  z: number | null;
}

export type BallHitOperationMode = 'mapping' | 'calibration';

// Global Session State
export const sessionExtremes: SessionExtremes = {
  minX: null,
  maxX: null,
  minY: null,
  maxY: null,
  minZ: null,
  maxZ: null
};

export const lastBallHitSnapshot: LastBallHitSnapshot = {
  hasData: false,
  timestamp: '-',
  playerName: '-',
  shortcut: '-',
  teamNum: '-',
  preHitSpeed: 0,
  postHitSpeed: 0,
  speedDelta: 0,
  x: null,
  y: null,
  z: null
};

export const lastBoostPickupSnapshot: LastBoostPickupSnapshot = {
  hasData: false,
  timestamp: '-',
  playerName: '-',
  shortcut: '-',
  teamNum: '-',
  boostType: '-',
  boostAmount: 0,
  x: null,
  y: null,
  z: null
};

export let sessionTotalHits = 0;
export let sessionTotalBoosts = 0;
export let isBallHitDirty = true;
export let isRecordingHits = true;
export let currentOperationMode: BallHitOperationMode = 'mapping';

export let hitHistoryBuffer: HitPointRecord[] = [];
export const MAX_HIT_HISTORY = 3000;

export let boostPickupHistoryBuffer: BoostPickupRecord[] = [];
export const MAX_BOOST_HISTORY = 3000;

export let currentControlPoints: ControlPoint[] = loadSavedControlPoints();
export let currentCalibration: CalibrationSettings = loadSavedCalibration();
export let lastMappingStats: MappingStats | null = null;

export let selectedVertexIndex: number | null = null;
let isDraggingVertex = false;

export function markBallHitDirty(): void {
  isBallHitDirty = true;
}

export function setOperationMode(mode: BallHitOperationMode): void {
  currentOperationMode = mode;
  isBallHitDirty = true;
}

export function setRecordingState(recording: boolean): void {
  isRecordingHits = recording;
  isBallHitDirty = true;
}

export function clearHitHistory(): void {
  hitHistoryBuffer = [];
  sessionTotalHits = 0;
  sessionExtremes.minX = null;
  sessionExtremes.maxX = null;
  sessionExtremes.minY = null;
  sessionExtremes.maxY = null;
  sessionExtremes.minZ = null;
  sessionExtremes.maxZ = null;
  lastBallHitSnapshot.hasData = false;
  lastMappingStats = null;
  isBallHitDirty = true;
}

export function clearBoostHistory(): void {
  boostPickupHistoryBuffer = [];
  sessionTotalBoosts = 0;
  lastBoostPickupSnapshot.hasData = false;
  isBallHitDirty = true;
}

export function clearAllPitchData(): void {
  clearHitHistory();
  clearBoostHistory();
}

export function updateCalibration(settings: Partial<CalibrationSettings>): void {
  currentCalibration = { ...currentCalibration, ...settings };
  saveCalibrationToStorage(currentCalibration);
  isBallHitDirty = true;
}

export function resetCalibration(): void {
  currentCalibration = { ...DEFAULT_CALIBRATION };
  saveCalibrationToStorage(currentCalibration);
  isBallHitDirty = true;
}

export function updateControlPoints(points: ControlPoint[]): void {
  if (Array.isArray(points) && points.length === 16) {
    currentControlPoints = points;
    saveControlPointsToStorage(currentControlPoints);
    isBallHitDirty = true;
  }
}

export function resetControlPointsToDefault(): void {
  currentControlPoints = JSON.parse(JSON.stringify(DEFAULT_CONTROL_POINTS));
  saveControlPointsToStorage(currentControlPoints);
  isBallHitDirty = true;
}

/**
 * Bulk import hits from JSON.
 */
export function importHitsFromJson(jsonString: string): number {
  try {
    const data = JSON.parse(jsonString);
    let addedCount = 0;
    const array = Array.isArray(data) ? data : (data.hits || data.points || []);
    if (Array.isArray(array)) {
      for (const item of array) {
        const x = typeof item.x === 'number' ? item.x : (typeof item.X === 'number' ? item.X : (Array.isArray(item) ? item[0] : null));
        const y = typeof item.y === 'number' ? item.y : (typeof item.Y === 'number' ? item.Y : (Array.isArray(item) ? item[1] : null));
        const z = typeof item.z === 'number' ? item.z : (typeof item.Z === 'number' ? item.Z : (Array.isArray(item) ? item[2] : 50));
        if (x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
          const isNoise = !isPointInsideSafetyBounds(x, y, z ?? 50);
          hitHistoryBuffer.push({ x, y, z: z ?? 50, timestamp: Date.now(), isNoise });
          addedCount++;
        }
      }
      if (hitHistoryBuffer.length > MAX_HIT_HISTORY) {
        hitHistoryBuffer = hitHistoryBuffer.slice(-MAX_HIT_HISTORY);
      }
      sessionTotalHits += addedCount;
      isBallHitDirty = true;
      return addedCount;
    }
  } catch (err) {
    console.error('Failed to parse import hits JSON:', err);
  }
  return 0;
}

/**
 * Bulk import boost pickups from JSON.
 */
export function importBoostsFromJson(jsonString: string): number {
  try {
    const data = JSON.parse(jsonString);
    let addedCount = 0;
    const array = Array.isArray(data) ? data : (data.boosts || data.boostPickups || []);
    if (Array.isArray(array)) {
      for (const item of array) {
        const x = typeof item.x === 'number' ? item.x : (typeof item.X === 'number' ? item.X : (Array.isArray(item) ? item[0] : null));
        const y = typeof item.y === 'number' ? item.y : (typeof item.Y === 'number' ? item.Y : (Array.isArray(item) ? item[1] : null));
        const z = typeof item.z === 'number' ? item.z : (typeof item.Z === 'number' ? item.Z : (Array.isArray(item) ? item[2] : 60));
        const boostType = item.boostType || item.BoostType || (item.boostAmount > 0.25 ? 'BoostType_Big' : 'BoostType_Pad');
        if (x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
          const isNoise = !isPointInsideSafetyBounds(x, y, z ?? 60);
          boostPickupHistoryBuffer.push({
            x,
            y,
            z: z ?? 60,
            boostType,
            boostAmount: typeof item.boostAmount === 'number' ? item.boostAmount : (typeof item.BoostAmount === 'number' ? item.BoostAmount : undefined),
            timestamp: Date.now(),
            isNoise
          });
          addedCount++;
        }
      }
      if (boostPickupHistoryBuffer.length > MAX_BOOST_HISTORY) {
        boostPickupHistoryBuffer = boostPickupHistoryBuffer.slice(-MAX_BOOST_HISTORY);
      }
      sessionTotalBoosts += addedCount;
      isBallHitDirty = true;
      return addedCount;
    }
  } catch (err) {
    console.error('Failed to parse import boosts JSON:', err);
  }
  return 0;
}

/**
 * Export recorded boost pickups as JSON containing { x, y, z, boostType }.
 */
export function exportBoostPickupsJson(): string {
  const exportList = boostPickupHistoryBuffer.map((b) => ({
    x: Math.round(b.x * 100) / 100,
    y: Math.round(b.y * 100) / 100,
    z: Math.round(b.z * 100) / 100,
    boostType: b.boostType
  }));
  return JSON.stringify(exportList, null, 2);
}

/**
 * Parse incoming WebSocket BallHit packet.
 */
export function processBallHitPacket(raw: BallHitWebSocketMessage): boolean {
  if (overlayState.currentActiveScene !== 'ball-hit') {
    return false;
  }
  if (!raw) return false;

  let payloadData: BallHitPayloadData;
  try {
    if (typeof raw === 'string') {
      payloadData = JSON.parse(raw);
    } else if (raw.Data !== undefined) {
      payloadData = typeof raw.Data === 'string' ? JSON.parse(raw.Data) : raw.Data;
    } else {
      payloadData = raw;
    }
  } catch (err) {
    console.error('Failed to parse BallHit payload Data string:', err);
    return false;
  }

  if (!payloadData || typeof payloadData !== 'object') {
    return false;
  }

  const ball: BallHitBall | undefined = payloadData.Ball || (payloadData as any).ball;
  const players: BallHitPlayer[] = payloadData.Players || (payloadData as any).players || [];
  const primaryPlayer = Array.isArray(players) && players.length > 0 ? players[0] : ((payloadData as any).Player || null);

  const preSpeed = typeof ball?.PreHitSpeed === 'number'
    ? ball.PreHitSpeed
    : (typeof (ball as any)?.preHitSpeed === 'number' ? (ball as any).preHitSpeed : 0);

  const postSpeed = typeof ball?.PostHitSpeed === 'number'
    ? ball.PostHitSpeed
    : (typeof (ball as any)?.postHitSpeed === 'number' ? (ball as any).postHitSpeed : 0);

  const loc = ball?.Location || (ball as any)?.location;
  const x = loc ? (typeof loc.X === 'number' ? loc.X : (typeof (loc as any).x === 'number' ? (loc as any).x : null)) : null;
  const y = loc ? (typeof loc.Y === 'number' ? loc.Y : (typeof (loc as any).y === 'number' ? (loc as any).y : null)) : null;
  const z = loc ? (typeof loc.Z === 'number' ? loc.Z : (typeof (loc as any).z === 'number' ? (loc as any).z : null)) : null;

  if (x !== null && !isNaN(x)) {
    sessionExtremes.minX = sessionExtremes.minX === null ? x : Math.min(sessionExtremes.minX, x);
    sessionExtremes.maxX = sessionExtremes.maxX === null ? x : Math.max(sessionExtremes.maxX, x);
  }
  if (y !== null && !isNaN(y)) {
    sessionExtremes.minY = sessionExtremes.minY === null ? y : Math.min(sessionExtremes.minY, y);
    sessionExtremes.maxY = sessionExtremes.maxY === null ? y : Math.max(sessionExtremes.maxY, y);
  }
  if (z !== null && !isNaN(z)) {
    sessionExtremes.minZ = sessionExtremes.minZ === null ? z : Math.min(sessionExtremes.minZ, z);
    sessionExtremes.maxZ = sessionExtremes.maxZ === null ? z : Math.max(sessionExtremes.maxZ, z);
  }

  sessionTotalHits++;
  const d = new Date();
  const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;

  lastBallHitSnapshot.hasData = true;
  lastBallHitSnapshot.timestamp = timeStr;
  lastBallHitSnapshot.playerName = primaryPlayer?.Name || primaryPlayer?.name || 'Unknown';
  lastBallHitSnapshot.shortcut = primaryPlayer?.Shortcut ?? primaryPlayer?.shortcut ?? '-';
  lastBallHitSnapshot.teamNum = primaryPlayer?.TeamNum ?? primaryPlayer?.teamNum ?? '-';
  lastBallHitSnapshot.preHitSpeed = preSpeed;
  lastBallHitSnapshot.postHitSpeed = postSpeed;
  lastBallHitSnapshot.speedDelta = postSpeed - preSpeed;
  lastBallHitSnapshot.x = x;
  lastBallHitSnapshot.y = y;
  lastBallHitSnapshot.z = z;

  // If recording is active, append to point cloud
  if (isRecordingHits && x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
    const isNoise = !isPointInsideSafetyBounds(x, y, z ?? 0);
    hitHistoryBuffer.push({
      x,
      y,
      z: z ?? 0,
      timestamp: Date.now(),
      isNoise
    });
    if (hitHistoryBuffer.length > MAX_HIT_HISTORY) {
      hitHistoryBuffer.shift();
    }
  }

  isBallHitDirty = true;
  return true;
}

/**
 * Parse incoming WebSocket BoostPickup packet.
 * Payload schema example:
 * {
 *   "Event": "BoostPickup",
 *   "Data": "{\"MatchGuid\":\"\",\"Player\":{\"Name\":\"steamuser\",\"Shortcut\":1,\"TeamNum\":0},\"Location\":{\"X\":-1792.0,\"Y\":-4184.0,\"Z\":61.7},\"BoostAmount\":0.12,\"BoostType\":\"BoostType_Pad\",\"bReplay\":true}"
 * }
 */
export function processBoostPickupPacket(raw: BoostPickupWebSocketMessage): boolean {
  if (overlayState.currentActiveScene !== 'ball-hit') {
    return false;
  }
  if (!raw) return false;

  let payloadData: BoostPickupPayloadData;
  try {
    if (typeof raw === 'string') {
      payloadData = JSON.parse(raw);
    } else if (raw.Data !== undefined) {
      payloadData = typeof raw.Data === 'string' ? JSON.parse(raw.Data) : raw.Data;
    } else {
      payloadData = raw;
    }
  } catch (err) {
    console.error('Failed to parse BoostPickup payload Data string:', err);
    return false;
  }

  if (!payloadData || typeof payloadData !== 'object') {
    return false;
  }

  const loc = payloadData.Location || (payloadData as any).location || (raw as any).Location;
  const x = loc ? (typeof loc.X === 'number' ? loc.X : (typeof (loc as any).x === 'number' ? (loc as any).x : null)) : null;
  const y = loc ? (typeof loc.Y === 'number' ? loc.Y : (typeof (loc as any).y === 'number' ? (loc as any).y : null)) : null;
  const z = loc ? (typeof loc.Z === 'number' ? loc.Z : (typeof (loc as any).z === 'number' ? (loc as any).z : null)) : null;

  const boostType = payloadData.BoostType || (payloadData as any).boostType || (raw as any).BoostType || 'BoostType_Pad';
  const boostAmount = typeof payloadData.BoostAmount === 'number'
    ? payloadData.BoostAmount
    : (typeof (payloadData as any).boostAmount === 'number' ? (payloadData as any).boostAmount : 0);

  const player = payloadData.Player || (payloadData as any).player;
  const playerName = player?.Name || player?.name || 'Unknown';
  const shortcut = player?.Shortcut ?? player?.shortcut ?? '-';
  const teamNum = player?.TeamNum ?? player?.teamNum ?? '-';

  if (x !== null && !isNaN(x)) {
    sessionExtremes.minX = sessionExtremes.minX === null ? x : Math.min(sessionExtremes.minX, x);
    sessionExtremes.maxX = sessionExtremes.maxX === null ? x : Math.max(sessionExtremes.maxX, x);
  }
  if (y !== null && !isNaN(y)) {
    sessionExtremes.minY = sessionExtremes.minY === null ? y : Math.min(sessionExtremes.minY, y);
    sessionExtremes.maxY = sessionExtremes.maxY === null ? y : Math.max(sessionExtremes.maxY, y);
  }
  if (z !== null && !isNaN(z)) {
    sessionExtremes.minZ = sessionExtremes.minZ === null ? z : Math.min(sessionExtremes.minZ, z);
    sessionExtremes.maxZ = sessionExtremes.maxZ === null ? z : Math.max(sessionExtremes.maxZ, z);
  }

  sessionTotalBoosts++;
  const d = new Date();
  const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;

  lastBoostPickupSnapshot.hasData = true;
  lastBoostPickupSnapshot.timestamp = timeStr;
  lastBoostPickupSnapshot.playerName = playerName;
  lastBoostPickupSnapshot.shortcut = shortcut;
  lastBoostPickupSnapshot.teamNum = teamNum;
  lastBoostPickupSnapshot.boostType = boostType;
  lastBoostPickupSnapshot.boostAmount = boostAmount;
  lastBoostPickupSnapshot.x = x;
  lastBoostPickupSnapshot.y = y;
  lastBoostPickupSnapshot.z = z;

  if (isRecordingHits && x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
    const isNoise = !isPointInsideSafetyBounds(x, y, z ?? 60);
    boostPickupHistoryBuffer.push({
      x,
      y,
      z: z ?? 60,
      boostType,
      boostAmount,
      playerName,
      shortcut,
      teamNum,
      timestamp: Date.now(),
      isNoise
    });
    if (boostPickupHistoryBuffer.length > MAX_BOOST_HISTORY) {
      boostPickupHistoryBuffer.shift();
    }
  }

  isBallHitDirty = true;
  return true;
}

/**
 * ============================================================================
 * 🚀 DOM Node Caching & Interactive Map Controller
 * ============================================================================
 */

export interface BallHitDomNodes {
  root: HTMLElement | null;
  statusDot: HTMLElement | null;
  statusText: HTMLElement | null;
  totalCount: HTMLElement | null;
  totalBoosts: HTMLElement | null;
  lastTime: HTMLElement | null;
  awaitingNotice: HTMLElement | null;

  modeMappingBtn: HTMLElement | null;
  modeCalibBtn: HTMLElement | null;
  recordingToggleBtn: HTMLElement | null;
  recordingBadge: HTMLElement | null;

  playerTeamBadge: HTMLElement | null;
  playerName: HTMLElement | null;
  playerShortcut: HTMLElement | null;
  playerTeamNum: HTMLElement | null;

  preSpeed: HTMLElement | null;
  postSpeed: HTMLElement | null;
  speedDelta: HTMLElement | null;

  locX: HTMLElement | null;
  locY: HTMLElement | null;
  locZ: HTMLElement | null;

  spanX: HTMLElement | null;
  minX: HTMLElement | null;
  midX: HTMLElement | null;
  maxX: HTMLElement | null;
  barX: HTMLElement | null;

  spanY: HTMLElement | null;
  minY: HTMLElement | null;
  midY: HTMLElement | null;
  maxY: HTMLElement | null;
  barY: HTMLElement | null;

  spanZ: HTMLElement | null;
  minZ: HTMLElement | null;
  midZ: HTMLElement | null;
  maxZ: HTMLElement | null;
  barZ: HTMLElement | null;

  // Radar Canvas & Altitude Visualizer
  pitchCanvas: HTMLCanvasElement | null;
  altitudeIndicator: HTMLElement | null;
  altitudeVal: HTMLElement | null;
  altitudeBar: HTMLElement | null;

  // Calibration Info & Quick Actions
  calibOffsetTag: HTMLElement | null;
  calibScaleTag: HTMLElement | null;
  calibInvertTag: HTMLElement | null;
  btnClearPoints: HTMLElement | null;
  btnClearBoosts: HTMLElement | null;
  btnExportJson: HTMLElement | null;
  btnExportBoostJson: HTMLElement | null;
  btnImportJson: HTMLElement | null;
  btnResetCalib: HTMLElement | null;
  statsValidHits: HTMLElement | null;
  statsNoiseHits: HTMLElement | null;
}

let ballHitDomNodes: BallHitDomNodes | null = null;
let canvasInteractionBound = false;

export function cacheBallHitNodes(): BallHitDomNodes {
  ballHitDomNodes = {
    root: document.getElementById('ball-hit-root'),
    statusDot: document.getElementById('bh-status-dot'),
    statusText: document.getElementById('bh-status-text'),
    totalCount: document.getElementById('bh-total-count'),
    totalBoosts: document.getElementById('bh-total-boosts'),
    lastTime: document.getElementById('bh-last-time'),
    awaitingNotice: document.getElementById('bh-awaiting-notice'),

    modeMappingBtn: document.getElementById('bh-btn-mode-mapping'),
    modeCalibBtn: document.getElementById('bh-btn-mode-calibration'),
    recordingToggleBtn: document.getElementById('bh-btn-toggle-record'),
    recordingBadge: document.getElementById('bh-record-badge'),

    playerTeamBadge: document.getElementById('bh-player-team-badge'),
    playerName: document.getElementById('bh-player-name'),
    playerShortcut: document.getElementById('bh-player-shortcut'),
    playerTeamNum: document.getElementById('bh-player-team-num'),

    preSpeed: document.getElementById('bh-pre-speed'),
    postSpeed: document.getElementById('bh-post-speed'),
    speedDelta: document.getElementById('bh-speed-delta'),

    locX: document.getElementById('bh-loc-x'),
    locY: document.getElementById('bh-loc-y'),
    locZ: document.getElementById('bh-loc-z'),

    spanX: document.getElementById('bh-span-x'),
    minX: document.getElementById('bh-min-x'),
    midX: document.getElementById('bh-mid-x'),
    maxX: document.getElementById('bh-max-x'),
    barX: document.getElementById('bh-bar-x'),

    spanY: document.getElementById('bh-span-y'),
    minY: document.getElementById('bh-min-y'),
    midY: document.getElementById('bh-mid-y'),
    maxY: document.getElementById('bh-max-y'),
    barY: document.getElementById('bh-bar-y'),

    spanZ: document.getElementById('bh-span-z'),
    minZ: document.getElementById('bh-min-z'),
    midZ: document.getElementById('bh-mid-z'),
    maxZ: document.getElementById('bh-max-z'),
    barZ: document.getElementById('bh-bar-z'),

    pitchCanvas: document.getElementById('bh-pitch-canvas') as HTMLCanvasElement | null,
    altitudeIndicator: document.getElementById('bh-altitude-indicator'),
    altitudeVal: document.getElementById('bh-altitude-val'),
    altitudeBar: document.getElementById('bh-altitude-bar'),

    calibOffsetTag: document.getElementById('bh-calib-offset-tag'),
    calibScaleTag: document.getElementById('bh-calib-scale-tag'),
    calibInvertTag: document.getElementById('bh-calib-invert-tag'),
    btnClearPoints: document.getElementById('bh-btn-clear-points'),
    btnClearBoosts: document.getElementById('bh-btn-clear-boosts'),
    btnExportJson: document.getElementById('bh-btn-export-json'),
    btnExportBoostJson: document.getElementById('bh-btn-export-boost-json'),
    btnImportJson: document.getElementById('bh-btn-import-json'),
    btnResetCalib: document.getElementById('bh-btn-reset-calib'),
    statsValidHits: document.getElementById('bh-stats-valid-hits'),
    statsNoiseHits: document.getElementById('bh-stats-noise-hits')
  };

  bindPitchCanvasEvents();
  return ballHitDomNodes;
}

export function getBallHitCache(): BallHitDomNodes | null {
  return ballHitDomNodes;
}

function formatNum(val: number | null, decimals = 2): string {
  if (val === null || isNaN(val)) return '-';
  return val.toFixed(decimals);
}

/**
 * Binds mouse and keyboard interactions for canvas and calibration.
 */
function bindPitchCanvasEvents(): void {
  if (canvasInteractionBound) return;
  const dom = ballHitDomNodes;
  if (!dom?.pitchCanvas) return;

  const canvas = dom.pitchCanvas;

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    if (currentOperationMode !== 'calibration') return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicked close to any vertex
    const radius = 14;
    selectedVertexIndex = null;

    for (let i = 0; i < currentControlPoints.length; i++) {
      const pt = currentControlPoints[i];
      const screenPt = worldToCanvas(pt.x, pt.y, canvas.width, canvas.height, currentCalibration);
      const dist = Math.hypot(screenPt.x - clickX, screenPt.y - clickY);
      if (dist <= radius) {
        selectedVertexIndex = i;
        isDraggingVertex = true;
        break;
      }
    }
    isBallHitDirty = true;
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDraggingVertex || selectedVertexIndex === null || !dom.pitchCanvas) return;
    const rect = dom.pitchCanvas.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(dom.pitchCanvas.width, e.clientX - rect.left));
    const mouseY = Math.max(0, Math.min(dom.pitchCanvas.height, e.clientY - rect.top));

    const worldPt = canvasToWorld(mouseX, mouseY, dom.pitchCanvas.width, dom.pitchCanvas.height, currentCalibration);
    currentControlPoints[selectedVertexIndex].x = Math.round(worldPt.x * 10) / 10;
    currentControlPoints[selectedVertexIndex].y = Math.round(worldPt.y * 10) / 10;
    saveControlPointsToStorage(currentControlPoints);
    isBallHitDirty = true;
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingVertex) {
      isDraggingVertex = false;
      isBallHitDirty = true;
    }
  });

  // Mode Buttons
  dom.modeMappingBtn?.addEventListener('click', () => {
    setOperationMode('mapping');
  });

  dom.modeCalibBtn?.addEventListener('click', () => {
    setOperationMode('calibration');
  });

  dom.recordingToggleBtn?.addEventListener('click', () => {
    setRecordingState(!isRecordingHits);
  });

  dom.btnClearPoints?.addEventListener('click', () => {
    clearHitHistory();
  });

  dom.btnClearBoosts?.addEventListener('click', () => {
    clearBoostHistory();
  });

  dom.btnExportJson?.addEventListener('click', () => {
    const config = generatePitchConfigJson(currentControlPoints, currentCalibration);
    const jsonStr = JSON.stringify(config, null, 2);
    void navigator.clipboard.writeText(jsonStr);
    alert('✅ Pitch Configuration (16 Control Points) copied to clipboard!');
  });

  dom.btnExportBoostJson?.addEventListener('click', () => {
    const boostJson = exportBoostPickupsJson();
    void navigator.clipboard.writeText(boostJson);
    alert(`✅ Exported ${boostPickupHistoryBuffer.length} Boost Pickups to clipboard!`);
  });

  dom.btnImportJson?.addEventListener('click', () => {
    const input = prompt('Paste Pitch Config JSON, Hit Points JSON, or Boost Pickups JSON:');
    if (input) {
      try {
        const parsed = JSON.parse(input);
        if (parsed.controlPoints && Array.isArray(parsed.controlPoints) && parsed.controlPoints.length === 16) {
          updateControlPoints(parsed.controlPoints);
          if (parsed.calibration) {
            updateCalibration(parsed.calibration);
          }
          alert('✅ Successfully imported 16 Pitch Control Points & Calibration!');
        } else if (parsed.boosts || (Array.isArray(parsed) && parsed[0] && (parsed[0].boostType || parsed[0].BoostType))) {
          const count = importBoostsFromJson(input);
          alert(`✅ Successfully imported ${count} boost pickup records!`);
        } else {
          const hitsCount = importHitsFromJson(input);
          alert(`✅ Successfully imported ${hitsCount} hit telemetry records!`);
        }
      } catch (err) {
        alert('❌ Invalid JSON format.');
      }
    }
  });

  dom.btnResetCalib?.addEventListener('click', () => {
    resetCalibration();
    resetControlPointsToDefault();
  });

  // WASD / Arrow Calibration Hotkeys
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (overlayState.currentActiveScene !== 'ball-hit') return;
    if (currentOperationMode !== 'calibration') return;
    const step = e.shiftKey ? 50 : 10;

    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
      updateCalibration({ offsetY: currentCalibration.offsetY + step });
    } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
      updateCalibration({ offsetY: currentCalibration.offsetY - step });
    } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
      updateCalibration({ offsetX: currentCalibration.offsetX - step });
    } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
      updateCalibration({ offsetX: currentCalibration.offsetX + step });
    } else if (e.key === 'q' || e.key === 'Q') {
      updateCalibration({ scaleX: Math.max(0.2, currentCalibration.scaleX - 0.02), scaleY: Math.max(0.2, currentCalibration.scaleY - 0.02) });
    } else if (e.key === 'e' || e.key === 'E') {
      updateCalibration({ scaleX: currentCalibration.scaleX + 0.02, scaleY: currentCalibration.scaleY + 0.02 });
    }
  });

  canvasInteractionBound = true;
}

/**
 * Coordinate Conversion Helpers: World <-> Canvas
 */
export function worldToCanvas(
  wx: number,
  wy: number,
  canvasW: number,
  canvasH: number,
  cal: CalibrationSettings
): { x: number; y: number } {
  const { cx, cy } = applyCalibration(wx, wy, cal);
  // Safe margin coordinates: X in [-4500, 4500], Y in [-6000, 6000]
  // Y in 2D canvas is inverted (top is 0, bottom is H)
  const normX = (cx - SAFETY_MARGINS.x[0]) / (SAFETY_MARGINS.x[1] - SAFETY_MARGINS.x[0]);
  const normY = (cy - SAFETY_MARGINS.y[0]) / (SAFETY_MARGINS.y[1] - SAFETY_MARGINS.y[0]);

  const padding = 20;
  const drawW = canvasW - padding * 2;
  const drawH = canvasH - padding * 2;

  const canvasX = padding + normX * drawW;
  const canvasY = padding + (1 - normY) * drawH;
  return { x: canvasX, y: canvasY };
}

export function canvasToWorld(
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number,
  cal: CalibrationSettings
): { x: number; y: number } {
  const padding = 20;
  const drawW = canvasW - padding * 2;
  const drawH = canvasH - padding * 2;

  const normX = (canvasX - padding) / drawW;
  const normY = 1 - (canvasY - padding) / drawH;

  const cx = SAFETY_MARGINS.x[0] + normX * (SAFETY_MARGINS.x[1] - SAFETY_MARGINS.x[0]);
  const cy = SAFETY_MARGINS.y[0] + normY * (SAFETY_MARGINS.y[1] - SAFETY_MARGINS.y[0]);

  const { wx, wy } = unapplyCalibration(cx, cy, cal);
  return { x: wx, y: wy };
}

/**
 * Render 2D Pitch Radar Canvas
 */
function drawPitchRadar(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // 1. Radar Grid / Pitch Underlay
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridStep = 40;
  for (let x = 0; x < w; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Pitch centerline and center circle
  const centerScreen = worldToCanvas(0, 0, w, h, currentCalibration);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, centerScreen.y);
  ctx.lineTo(w, centerScreen.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerScreen.x, 0);
  ctx.lineTo(centerScreen.x, h);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(centerScreen.x, centerScreen.y, 45 * currentCalibration.scaleX, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 2. Render Historical Hit Points Cloud (Ball Hits)
  if (hitHistoryBuffer.length > 0) {
    ctx.save();
    for (let i = 0; i < hitHistoryBuffer.length; i++) {
      const pt = hitHistoryBuffer[i];
      const screen = worldToCanvas(pt.x, pt.y, w, h, currentCalibration);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, pt.isNoise ? 2.5 : 3, 0, Math.PI * 2);
      if (pt.isNoise) {
        ctx.fillStyle = 'rgba(255, 51, 102, 0.35)';
      } else {
        const alpha = Math.min(0.85, 0.2 + (i / hitHistoryBuffer.length) * 0.65);
        ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
      }
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Render Historical Boost Pickups Point Cloud (Separately styled)
  if (boostPickupHistoryBuffer.length > 0) {
    ctx.save();
    for (let i = 0; i < boostPickupHistoryBuffer.length; i++) {
      const bp = boostPickupHistoryBuffer[i];
      const screen = worldToCanvas(bp.x, bp.y, w, h, currentCalibration);
      const isBig = bp.boostType.toLowerCase().includes('big') ||
                    bp.boostType.toLowerCase().includes('pill') ||
                    (bp.boostAmount !== undefined && bp.boostAmount > 0.25);

      ctx.beginPath();
      if (isBig) {
        // Big Boost: 100 boost pill (Golden/amber glowing ring & circle)
        ctx.arc(screen.x, screen.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffd700';
        ctx.stroke();
      } else {
        // Small Boost Pad: 12% pad (Warm yellow circular dot)
        ctx.arc(screen.x, screen.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 4;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 4. Render 16 Control Points Wireframe Boundary (The Pitch Polygon Skeleton)
  if (currentControlPoints.length === 16) {
    ctx.save();
    ctx.beginPath();
    const firstScreen = worldToCanvas(currentControlPoints[0].x, currentControlPoints[0].y, w, h, currentCalibration);
    ctx.moveTo(firstScreen.x, firstScreen.y);

    for (let i = 1; i < currentControlPoints.length; i++) {
      const sp = worldToCanvas(currentControlPoints[i].x, currentControlPoints[i].y, w, h, currentCalibration);
      ctx.lineTo(sp.x, sp.y);
    }
    ctx.closePath();

    // Polygon boundary glow & fill
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 5. Render Vertex Handles & Labels
    ctx.save();
    for (let i = 0; i < currentControlPoints.length; i++) {
      const cp = currentControlPoints[i];
      const sp = worldToCanvas(cp.x, cp.y, w, h, currentCalibration);
      const isSelected = selectedVertexIndex === i;

      // Handle circle
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, isSelected ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ffd166' : '#ffffff';
      ctx.shadowColor = isSelected ? '#ffd166' : '#00f0ff';
      ctx.shadowBlur = isSelected ? 12 : 6;
      ctx.fill();
      ctx.strokeStyle = '#0a0e17';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Vertex Index Label
      if (currentOperationMode === 'calibration' || isSelected) {
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = isSelected ? '#ffd166' : 'rgba(255, 255, 255, 0.75)';
        ctx.fillText(cp.id, sp.x + 8, sp.y + 3);
      }
    }
    ctx.restore();
  }

  // 6. Render Latest Ball Hit Ripple & Speed-Scaled Outer Circle
  if (lastBallHitSnapshot.hasData && lastBallHitSnapshot.x !== null && lastBallHitSnapshot.y !== null) {
    const liveScreen = worldToCanvas(lastBallHitSnapshot.x, lastBallHitSnapshot.y, w, h, currentCalibration);
    ctx.save();

    // Dynamic Outer Red Circle based on postHitSpeed (0 - 110 scale)
    // When speed is 0 or less, the outer ring is not displayed (radius is 0).
    const postSpeed = typeof lastBallHitSnapshot.postHitSpeed === 'number' ? lastBallHitSnapshot.postHitSpeed : 0;
    const clampedSpeed = Math.max(0, Math.min(110, postSpeed));

    if (clampedSpeed > 0) {
      const maxRingRadius = 36;
      const ringRadius = (clampedSpeed / 110) * maxRingRadius;

      ctx.beginPath();
      ctx.arc(liveScreen.x, liveScreen.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 51, 102, 0.9)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Translucent inner fill inside speed ring
      ctx.fillStyle = 'rgba(255, 51, 102, 0.12)';
      ctx.fill();
    }

    // Core Red Hit Point
    ctx.beginPath();
    ctx.arc(liveScreen.x, liveScreen.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Updates the Ball Hit inspector DOM and Canvas.
 */
export function renderBallHitScene(): void {
  if (!isBallHitDirty) return;

  const dom = ballHitDomNodes || cacheBallHitNodes();
  if (!dom.root) return;

  // 1. Session Counts & Status
  if (dom.totalCount) dom.totalCount.textContent = sessionTotalHits.toString();
  if (dom.totalBoosts) dom.totalBoosts.textContent = sessionTotalBoosts.toString();
  if (dom.lastTime) dom.lastTime.textContent = lastBallHitSnapshot.timestamp;

  // Mode buttons active class
  if (dom.modeMappingBtn) {
    dom.modeMappingBtn.className = currentOperationMode === 'mapping' ? 'bh-mode-pill active' : 'bh-mode-pill';
  }
  if (dom.modeCalibBtn) {
    dom.modeCalibBtn.className = currentOperationMode === 'calibration' ? 'bh-mode-pill active' : 'bh-mode-pill';
  }

  // Recording status badge
  if (dom.recordingBadge) {
    dom.recordingBadge.textContent = isRecordingHits ? 'RECORDING' : 'PAUSED';
    dom.recordingBadge.className = isRecordingHits ? 'bh-rec-badge rec-active' : 'bh-rec-badge rec-paused';
  }
  if (dom.recordingToggleBtn) {
    dom.recordingToggleBtn.textContent = isRecordingHits ? '⏸ Pause' : '▶ Record';
  }

  // Stats chips
  const noiseHits = hitHistoryBuffer.filter((h) => h.isNoise).length;
  const validHits = hitHistoryBuffer.length - noiseHits;
  if (dom.statsValidHits) dom.statsValidHits.textContent = validHits.toString();
  if (dom.statsNoiseHits) dom.statsNoiseHits.textContent = noiseHits.toString();

  // Calibration tags
  if (dom.calibOffsetTag) {
    dom.calibOffsetTag.textContent = `Offset: (${currentCalibration.offsetX.toFixed(0)}, ${currentCalibration.offsetY.toFixed(0)})`;
  }
  if (dom.calibScaleTag) {
    dom.calibScaleTag.textContent = `Scale: ${currentCalibration.scaleX.toFixed(2)}x / ${currentCalibration.scaleY.toFixed(2)}y`;
  }
  if (dom.calibInvertTag) {
    dom.calibInvertTag.textContent = `Invert: X[${currentCalibration.invertX ? '✓' : '✗'}] Y[${currentCalibration.invertY ? '✓' : '✗'}]`;
  }

  // Awaiting notice
  if (dom.awaitingNotice) {
    dom.awaitingNotice.style.display = (lastBallHitSnapshot.hasData || hitHistoryBuffer.length > 0 || boostPickupHistoryBuffer.length > 0) ? 'none' : 'flex';
  }

  // 2. Player Attribution & Speeds
  if (lastBallHitSnapshot.hasData) {
    if (dom.playerName) dom.playerName.textContent = lastBallHitSnapshot.playerName;
    if (dom.playerShortcut) dom.playerShortcut.textContent = String(lastBallHitSnapshot.shortcut);
    if (dom.playerTeamNum) dom.playerTeamNum.textContent = String(lastBallHitSnapshot.teamNum);

    if (dom.playerTeamBadge) {
      if (lastBallHitSnapshot.teamNum === 0 || lastBallHitSnapshot.teamNum === '0') {
        dom.playerTeamBadge.textContent = 'TEAM 0 (BLUE)';
        dom.playerTeamBadge.className = 'bh-team-badge team-blue';
      } else if (lastBallHitSnapshot.teamNum === 1 || lastBallHitSnapshot.teamNum === '1') {
        dom.playerTeamBadge.textContent = 'TEAM 1 (ORANGE)';
        dom.playerTeamBadge.className = 'bh-team-badge team-orange';
      } else {
        dom.playerTeamBadge.textContent = `TEAM ${lastBallHitSnapshot.teamNum}`;
        dom.playerTeamBadge.className = 'bh-team-badge team-neutral';
      }
    }

    if (dom.preSpeed) dom.preSpeed.textContent = formatNum(lastBallHitSnapshot.preHitSpeed);
    if (dom.postSpeed) dom.postSpeed.textContent = formatNum(lastBallHitSnapshot.postHitSpeed);
    if (dom.speedDelta) {
      const prefix = lastBallHitSnapshot.speedDelta > 0 ? '+' : '';
      dom.speedDelta.textContent = `${prefix}${formatNum(lastBallHitSnapshot.speedDelta)}`;
      dom.speedDelta.className = lastBallHitSnapshot.speedDelta >= 0
        ? 'bh-metric-val bh-val-delta delta-pos'
        : 'bh-metric-val bh-val-delta delta-neg';
    }

    if (dom.locX) dom.locX.textContent = formatNum(lastBallHitSnapshot.x);
    if (dom.locY) dom.locY.textContent = formatNum(lastBallHitSnapshot.y);
    if (dom.locZ) dom.locZ.textContent = formatNum(lastBallHitSnapshot.z);

    // Altitude indicator
    if (dom.altitudeVal) dom.altitudeVal.textContent = formatNum(lastBallHitSnapshot.z, 1);
    if (dom.altitudeBar && lastBallHitSnapshot.z !== null) {
      const normZ = Math.max(0, Math.min(100, (lastBallHitSnapshot.z / 2000) * 100));
      dom.altitudeBar.style.height = `${normZ}%`;
    }
  }

  // 3. Extremes
  if (sessionExtremes.minX !== null && sessionExtremes.maxX !== null) {
    const spanX = sessionExtremes.maxX - sessionExtremes.minX;
    const midX = (sessionExtremes.minX + sessionExtremes.maxX) / 2;
    if (dom.minX) dom.minX.textContent = formatNum(sessionExtremes.minX);
    if (dom.maxX) dom.maxX.textContent = formatNum(sessionExtremes.maxX);
    if (dom.spanX) dom.spanX.textContent = formatNum(spanX);
    if (dom.midX) dom.midX.textContent = formatNum(midX);
    if (dom.barX && lastBallHitSnapshot.x !== null) {
      const pctX = spanX > 0 ? Math.max(0, Math.min(100, ((lastBallHitSnapshot.x - sessionExtremes.minX) / spanX) * 100)) : 50;
      dom.barX.style.left = `${pctX}%`;
    }
  }

  if (sessionExtremes.minY !== null && sessionExtremes.maxY !== null) {
    const spanY = sessionExtremes.maxY - sessionExtremes.minY;
    const midY = (sessionExtremes.minY + sessionExtremes.maxY) / 2;
    if (dom.minY) dom.minY.textContent = formatNum(sessionExtremes.minY);
    if (dom.maxY) dom.maxY.textContent = formatNum(sessionExtremes.maxY);
    if (dom.spanY) dom.spanY.textContent = formatNum(spanY);
    if (dom.midY) dom.midY.textContent = formatNum(midY);
    if (dom.barY && lastBallHitSnapshot.y !== null) {
      const pctY = spanY > 0 ? Math.max(0, Math.min(100, ((lastBallHitSnapshot.y - sessionExtremes.minY) / spanY) * 100)) : 50;
      dom.barY.style.left = `${pctY}%`;
    }
  }

  if (sessionExtremes.minZ !== null && sessionExtremes.maxZ !== null) {
    const spanZ = sessionExtremes.maxZ - sessionExtremes.minZ;
    const midZ = (sessionExtremes.minZ + sessionExtremes.maxZ) / 2;
    if (dom.minZ) dom.minZ.textContent = formatNum(sessionExtremes.minZ);
    if (dom.maxZ) dom.maxZ.textContent = formatNum(sessionExtremes.maxZ);
    if (dom.spanZ) dom.spanZ.textContent = formatNum(spanZ);
    if (dom.midZ) dom.midZ.textContent = formatNum(midZ);
    if (dom.barZ && lastBallHitSnapshot.z !== null) {
      const pctZ = spanZ > 0 ? Math.max(0, Math.min(100, ((lastBallHitSnapshot.z - sessionExtremes.minZ) / spanZ) * 100)) : 50;
      dom.barZ.style.left = `${pctZ}%`;
    }
  }

  // 4. Render Canvas
  if (dom.pitchCanvas) {
    if (dom.pitchCanvas.width !== dom.pitchCanvas.clientWidth || dom.pitchCanvas.height !== dom.pitchCanvas.clientHeight) {
      dom.pitchCanvas.width = dom.pitchCanvas.clientWidth || 400;
      dom.pitchCanvas.height = dom.pitchCanvas.clientHeight || 480;
    }
    drawPitchRadar(dom.pitchCanvas);
  }

  isBallHitDirty = false;
}
