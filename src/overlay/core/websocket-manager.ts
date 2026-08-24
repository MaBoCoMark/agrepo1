import { processBallHitPacket, processBoostPickupPacket, setTargetTeam } from './ball-hit-tracker';
import { processBallHitSvgPacket, setBallHitSvgTargetTeam } from './ball-hit-svg-tracker';
import { emitTo } from '@tauri-apps/api/event';
import { latestData, overlayState } from './telemetry-state';
import { switchSceneMode } from './scene-manager';
import { processGoalScored, enterReplayView, willEndReplayView, immediateEndReplayView } from './replay-controller';
import { DEFAULT_LOW_FREQ_TRIGGERS, DEFAULT_TIMELINE_EVENTS } from './rl-events';
import { applyAutoHideNonExistingPlayers } from './competitive-renderer';

/**
 * ============================================================================
 * 📥 WebSocket Manager & High-Performance Event Router
 * ============================================================================
 */

export interface RLPlayerRaw {
  Name?: string;
  PrimaryId?: string;
  Shortcut?: number;
  TeamNum?: number;
  Score?: number;
  Goals?: number;
  Shots?: number;
  Assists?: number;
  Saves?: number;
  Touches?: number;
  CarTouches?: number;
  Demos?: number;
  bHasCar?: boolean;
  Speed?: number;
  Boost?: number;
  bBoosting?: boolean;
  bOnGround?: boolean;
  bOnWall?: boolean;
  bPowersliding?: boolean;
  bDemolished?: boolean;
  bSupersonic?: boolean;
}

export interface RLTeamRaw {
  Name?: string;
  TeamNum?: number;
  Score?: number;
  ColorPrimary?: string;
  ColorSecondary?: string;
}

export interface RLGameRaw {
  Teams?: RLTeamRaw[];
  PlaylistId?: number;
  TimeSeconds?: number;
  bOvertime?: boolean;
  Ball?: {
    Speed?: number;
    TeamNum?: number;
  };
  bReplay?: boolean;
  bHasWinner?: boolean;
  Winner?: string;
  Arena?: string;
  bHasTarget?: boolean;
  Target?: {
    Name?: string;
    Shortcut?: number;
    TeamNum?: number;
  };
}

export interface RLStateData {
  MatchGuid?: string;
  Players?: RLPlayerRaw[];
  Game?: RLGameRaw;
}

export interface RLWebSocketMessage {
  Event?: string;
  Data?: string | RLStateData | any;
}

// State
export let wsHost = '127.0.0.1';
export let wsPort = '52950';
export let isManualDisconnected = false;
export let isAutoRetryDisabled = false;

// 1. Packet Inspector capture state
export let isCaptureRequested = false;
export let captureTargetEvents: string[] = ['UpdateState'];

// 2. Timeline Console Logger state (Defaults to OFF, never persisted)
export let isTimelineCaptureEnabled = false;
export let timelineCaptureEvents: string[] = [...DEFAULT_TIMELINE_EVENTS];

// 3. Low-Frequency Telemetry Synchronization state
export let isLowFrequencySyncPending = true;
export let lowFreqTriggerEvents: string[] = [...DEFAULT_LOW_FREQ_TRIGGERS];

let ws: WebSocket | null = null;
let retryTimer: any = null;
export let wsStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

export function setWsConfig(host: string, port: string): void {
  wsHost = host;
  wsPort = port;
  isManualDisconnected = false;
  if (ws) {
    ws.close();
  } else {
    connectWebSocket();
  }
}

export function setCaptureRequested(requested: boolean, events?: string[]): void {
  isCaptureRequested = requested;
  if (events && events.length > 0) {
    captureTargetEvents = events;
  }
}

export function setCaptureTargetEvents(events: string[]): void {
  if (events && events.length > 0) {
    captureTargetEvents = events;
  }
}

export function setTimelineCaptureState(enabled: boolean, events?: string[]): void {
  isTimelineCaptureEnabled = enabled;
  if (events && events.length > 0) {
    timelineCaptureEvents = events;
  }
}

export function setTimelineCaptureEvents(events: string[]): void {
  if (events && events.length > 0) {
    timelineCaptureEvents = events;
  }
}

export function setLowFreqTriggerEvents(events: string[]): void {
  if (events && events.length > 0) {
    lowFreqTriggerEvents = events;
  }
}

export function requestLowFrequencySync(): void {
  isLowFrequencySyncPending = true;
}

export function setAutoRetryDisabled(disabled: boolean): void {
  isAutoRetryDisabled = disabled;
  if (isAutoRetryDisabled && retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

export function notifyWsStatus(): void {
  emitTo('configurator', 'ws-status-changed', {
    status: wsStatus,
    host: wsHost,
    port: wsPort
  });
}

export function evaluateAutoScene(): void {
  if (!overlayState.isAutoSceneControl) return;

  if (wsStatus !== 'connected') {
    overlayState.hasReceivedDataSinceConnected = false;
    if (!overlayState.isSimulating) {
      switchSceneMode('not-connected', true);
    }
  } else {
    if (!overlayState.hasReceivedDataSinceConnected && !overlayState.isSimulating) {
      switchSceneMode('empty', true);
    }
  }
}

/**
 * Parses low-frequency data: Player Names, Team Colors, Team Objects.
 * Triggered exclusively by Match lifecycle events (MatchInitialized, PlayerJoined, GoalScored, etc.)
 * rather than 120Hz-360Hz high-frequency telemetry loops.
 */
export function processLowFrequencyData(data: RLStateData): void {
  if (!data) return;

  const players = data.Players || [];
  // Guard against empty / incomplete packets wiping out cached roster
  if (players.length === 0 && !data.Game) return;

  // 1. Identify Target Player & Team Numbers
  let targetTeam: number | null = null;
  let targetName: string | null = null;

  if (data.Game?.Target) {
    targetName = data.Game.Target.Name || null;
    targetTeam = data.Game.Target.TeamNum !== undefined ? data.Game.Target.TeamNum : null;
  }

  let p1: RLPlayerRaw | null = null;
  const teammates: RLPlayerRaw[] = [];

  if (targetName && targetTeam !== null) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.TeamNum === targetTeam) {
        if (p.Name === targetName && !p1) {
          p1 = p;
        } else {
          teammates.push(p);
        }
      }
    }
  } else if (players.length > 0) {
    p1 = players[0];
    targetTeam = p1.TeamNum !== undefined ? p1.TeamNum : 0;
    for (let i = 1; i < players.length; i++) {
      if (players[i].TeamNum === p1.TeamNum) {
        teammates.push(players[i]);
      }
    }
  }

  // 2. Team Colors & Target Team
  const effectiveTargetTeam = targetTeam !== null ? targetTeam : (p1?.TeamNum !== undefined ? p1.TeamNum : 0);
  latestData.myTeamNum = effectiveTargetTeam;
  setTargetTeam(effectiveTargetTeam);
  setBallHitSvgTargetTeam(effectiveTargetTeam);

  if (data.Game?.Teams && Array.isArray(data.Game.Teams) && data.Game.Teams.length > 0) {
    let myTeamObj = data.Game.Teams.find((t) => t.TeamNum === effectiveTargetTeam);
    let oppTeamObj = data.Game.Teams.find((t) => t.TeamNum !== effectiveTargetTeam);

    if (!myTeamObj && data.Game.Teams[0]) myTeamObj = data.Game.Teams[0];
    if (!oppTeamObj && data.Game.Teams[1]) oppTeamObj = data.Game.Teams[1];

    if (myTeamObj?.ColorPrimary) {
      const hex = myTeamObj.ColorPrimary.startsWith('#') ? myTeamObj.ColorPrimary : `#${myTeamObj.ColorPrimary}` ;
      latestData.myPrimaryColor = hex;
    }
    if (myTeamObj?.ColorSecondary) {
      const hex = myTeamObj.ColorSecondary.startsWith('#') ? myTeamObj.ColorSecondary : `#${myTeamObj.ColorSecondary}` ;
      latestData.mySecondaryColor = hex;
    }
    if (oppTeamObj?.ColorPrimary) {
      const hex = oppTeamObj.ColorPrimary.startsWith('#') ? oppTeamObj.ColorPrimary : `#${oppTeamObj.ColorPrimary}` ;
      latestData.oppPrimaryColor = hex;
    }
    if (oppTeamObj?.ColorSecondary) {
      const hex = oppTeamObj.ColorSecondary.startsWith('#') ? oppTeamObj.ColorSecondary : `#${oppTeamObj.ColorSecondary}` ;
      latestData.oppSecondaryColor = hex;
    }
  }

  // 3. Player Names
  if (players.length > 0) {
    latestData.p1Name = p1?.Name || 'P1';
    latestData.p2Name = teammates[0]?.Name || (players.length > 1 ? 'P2' : '-');
    latestData.p3Name = teammates[1]?.Name || (players.length > 2 ? 'P3' : '-');

    // 4. Low-Frequency Player Slot Existence & Auto-Hide Non-Existing Players Components
    const p2Exists = Boolean(teammates[0]);
    const p3Exists = Boolean(teammates[1]);
    applyAutoHideNonExistingPlayers(p2Exists, p3Exists);
  }
}

/**
 * High-Frequency Telemetry Parser (120Hz - 360Hz hot path)
 * Only parses numerical/boolean physics & speeds.
 */
export function processUpdateState(data: RLStateData): void {
  if (!data) return;

  // Process low-frequency properties if triggered by an event and players array is populated
  if (isLowFrequencySyncPending && data.Players && data.Players.length > 0) {
    isLowFrequencySyncPending = false;
    processLowFrequencyData(data);
  }

  // 1. High-frequency Game & Ball parameters
  if (data.Game) {
    if (data.Game.TimeSeconds !== undefined) {
      latestData.timeSeconds = Math.trunc(data.Game.TimeSeconds);
    }
    if (data.Game.bOvertime !== undefined) {
      latestData.bOvertime = Boolean(data.Game.bOvertime);
    }
    if (data.Game.Ball) {
      if (data.Game.Ball.Speed !== undefined) {
        latestData.ballSpeed = Math.trunc(data.Game.Ball.Speed);
      }
      if (data.Game.Ball.TeamNum !== undefined) {
        latestData.ballTeamNum = Number(data.Game.Ball.TeamNum);
      }
    }

    // Match Scores
    if (data.Game.Teams && Array.isArray(data.Game.Teams) && data.Game.Teams.length > 0) {
      let targetTeam: number | null = null;
      if (data.Game.Target && data.Game.Target.TeamNum !== undefined) {
        targetTeam = data.Game.Target.TeamNum;
      }
      const effectiveTargetTeam = targetTeam !== null ? targetTeam : 0;
      let myTeamObj = data.Game.Teams.find((t) => t.TeamNum === effectiveTargetTeam);
      let oppTeamObj = data.Game.Teams.find((t) => t.TeamNum !== effectiveTargetTeam);

      if (!myTeamObj && data.Game.Teams[0]) myTeamObj = data.Game.Teams[0];
      if (!oppTeamObj && data.Game.Teams[1]) oppTeamObj = data.Game.Teams[1];

      const myScore = myTeamObj?.Score ?? 0;
      const oppScore = oppTeamObj?.Score ?? 0;

      latestData.myScore = myScore;
      latestData.oppScore = oppScore;
      latestData.scoreDiff = myScore - oppScore;
    }
  }

  // Automatic Scene Control
  const hasTarget = Boolean(data.Game?.bHasTarget || (data.Game?.Target && data.Game.Target.Name));
  const hasWinner = Boolean(data.Game?.bHasWinner);

  if (overlayState.isAutoSceneControl) {
    if (hasWinner) {
      if (overlayState.currentActiveScene !== 'empty') {
        immediateEndReplayView();
        switchSceneMode('empty', true);
      }
    } else if (overlayState.currentActiveScene !== 'replay-viewer' && hasTarget) {
      if (overlayState.currentActiveScene !== 'competitive') {
        switchSceneMode('competitive', true);
      }
    }
  }

  // If packet does not contain Players, do not overwrite player telemetry!
  if (!data.Players || data.Players.length === 0) {
    return;
  }

  // 2. High-Frequency Player Numbers & Booleans
  const players = data.Players;
  let targetTeam: number | null = null;
  let targetName: string | null = null;

  if (data.Game?.Target) {
    targetName = data.Game.Target.Name || null;
    targetTeam = data.Game.Target.TeamNum !== undefined ? data.Game.Target.TeamNum : null;
  }

  let p1: RLPlayerRaw | null = null;
  const teammates: RLPlayerRaw[] = [];

  if (targetName && targetTeam !== null) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.TeamNum === targetTeam) {
        if (p.Name === targetName && !p1) {
          p1 = p;
        } else {
          teammates.push(p);
        }
      }
    }
  } else if (players.length > 0) {
    p1 = players[0];
    for (let i = 1; i < players.length; i++) {
      if (players[i].TeamNum === p1.TeamNum) {
        teammates.push(players[i]);
      }
    }
  }

  const effectiveUpdateTargetTeam = targetTeam !== null ? targetTeam : (p1?.TeamNum !== undefined ? p1.TeamNum : 0);
  latestData.myTeamNum = effectiveUpdateTargetTeam;
  setTargetTeam(effectiveUpdateTargetTeam);
  setBallHitSvgTargetTeam(effectiveUpdateTargetTeam);

  // P1 Fast Numerical/Boolean State
  if (p1) {
    latestData.p1Speed = Math.trunc(p1.Speed || 0);
    latestData.p1Boost = Math.max(0, Math.min(100, Math.round(p1.Boost || 0)));
    latestData.p1HasCar = Boolean(p1.bHasCar);
    latestData.p1Boosting = Boolean(p1.bBoosting);
    latestData.p1OnGround = Boolean(p1.bOnGround);
    latestData.p1OnWall = Boolean(p1.bOnWall);
    latestData.p1Powersliding = Boolean(p1.bPowersliding);
    latestData.p1Demolished = Boolean(p1.bDemolished);
    latestData.p1Supersonic = Boolean(p1.bSupersonic);
  } else {
    latestData.p1Speed = 0;
    latestData.p1Boost = 0;
    latestData.p1HasCar = false;
    latestData.p1Boosting = false;
    latestData.p1OnGround = false;
    latestData.p1OnWall = false;
    latestData.p1Powersliding = false;
    latestData.p1Demolished = false;
    latestData.p1Supersonic = false;
  }

  // P2 Fast Numerical/Boolean State
  const p2 = teammates[0] || null;
  if (p2) {
    latestData.p2Speed = Math.trunc(p2.Speed || 0);
    latestData.p2Boost = Math.max(0, Math.min(100, Math.round(p2.Boost || 0)));
    latestData.p2HasCar = Boolean(p2.bHasCar);
    latestData.p2Boosting = Boolean(p2.bBoosting);
    latestData.p2OnGround = Boolean(p2.bOnGround);
    latestData.p2OnWall = Boolean(p2.bOnWall);
    latestData.p2Powersliding = Boolean(p2.bPowersliding);
    latestData.p2Demolished = Boolean(p2.bDemolished);
    latestData.p2Supersonic = Boolean(p2.bSupersonic);
  } else {
    latestData.p2Speed = 0;
    latestData.p2Boost = 0;
    latestData.p2HasCar = false;
    latestData.p2Boosting = false;
    latestData.p2OnGround = false;
    latestData.p2OnWall = false;
    latestData.p2Powersliding = false;
    latestData.p2Demolished = false;
    latestData.p2Supersonic = false;
  }

  // P3 Fast Numerical/Boolean State
  const p3 = teammates[1] || null;
  if (p3) {
    latestData.p3Speed = Math.trunc(p3.Speed || 0);
    latestData.p3Boost = Math.max(0, Math.min(100, Math.round(p3.Boost || 0)));
    latestData.p3HasCar = Boolean(p3.bHasCar);
    latestData.p3Boosting = Boolean(p3.bBoosting);
    latestData.p3OnGround = Boolean(p3.bOnGround);
    latestData.p3OnWall = Boolean(p3.bOnWall);
    latestData.p3Powersliding = Boolean(p3.bPowersliding);
    latestData.p3Demolished = Boolean(p3.bDemolished);
    latestData.p3Supersonic = Boolean(p3.bSupersonic);
  } else {
    latestData.p3Speed = 0;
    latestData.p3Boost = 0;
    latestData.p3HasCar = false;
    latestData.p3Boosting = false;
    latestData.p3OnGround = false;
    latestData.p3OnWall = false;
    latestData.p3Powersliding = false;
    latestData.p3Demolished = false;
    latestData.p3Supersonic = false;
  }
}

export function handleIncomingMessage(raw: RLWebSocketMessage): void {
  const eventName = raw.Event;

  // 1. Timeline Capture Console Logger (Browser Console collapses consecutive identical lines)
  if (isTimelineCaptureEnabled && eventName && (timelineCaptureEvents.includes(eventName) || timelineCaptureEvents.includes('*'))) {
    console.log(eventName);
  }

  // 2. Packet Inspector Capture
  if (isCaptureRequested && eventName && (captureTargetEvents.includes(eventName) || captureTargetEvents.includes('*'))) {
    isCaptureRequested = false;
    emitTo('configurator', 'packet-captured', {
      event: eventName,
      packet: JSON.stringify(raw, null, 2)
    });
  }

  // 3. Check if incoming event triggers low-frequency property sync
  if (eventName && lowFreqTriggerEvents.includes(eventName)) {
    isLowFrequencySyncPending = true;
  }

  switch (eventName) {
    case 'BallHit':
    case 'ball_hit':
    case 'Ball_Hit': {
      overlayState.hasReceivedDataSinceConnected = true;
      if (raw.Data !== undefined || (raw as any).Ball !== undefined) {
        processBallHitPacket(raw);
        processBallHitSvgPacket(raw);
      }
      break;
    }

    case 'BoostPickup':
    case 'boost_pickup':
    case 'Boost_Pickup': {
      overlayState.hasReceivedDataSinceConnected = true;
      if (raw.Data !== undefined || (raw as any).Location !== undefined || (raw as any).BoostType !== undefined) {
        processBoostPickupPacket(raw);
      }
      break;
    }

    case 'ClockUpdatedSeconds': {
      overlayState.hasReceivedDataSinceConnected = true;
      if (raw.Data !== undefined) {
        const sec = typeof raw.Data === 'number' ? raw.Data : parseInt(raw.Data as string, 10);
        if (!isNaN(sec)) {
          latestData.timeSeconds = sec;
        }
      }
      break;
    }

    case 'GoalScored': {
      overlayState.hasReceivedDataSinceConnected = true;
      if (!raw.Data) return;
      let data: any;
      try {
        data = typeof raw.Data === 'string' ? JSON.parse(raw.Data) : raw.Data;
      } catch {
        return;
      }
      processGoalScored(data);
      break;
    }

    case 'GoalReplayStart': {
      overlayState.hasReceivedDataSinceConnected = true;
      if (overlayState.isAutoSceneControl) {
        enterReplayView();
      }
      break;
    }

    case 'GoalReplayWillEnd': {
      if (overlayState.isAutoSceneControl) {
        willEndReplayView();
      }
      break;
    }

    case 'GoalReplayEnd': {
      overlayState.hasReceivedDataSinceConnected = true;
      if (overlayState.isAutoSceneControl) {
        immediateEndReplayView();
      }
      break;
    }

    case 'MatchEnded':
    case 'MatchDestroyed': {
      if (overlayState.isAutoSceneControl) {
        immediateEndReplayView();
        switchSceneMode('empty', true);
      }
      break;
    }

    case 'CountdownBegin':
    case 'RoundStarted': {
      overlayState.hasReceivedDataSinceConnected = true;
      if (overlayState.isAutoSceneControl && overlayState.currentActiveScene === 'replay-viewer') {
        immediateEndReplayView();
      }
      if (!raw.Data) return;
      let data: RLStateData;
      try {
        data = typeof raw.Data === 'string' ? JSON.parse(raw.Data) : raw.Data;
      } catch {
        return;
      }
      if (!overlayState.isSimulating && data && typeof data === 'object' && ((data.Players && data.Players.length > 0) || data.Game)) {
        processUpdateState(data);
      }
      break;
    }

    case 'MatchCreated':
    case 'MatchInitialized':
    case 'UpdateState': {
      overlayState.hasReceivedDataSinceConnected = true;
      if (!raw.Data) return;
      let data: RLStateData;
      try {
        data = typeof raw.Data === 'string' ? JSON.parse(raw.Data) : raw.Data;
      } catch {
        return;
      }

      if (!overlayState.isSimulating) {
        processUpdateState(data);
      }
      break;
    }

    default:
      break;
  }
}

export function connectWebSocket(): void {
  isManualDisconnected = false;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  const formattedHost = wsHost.includes(':') && !wsHost.startsWith('[') ? `[${wsHost}]` : wsHost;
  const wsUrl = `ws://${formattedHost}:${wsPort}`;

  try {
    wsStatus = 'connecting';
    notifyWsStatus();
    evaluateAutoScene();

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsStatus = 'connected';
      overlayState.hasReceivedDataSinceConnected = false;
      isLowFrequencySyncPending = true;
      notifyWsStatus();
      evaluateAutoScene();
    };

    ws.onmessage = (event) => {
      try {
        const raw: RLWebSocketMessage = JSON.parse(event.data);
        handleIncomingMessage(raw);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      wsStatus = 'disconnected';
      overlayState.hasReceivedDataSinceConnected = false;
      notifyWsStatus();
      evaluateAutoScene();
      if (!isManualDisconnected && !isAutoRetryDisabled && !retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          connectWebSocket();
        }, 1000);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  } catch {
    wsStatus = 'disconnected';
    overlayState.hasReceivedDataSinceConnected = false;
    notifyWsStatus();
    evaluateAutoScene();
    if (!isManualDisconnected && !isAutoRetryDisabled && !retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connectWebSocket();
      }, 1000);
    }
  }
}

export function disconnectWebSocket(): void {
  isManualDisconnected = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  wsStatus = 'disconnected';
  overlayState.hasReceivedDataSinceConnected = false;
  notifyWsStatus();
  evaluateAutoScene();
}

// Sample mock init
const REAL_SAMPLE_RAW: RLStateData = {
  MatchGuid: "852D9D5546F30BE5E44F6C88F7ED98EA",
  Players: [
    { Name: "steamuser", Shortcut: 5, TeamNum: 1, bHasCar: true, Speed: 82.7996, Boost: 11, bSupersonic: true },
    { Name: "Fury", Shortcut: 1, TeamNum: 0, bHasCar: true, Speed: 40.0, Boost: 50 },
    { Name: "Sticks", Shortcut: 6, TeamNum: 1, bOnGround: true, bHasCar: true, Speed: 82.7997, Boost: 15, bBoosting: true, bSupersonic: true },
    { Name: "Stinger", Shortcut: 2, TeamNum: 0, bHasCar: true, Speed: 55.0, Boost: 33 },
    { Name: "Khan", Shortcut: 7, TeamNum: 1, bOnGround: true, bHasCar: true, Speed: 26.1496, Boost: 100 },
    { Name: "Outlaw", Shortcut: 3, TeamNum: 0, bHasCar: true, Speed: 30.0, Boost: 45 }
  ],
  Game: {
    Teams: [
      { Name: "Rovers", TeamNum: 0, Score: 0, ColorPrimary: "1873FF", ColorSecondary: "E5E5E5" },
      { Name: "1", TeamNum: 1, Score: 1, ColorPrimary: "C26418", ColorSecondary: "E5E5E5" }
    ],
    PlaylistId: 24,
    TimeSeconds: 270,
    bOvertime: false,
    Ball: { Speed: 43.92, TeamNum: 0 },
    bReplay: false,
    bHasWinner: false,
    Winner: "",
    Arena: "NeoTokyo_Arcade_P",
    bHasTarget: true,
    Target: { Name: "steamuser", Shortcut: 5, TeamNum: 1 }
  }
};

export function initMockData(): void {
  isLowFrequencySyncPending = true;
  processUpdateState(REAL_SAMPLE_RAW);
}
