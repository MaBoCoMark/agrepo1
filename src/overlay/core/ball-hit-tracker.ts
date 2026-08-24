import { overlayState } from './telemetry-state';
import {
  ControlPoint,
  CalibrationSettings,
  HitPointRecord,
  MappingStats,
  STANDARD_BOOST_LOCATIONS,
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
 * 🎮 Ball Hit Inspector & 2D Pitch Mapping Controller
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
  Target?: {
    Name?: string;
    TeamNum?: number | string;
    [key: string]: any;
  };
  Game?: {
    Target?: {
      Name?: string;
      TeamNum?: number | string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  TargetTeam?: number | string;
  [key: string]: any;
}

export interface BallHitWebSocketMessage {
  Event?: string;
  Data?: string | BallHitPayloadData | any;
  Ball?: BallHitBall;
  Players?: BallHitPlayer[];
  [key: string]: any;
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

export let sessionTotalHits = 0;
export let isBallHitDirty = true;
export let isRecordingHits = true;
export let currentOperationMode: BallHitOperationMode = 'mapping';

// Default: Only indicate latest hit (no previous hit point cloud clutter)
export let onlyLatestHit = true;

// Target player's team (0 = Blue, 1 = Orange). Controls 180° pitch orientation!
export let currentTargetTeam: number = 0;

// Outer speed ring customization: Percentage relative to narrower dimension of pitch (100% = max width of narrower side)
export let speedRingPercent = 20;
export let isPreviewSpeedRing = false;
export let previewSpeedKph = 110;

export let hitHistoryBuffer: HitPointRecord[] = [];
export const MAX_HIT_HISTORY = 3000;

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

export function setOnlyLatestHit(latestOnly: boolean): void {
  onlyLatestHit = latestOnly;
  isBallHitDirty = true;
}

/**
 * Sets the active target team (0 = Blue / our team, 1 = Orange / our team).
 * Governs the 180° mini map orientation.
 */
export function setTargetTeam(team: number): void {
  const normalized = (team === 1 || String(team) === '1') ? 1 : 0;
  if (currentTargetTeam !== normalized) {
    currentTargetTeam = normalized;
    isBallHitDirty = true;
  }
}

export function getTargetTeam(): number {
  return currentTargetTeam;
}

export function setSpeedRingPercent(percent: number): void {
  speedRingPercent = Math.max(1, Math.min(100, percent));
  isBallHitDirty = true;
}

export function setPreviewSpeedRing(preview: boolean, speed?: number): void {
  isPreviewSpeedRing = preview;
  if (typeof speed === 'number') {
    previewSpeedKph = Math.max(0, Math.min(110, speed));
  }
  isBallHitDirty = true;
}

export function setPreviewSpeedKph(speed: number): void {
  previewSpeedKph = Math.max(0, Math.min(110, speed));
  isBallHitDirty = true;
}

/**
 * Checks whether the pitch mini map should rotate 180 degrees.
 * Based exclusively on TARGET PLAYER's team (our perspective):
 * - Target Team 0: Normal 0° orientation.
 * - Target Team 1: 180° orientation (our goal stays at the bottom, opponent goal at top).
 */
export function isPitchRotated180(): boolean {
  return currentTargetTeam === 1;
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

export function clearAllPitchData(): void {
  clearHitHistory();
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
        const teamNum = item.teamNum ?? item.TeamNum ?? (typeof item[3] === 'number' ? item[3] : undefined);
        if (x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
          const isNoise = !isPointInsideSafetyBounds(x, y, z ?? 50);
          hitHistoryBuffer.push({ x, y, z: z ?? 50, timestamp: Date.now(), isNoise, teamNum });
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
 * Backward compatibility stubs for legacy boost actions
 */
export function clearBoostHistory(): void {
  isBallHitDirty = true;
}

export function importBoostsFromJson(_jsonString: string): number {
  return 0;
}

export function exportBoostPickupsJson(): string {
  return JSON.stringify(STANDARD_BOOST_LOCATIONS, null, 2);
}

export function processBoostPickupPacket(_raw: any): boolean {
  if (overlayState.currentActiveScene !== 'ball-hit') {
    return false;
  }
  return false;
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

  // Update target team if specified in packet
  if (payloadData.Game?.Target?.TeamNum !== undefined) {
    setTargetTeam(Number(payloadData.Game.Target.TeamNum));
  } else if (payloadData.Target?.TeamNum !== undefined) {
    setTargetTeam(Number(payloadData.Target.TeamNum));
  } else if (payloadData.TargetTeam !== undefined) {
    setTargetTeam(Number(payloadData.TargetTeam));
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

  const hitTeamNum = primaryPlayer?.TeamNum ?? primaryPlayer?.teamNum ?? '-';

  lastBallHitSnapshot.hasData = true;
  lastBallHitSnapshot.timestamp = timeStr;
  lastBallHitSnapshot.playerName = primaryPlayer?.Name || primaryPlayer?.name || 'Unknown';
  lastBallHitSnapshot.shortcut = primaryPlayer?.Shortcut ?? primaryPlayer?.shortcut ?? '-';
  lastBallHitSnapshot.teamNum = hitTeamNum;
  lastBallHitSnapshot.preHitSpeed = preSpeed;
  lastBallHitSnapshot.postHitSpeed = postSpeed;
  lastBallHitSnapshot.speedDelta = postSpeed - preSpeed;
  lastBallHitSnapshot.x = x;
  lastBallHitSnapshot.y = y;
  lastBallHitSnapshot.z = z;

  // If recording is active, append to point cloud with player team attribution
  if (isRecordingHits && x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
    const isNoise = !isPointInsideSafetyBounds(x, y, z ?? 0);
    hitHistoryBuffer.push({
      x,
      y,
      z: z ?? 0,
      timestamp: Date.now(),
      isNoise,
      teamNum: hitTeamNum
    });
    if (hitHistoryBuffer.length > MAX_HIT_HISTORY) {
      hitHistoryBuffer.shift();
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
  lastTime: HTMLElement | null;
  awaitingNotice: HTMLElement | null;

  modeMappingBtn: HTMLElement | null;
  modeCalibBtn: HTMLElement | null;
  toggleTrackingBtn: HTMLElement | null;
  trackingBtnText: HTMLElement | null;
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
  btnExportJson: HTMLElement | null;
  btnImportJson: HTMLElement | null;
  btnResetCalib: HTMLElement | null;
  statsValidHits: HTMLElement | null;
  statsNoiseHits: HTMLElement | null;

  // Speed Ring Percentage Controls
  speedRingPercentSlider: HTMLInputElement | null;
  speedRingPercentVal: HTMLElement | null;
  speedRingPreviewCheck: HTMLInputElement | null;
  speedRingPreviewSlider: HTMLInputElement | null;
  speedRingPreviewVal: HTMLElement | null;

  // Corner and Rotation Badges
  tagTL: HTMLElement | null;
  tagTR: HTMLElement | null;
  tagBL: HTMLElement | null;
  tagBR: HTMLElement | null;
  rotationTag: HTMLElement | null;
}

let ballHitDomNodes: BallHitDomNodes | null = null;
let canvasInteractionBound = false;

export function cacheBallHitNodes(): BallHitDomNodes {
  ballHitDomNodes = {
    root: document.getElementById('ball-hit-root'),
    statusDot: document.getElementById('bh-status-dot'),
    statusText: document.getElementById('bh-status-text'),
    totalCount: document.getElementById('bh-total-count'),
    lastTime: document.getElementById('bh-last-time'),
    awaitingNotice: document.getElementById('bh-awaiting-notice'),

    modeMappingBtn: document.getElementById('bh-btn-mode-mapping'),
    modeCalibBtn: document.getElementById('bh-btn-mode-calibration'),
    toggleTrackingBtn: document.getElementById('bh-btn-toggle-tracking'),
    trackingBtnText: document.getElementById('bh-tracking-btn-text'),
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
    btnExportJson: document.getElementById('bh-btn-export-json'),
    btnImportJson: document.getElementById('bh-btn-import-json'),
    btnResetCalib: document.getElementById('bh-btn-reset-calib'),
    statsValidHits: document.getElementById('bh-stats-valid-hits'),
    statsNoiseHits: document.getElementById('bh-stats-noise-hits'),

    speedRingPercentSlider: document.getElementById('bh-speed-ring-percent-slider') as HTMLInputElement | null,
    speedRingPercentVal: document.getElementById('bh-speed-ring-percent-val'),
    speedRingPreviewCheck: document.getElementById('bh-speed-ring-preview-check') as HTMLInputElement | null,
    speedRingPreviewSlider: document.getElementById('bh-speed-ring-preview-slider') as HTMLInputElement | null,
    speedRingPreviewVal: document.getElementById('bh-speed-ring-preview-val'),

    tagTL: document.getElementById('bh-tag-tl'),
    tagTR: document.getElementById('bh-tag-tr'),
    tagBL: document.getElementById('bh-tag-bl'),
    tagBR: document.getElementById('bh-tag-br'),
    rotationTag: document.getElementById('bh-pitch-rotation-tag')
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
 * Coordinate Conversion Helpers: World <-> Canvas
 * Preserves 1:1 isometric aspect ratio (each unreal unit is equal length in X and Y).
 */
export function getCanvasDrawBounds(canvasW: number, canvasH: number, padding = 16) {
  const worldWidth = SAFETY_MARGINS.x[1] - SAFETY_MARGINS.x[0]; // 9000 uu
  const worldHeight = SAFETY_MARGINS.y[1] - SAFETY_MARGINS.y[0]; // 12000 uu

  const availW = Math.max(10, canvasW - padding * 2);
  const availH = Math.max(10, canvasH - padding * 2);

  const scale = Math.min(availW / worldWidth, availH / worldHeight);
  const actualDrawW = worldWidth * scale;
  const actualDrawH = worldHeight * scale;

  const originX = (canvasW - actualDrawW) / 2;
  const originY = (canvasH - actualDrawH) / 2;

  return { worldWidth, worldHeight, actualDrawW, actualDrawH, originX, originY, scale };
}

export function worldToCanvas(
  wx: number,
  wy: number,
  canvasW: number,
  canvasH: number,
  cal: CalibrationSettings
): { x: number; y: number } {
  const { cx, cy } = applyCalibration(wx, wy, cal);
  const { worldWidth, worldHeight, actualDrawW, actualDrawH, originX, originY } = getCanvasDrawBounds(canvasW, canvasH);

  const normX = (cx - SAFETY_MARGINS.x[0]) / worldWidth;
  const normY = (cy - SAFETY_MARGINS.y[0]) / worldHeight;

  const canvasX = originX + normX * actualDrawW;
  const canvasY = originY + (1 - normY) * actualDrawH;
  return { x: canvasX, y: canvasY };
}

export function canvasToWorld(
  canvasX: number,
  canvasY: number,
  canvasW: number,
  canvasH: number,
  cal: CalibrationSettings
): { x: number; y: number } {
  const { worldWidth, worldHeight, actualDrawW, actualDrawH, originX, originY } = getCanvasDrawBounds(canvasW, canvasH);

  const normX = (canvasX - originX) / actualDrawW;
  const normY = 1 - (canvasY - originY) / actualDrawH;

  const cx = SAFETY_MARGINS.x[0] + normX * worldWidth;
  const cy = SAFETY_MARGINS.y[0] + normY * worldHeight;

  const { wx, wy } = unapplyCalibration(cx, cy, cal);
  return { x: wx, y: wy };
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
    let clickX = e.clientX - rect.left;
    let clickY = e.clientY - rect.top;

    if (isPitchRotated180()) {
      clickX = canvas.width - clickX;
      clickY = canvas.height - clickY;
    }

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
    let mouseX = Math.max(0, Math.min(dom.pitchCanvas.width, e.clientX - rect.left));
    let mouseY = Math.max(0, Math.min(dom.pitchCanvas.height, e.clientY - rect.top));

    if (isPitchRotated180()) {
      mouseX = dom.pitchCanvas.width - mouseX;
      mouseY = dom.pitchCanvas.height - mouseY;
    }

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

  // Toggle point cloud tracking vs latest hit only
  dom.toggleTrackingBtn?.addEventListener('click', () => {
    setOnlyLatestHit(!onlyLatestHit);
  });

  dom.recordingToggleBtn?.addEventListener('click', () => {
    setRecordingState(!isRecordingHits);
  });

  dom.btnClearPoints?.addEventListener('click', () => {
    clearHitHistory();
  });

  dom.btnExportJson?.addEventListener('click', () => {
    const config = generatePitchConfigJson(currentControlPoints, currentCalibration);
    const jsonStr = JSON.stringify(config, null, 2);
    void navigator.clipboard.writeText(jsonStr);
    alert('✅ Pitch Configuration (16 Control Points) copied to clipboard!');
  });

  dom.btnImportJson?.addEventListener('click', () => {
    const input = prompt('Paste Pitch Config JSON or Hit Points JSON:');
    if (input) {
      try {
        const parsed = JSON.parse(input);
        if (parsed.controlPoints && Array.isArray(parsed.controlPoints) && parsed.controlPoints.length === 16) {
          updateControlPoints(parsed.controlPoints);
          if (parsed.calibration) {
            updateCalibration(parsed.calibration);
          }
          alert('✅ Successfully imported 16 Pitch Control Points & Calibration!');
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

  // Outer Speed Ring controls (Percentage relative to narrower side)
  dom.speedRingPercentSlider?.addEventListener('input', () => {
    if (dom.speedRingPercentSlider) {
      setSpeedRingPercent(parseInt(dom.speedRingPercentSlider.value, 10));
    }
  });

  dom.speedRingPreviewCheck?.addEventListener('change', () => {
    if (dom.speedRingPreviewCheck) {
      setPreviewSpeedRing(dom.speedRingPreviewCheck.checked, previewSpeedKph);
    }
  });

  dom.speedRingPreviewSlider?.addEventListener('input', () => {
    if (dom.speedRingPreviewSlider) {
      const spd = parseInt(dom.speedRingPreviewSlider.value, 10);
      setPreviewSpeedKph(spd);
      if (dom.speedRingPreviewCheck && !dom.speedRingPreviewCheck.checked) {
        dom.speedRingPreviewCheck.checked = true;
        setPreviewSpeedRing(true, spd);
      }
    }
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
 * Render 2D Pitch Radar Canvas with 1:1 isometric scale, static 34 boost pads, and 180° rotation for Target Team 1.
 */
function drawPitchRadar(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const bounds = getCanvasDrawBounds(w, h);
  const isRotated = isPitchRotated180();

  // If Target Player is Team 1 (Orange team perspective), turn 180 degrees around pitch canvas center
  if (isRotated) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-w / 2, -h / 2);
  }

  // 1. Radar Grid / Pitch Field Underlay
  ctx.save();
  // Bounding outer guideline
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bounds.originX, bounds.originY, bounds.actualDrawW, bounds.actualDrawH);

  // Subtle isometric grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridStep = 40;
  for (let x = bounds.originX; x <= bounds.originX + bounds.actualDrawW; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, bounds.originY);
    ctx.lineTo(x, bounds.originY + bounds.actualDrawH);
    ctx.stroke();
  }
  for (let y = bounds.originY; y <= bounds.originY + bounds.actualDrawH; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(bounds.originX, y);
    ctx.lineTo(bounds.originX + bounds.actualDrawW, y);
    ctx.stroke();
  }

  // Pitch centerline (Y = 0) and midline (X = 0)
  const centerScreen = worldToCanvas(0, 0, w, h, currentCalibration);
  const leftMid = worldToCanvas(SAFETY_MARGINS.x[0], 0, w, h, currentCalibration);
  const rightMid = worldToCanvas(SAFETY_MARGINS.x[1], 0, w, h, currentCalibration);
  const topMid = worldToCanvas(0, SAFETY_MARGINS.y[1], w, h, currentCalibration);
  const botMid = worldToCanvas(0, SAFETY_MARGINS.y[0], w, h, currentCalibration);

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(leftMid.x, leftMid.y);
  ctx.lineTo(rightMid.x, rightMid.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(topMid.x, topMid.y);
  ctx.lineTo(botMid.x, botMid.y);
  ctx.stroke();

  // Pitch center circle (Radius 912 uu in Rocket League standard)
  ctx.setLineDash([]);
  const centerCircleRadius = 912 * bounds.scale * currentCalibration.scaleX;
  ctx.beginPath();
  ctx.arc(centerScreen.x, centerScreen.y, centerCircleRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 2. Render Static 34 Boost Locations directly on pitch radar
  ctx.save();
  for (let i = 0; i < STANDARD_BOOST_LOCATIONS.length; i++) {
    const bp = STANDARD_BOOST_LOCATIONS[i];
    const screen = worldToCanvas(bp.x, bp.y, w, h, currentCalibration);
    const isBig = bp.boostType === 'BoostType_Pill';

    ctx.beginPath();
    if (isBig) {
      // Big Boost Pill (100% Boost) - Amber / Golden glowing pill
      ctx.arc(screen.x, screen.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 9;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffd700';
      ctx.stroke();

      // Inner white highlight core
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else {
      // Small Boost Pad (12% Pad) - Warm yellow circular dot
      ctx.arc(screen.x, screen.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 5;
      ctx.fill();
    }
  }
  ctx.restore();

  // 3. Render Historical Hit Points Cloud (Ball Hits) - only if not in "latest only" mode
  if (!onlyLatestHit && hitHistoryBuffer.length > 0) {
    ctx.save();
    for (let i = 0; i < hitHistoryBuffer.length; i++) {
      const pt = hitHistoryBuffer[i];
      const screen = worldToCanvas(pt.x, pt.y, w, h, currentCalibration);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, pt.isNoise ? 2.5 : 3, 0, Math.PI * 2);
      if (pt.isNoise) {
        ctx.fillStyle = 'rgba(255, 209, 102, 0.4)';
      } else {
        const isMyHit = (pt.teamNum === currentTargetTeam || pt.teamNum === String(currentTargetTeam) || (pt.teamNum === undefined && currentTargetTeam === 0));
        const alpha = Math.min(0.85, 0.25 + (i / hitHistoryBuffer.length) * 0.65);
        // My Team Hit = Green, Opponent Hit = Red
        ctx.fillStyle = isMyHit ? `rgba(0, 255, 136, ${alpha})` : `rgba(255, 51, 102, ${alpha})`;
      }
      ctx.fill();
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

      // Vertex Index Label (keep text upright even if map is rotated)
      if (currentOperationMode === 'calibration' || isSelected) {
        ctx.save();
        if (isRotated) {
          ctx.translate(sp.x, sp.y);
          ctx.rotate(Math.PI);
          ctx.translate(-sp.x, -sp.y);
        }
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = isSelected ? '#ffd166' : 'rgba(255, 255, 255, 0.75)';
        ctx.fillText(cp.id, sp.x + 8, sp.y + 3);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // 6. Render Latest Ball Hit Ripple & Speed-Scaled Dynamic Outer Circle (or Preview Mode)
  const isPreview = isPreviewSpeedRing;
  const showHit = (lastBallHitSnapshot.hasData && lastBallHitSnapshot.x !== null && lastBallHitSnapshot.y !== null) || isPreview;

  if (showHit) {
    const hitX = isPreview ? 0 : (lastBallHitSnapshot.x ?? 0);
    const hitY = isPreview ? 0 : (lastBallHitSnapshot.y ?? 0);
    const liveScreen = worldToCanvas(hitX, hitY, w, h, currentCalibration);
    ctx.save();

    // Determine if hit was by our team or opponent team:
    // Our team hit = GREEN (#00ff88), Opponent hit = RED (#ff3366)
    const hitTeam = lastBallHitSnapshot.teamNum;
    const isMyTeamHit = isPreview
      ? true
      : (hitTeam === currentTargetTeam || hitTeam === String(currentTargetTeam) || (hitTeam === '-' && currentTargetTeam === 0));

    const hitColor = isMyTeamHit ? '#00ff88' : '#ff3366';
    const ringStroke = isMyTeamHit ? 'rgba(0, 255, 136, 0.95)' : 'rgba(255, 51, 102, 0.95)';
    const ringFill = isMyTeamHit ? 'rgba(0, 255, 136, 0.14)' : 'rgba(255, 51, 102, 0.14)';
    const shadowColor = isMyTeamHit ? '#00ff88' : '#ff3366';

    // Dynamic Outer Circle scaled to narrower dimension percentage and postHitSpeed (0 - 110 scale)
    const postSpeed = isPreview
      ? previewSpeedKph
      : (typeof lastBallHitSnapshot.postHitSpeed === 'number' ? lastBallHitSnapshot.postHitSpeed : 0);
    const clampedSpeed = Math.max(0, Math.min(110, postSpeed));

    const narrowerSide = Math.min(bounds.actualDrawW, bounds.actualDrawH);
    // 100% outer ring percentage means outer circle diameter equals 100% of the narrower side
    const maxRingRadius = (narrowerSide * (speedRingPercent / 100)) / 2;

    if (clampedSpeed > 0) {
      const ringRadius = (clampedSpeed / 110) * maxRingRadius;

      ctx.beginPath();
      ctx.arc(liveScreen.x, liveScreen.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = ringStroke;
      ctx.lineWidth = 2;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Translucent inner fill inside speed ring
      ctx.fillStyle = ringFill;
      ctx.fill();
    }

    // Core Hit Point Dot
    ctx.beginPath();
    ctx.arc(liveScreen.x, liveScreen.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = hitColor;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // In preview mode, draw clear textual guidance
    if (isPreview) {
      ctx.save();
      if (isRotated) {
        ctx.translate(liveScreen.x, liveScreen.y);
        ctx.rotate(Math.PI);
        ctx.translate(-liveScreen.x, -liveScreen.y);
      }
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = hitColor;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      const previewText = `PREVIEW: ${clampedSpeed.toFixed(0)} KM/H (${speedRingPercent}% max diameter, R: ${((clampedSpeed / 110) * maxRingRadius).toFixed(1)}px)`;
      ctx.fillText(previewText, liveScreen.x + 12, liveScreen.y - 12);
      ctx.restore();
    }

    ctx.restore();
  }

  // Restore 180° rotation transform
  if (isRotated) {
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
  if (dom.lastTime) dom.lastTime.textContent = lastBallHitSnapshot.timestamp;

  // Mode buttons active class
  if (dom.modeMappingBtn) {
    dom.modeMappingBtn.className = currentOperationMode === 'mapping' ? 'bh-mode-pill active' : 'bh-mode-pill';
  }
  if (dom.modeCalibBtn) {
    dom.modeCalibBtn.className = currentOperationMode === 'calibration' ? 'bh-mode-pill active' : 'bh-mode-pill';
  }

  // Toggle tracking vs latest hit only
  if (dom.toggleTrackingBtn) {
    dom.toggleTrackingBtn.className = onlyLatestHit ? 'bh-mode-pill active' : 'bh-mode-pill';
  }
  if (dom.trackingBtnText) {
    dom.trackingBtnText.textContent = onlyLatestHit ? 'Latest Hit Only' : 'Tracking All Hits';
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
  const isRotated = isPitchRotated180();
  if (dom.calibOffsetTag) {
    dom.calibOffsetTag.textContent = `Offset: (${currentCalibration.offsetX.toFixed(0)}, ${currentCalibration.offsetY.toFixed(0)})`;
  }
  if (dom.calibScaleTag) {
    dom.calibScaleTag.textContent = `Scale: ${currentCalibration.scaleX.toFixed(2)}x / ${currentCalibration.scaleY.toFixed(2)}y`;
  }
  if (dom.calibInvertTag) {
    dom.calibInvertTag.textContent = `Invert: X[${currentCalibration.invertX ? '✓' : '✗'}] Y[${currentCalibration.invertY ? '✓' : '✗'}] | Target: Team ${currentTargetTeam} (${isRotated ? '180°' : '0°'})`;
  }

  // Speed ring percentage controls
  if (dom.speedRingPercentSlider && dom.speedRingPercentSlider.value !== speedRingPercent.toString()) {
    dom.speedRingPercentSlider.value = speedRingPercent.toString();
  }
  if (dom.speedRingPercentVal) {
    dom.speedRingPercentVal.textContent = `${speedRingPercent}%`;
  }
  if (dom.speedRingPreviewCheck && dom.speedRingPreviewCheck.checked !== isPreviewSpeedRing) {
    dom.speedRingPreviewCheck.checked = isPreviewSpeedRing;
  }
  if (dom.speedRingPreviewSlider && dom.speedRingPreviewSlider.value !== previewSpeedKph.toString()) {
    dom.speedRingPreviewSlider.value = previewSpeedKph.toString();
  }
  if (dom.speedRingPreviewVal) {
    dom.speedRingPreviewVal.textContent = `${previewSpeedKph} KPH`;
  }

  // Corner Tags & Rotation Tag
  if (isRotated) {
    if (dom.tagTL) dom.tagTL.textContent = 'X: +4500, Y: -6000 (DEFENDING GOAL)';
    if (dom.tagTR) dom.tagTR.textContent = 'X: -4500, Y: -6000 (DEFENDING GOAL)';
    if (dom.tagBL) dom.tagBL.textContent = 'X: +4500, Y: +6000 (OPPONENT GOAL)';
    if (dom.tagBR) dom.tagBR.textContent = 'X: -4500, Y: +6000 (OPPONENT GOAL)';
    if (dom.rotationTag) {
      dom.rotationTag.textContent = '🔄 ROTATED 180° (TEAM 1 ORANGE PERSPECTIVE)';
      dom.rotationTag.style.display = 'block';
    }
  } else {
    if (dom.tagTL) dom.tagTL.textContent = 'X: -4500, Y: +6000 (OPPONENT GOAL)';
    if (dom.tagTR) dom.tagTR.textContent = 'X: +4500, Y: +6000 (OPPONENT GOAL)';
    if (dom.tagBL) dom.tagBL.textContent = 'X: -4500, Y: -6000 (DEFENDING GOAL)';
    if (dom.tagBR) dom.tagBR.textContent = 'X: +4500, Y: -6000 (DEFENDING GOAL)';
    if (dom.rotationTag) {
      dom.rotationTag.textContent = 'TEAM 0 BLUE PERSPECTIVE (0°)';
      dom.rotationTag.style.display = 'none';
    }
  }

  // Awaiting notice
  if (dom.awaitingNotice) {
    dom.awaitingNotice.style.display = (lastBallHitSnapshot.hasData || hitHistoryBuffer.length > 0 || isPreviewSpeedRing) ? 'none' : 'flex';
  }

  // 2. Player Attribution & Speeds
  if (lastBallHitSnapshot.hasData) {
    if (dom.playerName) dom.playerName.textContent = lastBallHitSnapshot.playerName;
    if (dom.playerShortcut) dom.playerShortcut.textContent = String(lastBallHitSnapshot.shortcut);
    if (dom.playerTeamNum) dom.playerTeamNum.textContent = String(lastBallHitSnapshot.teamNum);

    if (dom.playerTeamBadge) {
      const hitTeam = lastBallHitSnapshot.teamNum;
      const isMyTeam = (hitTeam === currentTargetTeam || hitTeam === String(currentTargetTeam));
      if (hitTeam === 0 || hitTeam === '0') {
        dom.playerTeamBadge.textContent = isMyTeam ? 'TEAM 0 (MY TEAM)' : 'TEAM 0 (OPPONENT)';
        dom.playerTeamBadge.className = isMyTeam ? 'bh-team-badge team-blue' : 'bh-team-badge team-blue';
      } else if (hitTeam === 1 || hitTeam === '1') {
        dom.playerTeamBadge.textContent = isMyTeam ? 'TEAM 1 (MY TEAM)' : 'TEAM 1 (OPPONENT)';
        dom.playerTeamBadge.className = isMyTeam ? 'bh-team-badge team-orange' : 'bh-team-badge team-orange';
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

  // 4. Render Canvas with 1:1 isometric scale
  if (dom.pitchCanvas) {
    if (dom.pitchCanvas.width !== dom.pitchCanvas.clientWidth || dom.pitchCanvas.height !== dom.pitchCanvas.clientHeight) {
      dom.pitchCanvas.width = dom.pitchCanvas.clientWidth || 400;
      dom.pitchCanvas.height = dom.pitchCanvas.clientHeight || 480;
    }
    drawPitchRadar(dom.pitchCanvas);
  }

  isBallHitDirty = false;
}
