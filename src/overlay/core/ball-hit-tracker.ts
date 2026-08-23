import { overlayState } from './telemetry-state';

/**
 * ============================================================================\n * ⚾ Ball Hit Telemetry Tracker & Extreme Value Analyzer
 * ============================================================================\n *
 * Tracks the latest BallHit event details (players, speeds, coordinates)
 * and records session extremes (min/max X, Y, Z coordinates).
 *
 * NOTE: Recording and accumulation strictly occur only when the Ball Hit
 * Inspector scene is active (overlayState.currentActiveScene === 'ball-hit').
 * ============================================================================\n */

export interface BallHitLocation {
  X: number;
  Y: number;
  Z: number;
}

export interface BallHitPlayer {
  Name?: string;
  Shortcut?: number;
  TeamNum?: number;
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

// Session Min / Max Extremes (Persisted for application lifecycle)
export const sessionExtremes: SessionExtremes = {
  minX: null,
  maxX: null,
  minY: null,
  maxY: null,
  minZ: null,
  maxZ: null
};

// Snapshot of last received BallHit event
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
export let isBallHitDirty = false;

export function markBallHitDirty(): void {
  isBallHitDirty = true;
}

/**
 * Parses and processes incoming BallHit websocket messages.
 * Only records data if the active scene is 'ball-hit'.
 */
export function processBallHitPacket(raw: BallHitWebSocketMessage): boolean {
  // STRICT CONSTRAINT: Only accumulate data when on this specific page/scene
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

  // Extract Ball info (support standard capitalizations and fallbacks)
  const ball: BallHitBall | undefined = payloadData.Ball || (payloadData as any).ball;
  const players: BallHitPlayer[] = payloadData.Players || (payloadData as any).players || [];
  const primaryPlayer = Array.isArray(players) && players.length > 0 ? players[0] : ((payloadData as any).Player || null);

  // Extract speeds
  const preSpeed = typeof ball?.PreHitSpeed === 'number'
    ? ball.PreHitSpeed
    : (typeof (ball as any)?.preHitSpeed === 'number' ? (ball as any).preHitSpeed : 0);

  const postSpeed = typeof ball?.PostHitSpeed === 'number'
    ? ball.PostHitSpeed
    : (typeof (ball as any)?.postHitSpeed === 'number' ? (ball as any).postHitSpeed : 0);

  // Extract location coordinates
  const loc = ball?.Location || (ball as any)?.location;
  const x = loc ? (typeof loc.X === 'number' ? loc.X : (typeof (loc as any).x === 'number' ? (loc as any).x : null)) : null;
  const y = loc ? (typeof loc.Y === 'number' ? loc.Y : (typeof (loc as any).y === 'number' ? (loc as any).y : null)) : null;
  const z = loc ? (typeof loc.Z === 'number' ? loc.Z : (typeof (loc as any).z === 'number' ? (loc as any).z : null)) : null;

  // Update session coordinate extremes
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

  // Update session hit count and timestamp
  sessionTotalHits++;
  const d = new Date();
  const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;

  // Update latest snapshot
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

  isBallHitDirty = true;
  return true;
}

/**
 * ============================================================================\n * 🚀 DOM Node Caching & High-Performance Frame Renderer
 * ============================================================================\n */

export interface BallHitDomNodes {
  root: HTMLElement | null;
  statusDot: HTMLElement | null;
  statusText: HTMLElement | null;
  totalCount: HTMLElement | null;
  lastTime: HTMLElement | null;
  awaitingNotice: HTMLElement | null;

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
}

let ballHitDomNodes: BallHitDomNodes | null = null;

export function cacheBallHitNodes(): BallHitDomNodes {
  ballHitDomNodes = {
    root: document.getElementById('ball-hit-root'),
    statusDot: document.getElementById('bh-status-dot'),
    statusText: document.getElementById('bh-status-text'),
    totalCount: document.getElementById('bh-total-count'),
    lastTime: document.getElementById('bh-last-time'),
    awaitingNotice: document.getElementById('bh-awaiting-notice'),

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
    barZ: document.getElementById('bh-bar-z')
  };
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
 * Updates the Ball Hit inspector DOM without layout trashing or excessive string operations.
 */
export function renderBallHitScene(): void {
  if (!isBallHitDirty) return;

  const dom = ballHitDomNodes || cacheBallHitNodes();
  if (!dom.root) return;

  // 1. Session Counts & Timestamps
  if (dom.totalCount) dom.totalCount.textContent = sessionTotalHits.toString();
  if (dom.lastTime) dom.lastTime.textContent = lastBallHitSnapshot.timestamp;

  // 2. Awaiting notice banner toggle
  if (dom.awaitingNotice) {
    dom.awaitingNotice.style.display = lastBallHitSnapshot.hasData ? 'none' : 'flex';
  }

  if (lastBallHitSnapshot.hasData) {
    // 3. Player Attribution
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

    // 4. Speeds & Delta
    if (dom.preSpeed) dom.preSpeed.textContent = formatNum(lastBallHitSnapshot.preHitSpeed);
    if (dom.postSpeed) dom.postSpeed.textContent = formatNum(lastBallHitSnapshot.postHitSpeed);
    if (dom.speedDelta) {
      const prefix = lastBallHitSnapshot.speedDelta > 0 ? '+' : '';
      dom.speedDelta.textContent = `${prefix}${formatNum(lastBallHitSnapshot.speedDelta)}`;
      dom.speedDelta.className = lastBallHitSnapshot.speedDelta >= 0
        ? 'bh-metric-val bh-val-delta delta-pos'
        : 'bh-metric-val bh-val-delta delta-neg';
    }

    // 5. Instantaneous Coordinates
    if (dom.locX) dom.locX.textContent = formatNum(lastBallHitSnapshot.x);
    if (dom.locY) dom.locY.textContent = formatNum(lastBallHitSnapshot.y);
    if (dom.locZ) dom.locZ.textContent = formatNum(lastBallHitSnapshot.z);
  }

  // 6. Session Coordinate Extremes (Min / Max / Span / Relative Bar)
  // --- Axis X ---
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

  // --- Axis Y ---
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

  // --- Axis Z ---
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

  isBallHitDirty = false;
}
