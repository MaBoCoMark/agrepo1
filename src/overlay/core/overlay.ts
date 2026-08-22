/**
 * ============================================================================
 * ⚡ Overlay Main Performance Engine
 * ============================================================================
 *
 * Requirements strictly met:
 * 1. Developer Dashboard abstracted into separate independent module.
 * 2. Giant switch-case replaced with dictionary-driven componentHandlers.
 * 3. Streamlined player iteration with early exits (continue on !hasCar).
 * 4. Local property dirty-checking (dirtyGlobal, dirtyP1, dirtyP2, dirtyP3).
 * 5. State synchronization across frames.
 * ============================================================================
 */

import {
  TelemetryBuffer,
  GlobalLayoutSettings,
  DEFAULT_TEAM_COLORS,
  ColorSource,
  ComponentInstance,
  TargetPlayer
} from './component-types';
import { previousData, latestData, overlayState } from './telemetry-state';
import {
  CachedComponentInstance,
  getDevDashboardCache,
  getCompetitiveDomCache
} from './dom-cache';
import { loadGlobalLayoutSettings } from './layout-store';
import { updateMockStream } from './mock-stream';
import { recordBenchmarkFrame } from './benchmark-recorder';
import { loadLayers, switchSceneMode, switchRefMode } from './scene-manager';
import { setupOverlayEventListeners } from './event-bridge';
import { connectWebSocket } from './websocket-manager';
import { renderDevDashboard } from './dev-dashboard-renderer';
import {
  toRealUuSpeed,
  calcNonlinearSpeedProgress,
  calcSpeedColor
} from './speed-meter';

// Cached global layout settings
let globalSettings: GlobalLayoutSettings = loadGlobalLayoutSettings();

export function updateOverlayGlobalSettings(settings: GlobalLayoutSettings): void {
  globalSettings = settings;
}

// Inline helper functions for hot path
function fmtMinSec(totalSeconds: number): string {
  const isNeg = totalSeconds < 0;
  const abs = Math.abs(Math.trunc(totalSeconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${isNeg ? '-' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function fmtSpeed(speed: number, unit?: string): string {
  if (unit === 'uu/s') {
    const uu = toRealUuSpeed(speed);
    return Math.round(uu).toString();
  }
  const kph = speed > 150 ? speed * 0.036 : speed;
  return Math.round(kph).toString();
}

function fmtScoreDiff(diff: number): string {
  if (diff === 0) return '0';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

function resolveColor(
  mode: ColorSource | undefined,
  customColor: string | undefined,
  fallback: string,
  latest: TelemetryBuffer
): string {
  if (mode === 'my-primary') return latest.myPrimaryColor || DEFAULT_TEAM_COLORS.myPrimaryColor;
  if (mode === 'my-secondary') return latest.mySecondaryColor || DEFAULT_TEAM_COLORS.mySecondaryColor;
  if (mode === 'opp-primary') return latest.oppPrimaryColor || DEFAULT_TEAM_COLORS.oppPrimaryColor;
  if (mode === 'opp-secondary') return latest.oppSecondaryColor || DEFAULT_TEAM_COLORS.oppSecondaryColor;
  if (mode === 'custom' && customColor && customColor.trim().length > 0) return customColor;
  if (customColor && customColor.trim().length > 0) return customColor;
  return fallback;
}

/**
 * ============================================================================
 * 🎯 Dictionary-Driven Strategy Handlers for HUD Components
 * ============================================================================
 */

type ComponentUpdateFn = (
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  latestData: TelemetryBuffer,
  globalSettings: GlobalLayoutSettings,
  targetPlayer: TargetPlayer,
  name: string,
  speed: number,
  boost: number,
  hasCar: boolean,
  isBoosting: boolean,
  onGround: boolean,
  onWall: boolean,
  powersliding: boolean,
  demolished: boolean,
  supersonic: boolean,
  myTeamColor: string,
  oppTeamColor: string
) => void;

// 1. Boost Text
function updateBoostText(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  boost: number
): void {
  const valEl = cached.valEl;
  if (!valEl) return;
  const str = boost.toString();
  if (str !== cached.lastTextContent) {
    valEl.textContent = str;
    cached.lastTextContent = str;

    let color = inst.customProps?.colorHigh || '#10b981';
    let blink = false;
    if (boost < 12) {
      color = inst.customProps?.colorLow || '#ef4444';
      blink = inst.customProps?.enableBlink !== false && inst.componentType !== 'element-boost-text-fixed';
    } else if (boost < 30) {
      color = inst.customProps?.colorLow || '#ef4444';
    } else if (boost < 60) {
      color = inst.customProps?.colorMid || '#f59e0b';
    }

    if (blink !== cached.boostTierState.lastBlink) {
      valEl.classList.toggle('danger-blink', blink);
      cached.boostTierState.lastBlink = blink;
    }
    if (color !== cached.lastColor) {
      valEl.style.color = color;
      cached.lastColor = color;
    }
  }
}

// 2. Speed Text
function updateSpeedText(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  speed: number
): void {
  const valEl = cached.valEl;
  if (!valEl) return;
  const str = fmtSpeed(speed, inst.speedUnit);
  if (str !== cached.lastTextContent) {
    valEl.textContent = str;
    cached.lastTextContent = str;
  }
}

// 3. Player Name Text
function updatePlayerNameText(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  name: string
): void {
  const valEl = cached.valEl;
  if (valEl && name !== cached.lastTextContent) {
    valEl.textContent = name;
    cached.lastTextContent = name;
  }
}

// 4. Time Text
function updateTimeText(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  latestData: TelemetryBuffer
): void {
  const valEl = cached.valEl;
  if (valEl && latestData.timeSeconds !== cached.lastTimeSeconds) {
    valEl.textContent = fmtMinSec(latestData.timeSeconds);
    cached.lastTimeSeconds = latestData.timeSeconds;
  }
}

// 5. Ball Speed Text
function updateBallSpeedText(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  latestData: TelemetryBuffer
): void {
  const valEl = cached.valEl;
  if (!valEl) return;
  const str = fmtSpeed(latestData.ballSpeed, inst.speedUnit);
  if (str !== cached.lastTextContent) {
    valEl.textContent = str;
    cached.lastTextContent = str;
  }
}

// 6. Ball Team Text
function updateBallTeamText(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  _boost: number,
  _hasCar: boolean,
  _isBoosting: boolean,
  _onGround: boolean,
  _onWall: boolean,
  _powersliding: boolean,
  _demolished: boolean,
  _supersonic: boolean,
  myTeamColor: string,
  oppTeamColor: string
): void {
  const valEl = cached.valEl;
  if (valEl && latestData.ballTeamNum !== cached.lastBallTeam) {
    valEl.textContent = latestData.ballTeamNum === 0 ? 'BLUE' : 'ORANGE';
    valEl.style.color = latestData.ballTeamNum === 0 ? myTeamColor : oppTeamColor;
    cached.lastBallTeam = latestData.ballTeamNum;
  }
}

// 7. Score Diff Text
function updateScoreDiffText(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  latestData: TelemetryBuffer
): void {
  const valEl = cached.valEl;
  if (valEl && latestData.scoreDiff !== cached.lastScoreDiff) {
    valEl.textContent = fmtScoreDiff(latestData.scoreDiff);
    valEl.classList.toggle('score-pos', latestData.scoreDiff > 0);
    valEl.classList.toggle('score-neg', latestData.scoreDiff < 0);
    valEl.classList.toggle('score-tie', latestData.scoreDiff === 0);
    cached.lastScoreDiff = latestData.scoreDiff;
  }
}

// 8. Match Score Text
function updateMatchScoreText(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  latestData: TelemetryBuffer
): void {
  const valEl = cached.valEl;
  if (valEl) {
    const str = `${latestData.myScore} - ${latestData.oppScore}`;
    if (str !== cached.lastScoreText) {
      valEl.textContent = str;
      cached.lastScoreText = str;
    }
  }
}

// 9. Team Color Box (6-Color System)
function updateTeamColorBox(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  _boost: number,
  _hasCar: boolean,
  _isBoosting: boolean,
  _onGround: boolean,
  _onWall: boolean,
  _powersliding: boolean,
  _demolished: boolean,
  _supersonic: boolean,
  myTeamColor: string
): void {
  const boxEl = cached.boxEl;
  if (boxEl) {
    const mode = inst.customProps?.boxColorMode || 'my-primary';
    const color = resolveColor(mode, inst.customProps?.bgColor, myTeamColor, latestData);
    if (color !== cached.lastColor) {
      boxEl.style.backgroundColor = color;
      cached.lastColor = color;
    }
  }
}

// 10. Horizontal Boost Bar (GPU scaleX)
function updateHorizontalBoostBar(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  boost: number
): void {
  const fillEl = cached.fillEl;
  if (!fillEl) return;
  const scale = boost / 100;
  const transformStr = `scaleX(${scale})`;
  if (transformStr !== cached.boostTierState.lastTransform) {
    fillEl.style.transform = transformStr;
    cached.boostTierState.lastTransform = transformStr;
  }

  let currentTier = 3;
  let blink = false;
  let color = inst.customProps?.colorHigh || '#10b981';
  if (boost < 12) {
    currentTier = 0;
    color = inst.customProps?.colorLow || '#ef4444';
    blink = inst.customProps?.enableBlink !== false && inst.componentType !== 'element-boost-bar-no-blink';
  } else if (boost < 30) {
    currentTier = 1;
    color = inst.customProps?.colorLow || '#ef4444';
  } else if (boost < 60) {
    currentTier = 2;
    color = inst.customProps?.colorMid || '#f59e0b';
  }

  if (currentTier !== cached.boostTierState.tier || blink !== cached.boostTierState.lastBlink || color !== cached.lastColor) {
    cached.boostTierState.tier = currentTier;
    cached.boostTierState.lastBlink = blink;
    cached.lastColor = color;
    fillEl.style.backgroundColor = color;
    fillEl.classList.toggle('danger-blink', blink);
  }
}

// 11. Vertical Boost Bar (GPU scaleY)
function updateVerticalBoostBar(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  boost: number
): void {
  const fillEl = cached.fillEl;
  if (!fillEl) return;
  const scale = boost / 100;
  const transformStr = `scaleY(${scale})`;
  if (transformStr !== cached.boostTierState.lastTransform) {
    fillEl.style.transform = transformStr;
    cached.boostTierState.lastTransform = transformStr;
  }

  let currentTier = 3;
  let blink = false;
  let color = inst.customProps?.colorHigh || '#10b981';
  if (boost < 12) {
    currentTier = 0;
    color = inst.customProps?.colorLow || '#ef4444';
    blink = inst.customProps?.enableBlink !== false;
  } else if (boost < 30) {
    currentTier = 1;
    color = inst.customProps?.colorLow || '#ef4444';
  } else if (boost < 60) {
    currentTier = 2;
    color = inst.customProps?.colorMid || '#f59e0b';
  }

  if (currentTier !== cached.boostTierState.tier || blink !== cached.boostTierState.lastBlink || color !== cached.lastColor) {
    cached.boostTierState.tier = currentTier;
    cached.boostTierState.lastBlink = blink;
    cached.lastColor = color;
    fillEl.style.backgroundColor = color;
    fillEl.classList.toggle('danger-blink', blink);
  }
}

// 12. Boost Alert Bar
function updateBoostAlertBar(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  boost: number
): void {
  const boxEl = cached.boxEl;
  if (!boxEl) return;
  const threshold = Number(inst.customProps?.threshold ?? 12);
  const alertColor = inst.customProps?.alertColor || '#ef4444';
  const enableBlink = inst.customProps?.enableBlink !== false;
  const isAlert = boost <= threshold;

  if (isAlert !== cached.lastBoolState) {
    cached.lastBoolState = isAlert;
    if (isAlert) {
      if (enableBlink) {
        boxEl.classList.add('alert-active');
        boxEl.style.borderColor = alertColor;
        boxEl.style.boxShadow = '';
      } else {
        boxEl.classList.remove('alert-active');
        boxEl.style.borderColor = alertColor;
        boxEl.style.boxShadow = `0 0 16px ${alertColor}, inset 0 0 10px ${alertColor}`;
      }
    } else {
      boxEl.classList.remove('alert-active');
      boxEl.style.borderColor = 'transparent';
      boxEl.style.boxShadow = 'none';
    }
  }
}

// 13. Horizontal Speed Bar (Non-linear progress & 3-color dynamic transition)
function updateHorizontalSpeedBar(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  speed: number
): void {
  const fillEl = cached.fillEl;
  if (!fillEl) return;
  const uuSpeed = toRealUuSpeed(speed);
  const split1410Pos = Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40);
  const pct = calcNonlinearSpeedProgress(uuSpeed, split1410Pos);
  const transformStr = `scaleX(${pct / 100})`;
  if (transformStr !== cached.boostTierState.lastTransform) {
    fillEl.style.transform = transformStr;
    cached.boostTierState.lastTransform = transformStr;
  }

  const { color, isSupersonic } = calcSpeedColor(
    uuSpeed,
    inst.customProps?.colorLow || '#d4af37',
    inst.customProps?.colorMidStart || '#77ca7a',
    inst.customProps?.colorMidEnd || '#59f168'
  );

  if (isSupersonic !== cached.lastGlow || color !== cached.lastColor) {
    cached.lastGlow = isSupersonic;
    cached.lastColor = color;
    fillEl.style.backgroundColor = color;
    fillEl.classList.toggle('supersonic-glow', isSupersonic);
  }
}

// 14. Vertical Speed Bar (Non-linear progress & 3-color dynamic transition)
function updateVerticalSpeedBar(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  speed: number
): void {
  const fillEl = cached.fillEl;
  if (!fillEl) return;
  const uuSpeed = toRealUuSpeed(speed);
  const split1410Pos = Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40);
  const pct = calcNonlinearSpeedProgress(uuSpeed, split1410Pos);
  const transformStr = `scaleY(${pct / 100})`;
  if (transformStr !== cached.boostTierState.lastTransform) {
    fillEl.style.transform = transformStr;
    cached.boostTierState.lastTransform = transformStr;
  }

  const { color, isSupersonic } = calcSpeedColor(
    uuSpeed,
    inst.customProps?.colorLow || '#d4af37',
    inst.customProps?.colorMidStart || '#77ca7a',
    inst.customProps?.colorMidEnd || '#59f168'
  );

  if (isSupersonic !== cached.lastGlow || color !== cached.lastColor) {
    cached.lastGlow = isSupersonic;
    cached.lastColor = color;
    fillEl.style.backgroundColor = color;
    fillEl.classList.toggle('supersonic-glow', isSupersonic);
  }
}

// 15. Curved Boost Bar (SVG Arc)
function updateCurvedBoostBar(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  boost: number
): void {
  const fill = cached.fillEl as SVGCircleElement | null;
  if (!fill) return;
  const thick = Number(inst.customProps?.thickness ?? 8);
  const gap = Number(inst.customProps?.gap ?? 90);
  const orient = Number(inst.customProps?.orientation ?? 90);
  const radius = 50 - (thick / 2);
  const perimeter = 2 * Math.PI * radius;
  const activeAngle = 360 - gap;
  const totalDash = perimeter * (activeAngle / 360);
  const progressDash = totalDash * Math.max(0, Math.min(1, boost / 100));
  const dashStr = `${progressDash} ${perimeter}`;

  if (dashStr !== cached.lastCurvedDash) {
    fill.setAttribute('r', radius.toString());
    fill.setAttribute('stroke-width', thick.toString());
    fill.setAttribute('stroke-dasharray', dashStr);
    fill.style.transform = `rotate(${orient + (gap / 2)}deg)`;
    fill.style.transformOrigin = '50px 50px';
    cached.lastCurvedDash = dashStr;

    let color = inst.customProps?.colorHigh || '#10b981';
    let blink = false;
    if (boost < 12) {
      color = inst.customProps?.colorLow || '#ef4444';
      blink = inst.customProps?.enableBlink !== false;
    } else if (boost < 30) {
      color = inst.customProps?.colorLow || '#ef4444';
    } else if (boost < 60) {
      color = inst.customProps?.colorMid || '#f59e0b';
    }

    fill.setAttribute('stroke', color);
    fill.classList.toggle('danger-blink', blink);
  }
}

// 16. Curved Speedometer (SVG Arc, Non-linear progress & 3-color dynamic transition)
function updateCurvedSpeedometer(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  speed: number
): void {
  const fill = cached.fillEl as SVGCircleElement | null;
  if (!fill) return;
  const thick = Number(inst.customProps?.thickness ?? 8);
  const gap = Number(inst.customProps?.gap ?? 90);
  const orient = Number(inst.customProps?.orientation ?? 90);
  const radius = 50 - (thick / 2);
  const perimeter = 2 * Math.PI * radius;
  const activeAngle = 360 - gap;
  const totalDash = perimeter * (activeAngle / 360);
  const uuSpeed = toRealUuSpeed(speed);
  const split1410Pos = Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40);
  const pct = calcNonlinearSpeedProgress(uuSpeed, split1410Pos);
  const progressDash = totalDash * (pct / 100);
  const dashStr = `${progressDash} ${perimeter}`;

  const { color, isSupersonic } = calcSpeedColor(
    uuSpeed,
    inst.customProps?.colorLow || '#d4af37',
    inst.customProps?.colorMidStart || '#77ca7a',
    inst.customProps?.colorMidEnd || '#59f168'
  );

  if (dashStr !== cached.lastCurvedDash) {
    fill.setAttribute('r', radius.toString());
    fill.setAttribute('stroke-width', thick.toString());
    fill.setAttribute('stroke-dasharray', dashStr);
    fill.style.transform = `rotate(${orient + (gap / 2)}deg)`;
    fill.style.transformOrigin = '50px 50px';
    cached.lastCurvedDash = dashStr;
  }

  if (color !== cached.lastColor || isSupersonic !== cached.lastGlow) {
    cached.lastColor = color;
    cached.lastGlow = isSupersonic;
    fill.setAttribute('stroke', color);
    fill.classList.toggle('curved-supersonic', isSupersonic);
  }
}

// 17. Boolean Indicators (with 6-color system)
function updateBooleanIndicator(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  _boost: number,
  hasCar: boolean,
  isBoosting: boolean,
  onGround: boolean,
  onWall: boolean,
  powersliding: boolean,
  demolished: boolean,
  supersonic: boolean
): void {
  const dotEl = cached.dotEl;
  if (!dotEl) return;
  let rawVal = false;
  let defaultActiveColor = '#30d158';
  const t = inst.componentType;
  if (t === 'element-demolished-indicator') { rawVal = demolished; defaultActiveColor = '#ff453a'; }
  else if (t === 'element-hascar-indicator') { rawVal = hasCar; defaultActiveColor = '#30d158'; }
  else if (t === 'element-boosting-indicator') { rawVal = isBoosting; defaultActiveColor = '#ff9500'; }
  else if (t === 'element-onground-indicator') { rawVal = onGround; defaultActiveColor = '#0a84ff'; }
  else if (t === 'element-onwall-indicator') { rawVal = onWall; defaultActiveColor = '#bf5af2'; }
  else if (t === 'element-powersliding-indicator') { rawVal = powersliding; defaultActiveColor = '#ffd60a'; }
  else if (t === 'element-supersonic-indicator') { rawVal = supersonic; defaultActiveColor = '#bf5af2'; }
  else if (t === 'element-overtime-indicator') { rawVal = latestData.bOvertime; defaultActiveColor = '#ff453a'; }

  const isFiltered = inst.customProps?.invertBool ? !rawVal : Boolean(rawVal);
  if (isFiltered !== cached.lastBoolState) {
    cached.lastBoolState = isFiltered;
    dotEl.className = `el-pure-dot dyn-dot ${isFiltered ? 'bool-on' : 'bool-off'}`;

    const activeColor = resolveColor(
      inst.customProps?.activeColorMode,
      inst.customProps?.activeColor,
      defaultActiveColor,
      latestData
    );
    const inactiveColor = inst.customProps?.inactiveColor || 'rgba(51, 65, 85, 0.5)';
    const color = isFiltered ? activeColor : inactiveColor;
    dotEl.style.backgroundColor = color;
    if (isFiltered && color !== 'transparent' && !color.startsWith('rgba(0, 0, 0, 0)')) {
      dotEl.style.boxShadow = `0 0 10px ${color}`;
    } else {
      dotEl.style.boxShadow = 'none';
    }
  }
}

// 18. Custom Text
function updateCustomText(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  latestData: TelemetryBuffer,
  globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  _boost: number,
  hasCar: boolean,
  isBoosting: boolean,
  onGround: boolean,
  onWall: boolean,
  powersliding: boolean,
  demolished: boolean,
  supersonic: boolean
): void {
  if (cached.valEl) {
    const text = inst.customProps?.customText || 'SUPERSONIC';
    if (text !== cached.lastTextContent) {
      cached.valEl.textContent = text;
      cached.lastTextContent = text;
    }
    const boolVar = inst.customProps?.boolVar || 'supersonic';
    let stateVal = false;
    if (boolVar === 'supersonic') stateVal = supersonic;
    else if (boolVar === 'boosting') stateVal = isBoosting;
    else if (boolVar === 'hascar') stateVal = hasCar;
    else if (boolVar === 'onground') stateVal = onGround;
    else if (boolVar === 'onwall') stateVal = onWall;
    else if (boolVar === 'powersliding') stateVal = powersliding;
    else if (boolVar === 'demolished') stateVal = demolished;
    else if (boolVar === 'overtime') stateVal = latestData.bOvertime;

    const isFiltered = inst.customProps?.invertBool ? !stateVal : Boolean(stateVal);
    if (isFiltered !== cached.lastBoolState) {
      cached.lastBoolState = isFiltered;
      const effectiveOpacity = inst.followGlobal !== false ? (globalSettings.opacity ?? 1.0) : (inst.opacity ?? 1.0);
      const enOp = inst.customProps?.enabledOpacity ?? 1.0;
      const disOp = inst.customProps?.disabledOpacity ?? 0.2;
      cached.container.style.opacity = (effectiveOpacity * (isFiltered ? enOp : disOp)).toString();
    }
  }
}

// 19. Score Diff Widget
function updateScoreDiffWidget(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  latestData: TelemetryBuffer
): void {
  if (cached.valEl && latestData.scoreDiff !== cached.lastScoreDiff) {
    cached.valEl.textContent = fmtScoreDiff(latestData.scoreDiff);
    cached.valEl.classList.toggle('score-pos', latestData.scoreDiff > 0);
    cached.valEl.classList.toggle('score-neg', latestData.scoreDiff < 0);
    cached.valEl.classList.toggle('score-tie', latestData.scoreDiff === 0);
    cached.lastScoreDiff = latestData.scoreDiff;
  }
  if (cached.subValEl) {
    const s = `${latestData.myScore}-${latestData.oppScore}`;
    if (s !== cached.lastScoreText) {
      cached.subValEl.textContent = s;
      cached.lastScoreText = s;
    }
  }
}

// 20. Time Remaining Widget
function updateTimeRemainingWidget(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  latestData: TelemetryBuffer
): void {
  if (cached.valEl && latestData.timeSeconds !== cached.lastTimeSeconds) {
    cached.valEl.textContent = fmtMinSec(latestData.timeSeconds);
    cached.lastTimeSeconds = latestData.timeSeconds;
  }
}

// 21. Team Colors Widget
function updateTeamColorsWidget(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  _boost: number,
  _hasCar: boolean,
  _isBoosting: boolean,
  _onGround: boolean,
  _onWall: boolean,
  _powersliding: boolean,
  _demolished: boolean,
  _supersonic: boolean,
  myTeamColor: string,
  oppTeamColor: string
): void {
  if (cached.myPrimary && myTeamColor !== cached.lastColor) {
    cached.myPrimary.style.backgroundColor = myTeamColor;
    cached.lastColor = myTeamColor;
  }
  if (cached.oppPrimary) {
    cached.oppPrimary.style.backgroundColor = oppTeamColor;
  }
}

// 22. Boost Combo Widget
function updateBoostComboWidget(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  _name: string,
  _speed: number,
  boost: number
): void {
  if (cached.valEl && boost !== cached.boostTierState.lastVal) {
    cached.valEl.textContent = boost.toString();
  }
  if (cached.fillEl) {
    const scale = boost / 100;
    const transformStr = `scaleX(${scale})`;
    if (transformStr !== cached.boostTierState.lastTransform) {
      cached.fillEl.style.transform = transformStr;
      cached.boostTierState.lastTransform = transformStr;
      const color = boost < 30 ? '#ef4444' : boost < 60 ? '#f59e0b' : '#10b981';
      cached.fillEl.style.backgroundColor = color;
      cached.fillEl.classList.toggle('danger-blink', boost < 12);
    }
    cached.boostTierState.lastVal = boost;
  }
}

// 23. Match Header Panel
function updateMatchHeaderPanel(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  latestData: TelemetryBuffer
): void {
  if (cached.diffVal && latestData.scoreDiff !== cached.lastScoreDiff) {
    cached.diffVal.textContent = fmtScoreDiff(latestData.scoreDiff);
    cached.diffVal.classList.toggle('score-pos', latestData.scoreDiff > 0);
    cached.diffVal.classList.toggle('score-neg', latestData.scoreDiff < 0);
    cached.diffVal.classList.toggle('score-tie', latestData.scoreDiff === 0);
    cached.lastScoreDiff = latestData.scoreDiff;
  }
  if (cached.scoreText) {
    const s = `${latestData.myScore} - ${latestData.oppScore}`;
    if (s !== cached.lastScoreText) {
      cached.scoreText.textContent = s;
      cached.lastScoreText = s;
    }
  }
  if (cached.timeVal && latestData.timeSeconds !== cached.lastTimeSeconds) {
    cached.timeVal.textContent = fmtMinSec(latestData.timeSeconds);
    cached.lastTimeSeconds = latestData.timeSeconds;
  }
  if (cached.otVal && latestData.bOvertime !== cached.lastBoolState) {
    cached.lastBoolState = latestData.bOvertime;
    cached.otVal.textContent = latestData.bOvertime ? 'OVERTIME' : 'REGULAR';
    cached.otVal.style.color = latestData.bOvertime ? '#f59e0b' : '#64748b';
  }
  if (cached.ballVal) {
    const spd = `${fmtSpeed(latestData.ballSpeed, inst.speedUnit)} ${inst.speedUnit === 'uu/s' ? 'uu/s' : 'km/h'}`;
    if (spd !== cached.lastSpeedDisplay) {
      cached.ballVal.textContent = spd;
      cached.lastSpeedDisplay = spd;
    }
  }
}

// 24. Player Telemetry Panel
function updatePlayerTelemetryPanel(
  cached: CachedComponentInstance,
  inst: ComponentInstance,
  _latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings,
  _targetPlayer: TargetPlayer,
  name: string,
  speed: number,
  boost: number,
  hasCar: boolean,
  isBoosting: boolean,
  onGround: boolean,
  onWall: boolean,
  powersliding: boolean,
  demolished: boolean,
  supersonic: boolean
): void {
  if (cached.p1Name && name !== cached.lastTextContent) {
    cached.p1Name.textContent = name;
    cached.lastTextContent = name;
  }
  if (cached.valEl) {
    const spd = fmtSpeed(speed, inst.speedUnit);
    if (spd !== cached.lastSpeedDisplay) {
      cached.valEl.textContent = spd;
      cached.lastSpeedDisplay = spd;
    }
  }
  if (cached.p1Val && boost !== cached.boostTierState.lastVal) {
    cached.p1Val.textContent = boost.toString();
  }
  if (cached.p1Fill) {
    const transformStr = `scaleX(${boost / 100})`;
    if (transformStr !== cached.boostTierState.lastTransform) {
      cached.p1Fill.style.transform = transformStr;
      cached.boostTierState.lastTransform = transformStr;
      cached.p1Fill.style.backgroundColor = boost < 30 ? '#ef4444' : boost < 60 ? '#f59e0b' : '#10b981';
    }
    cached.boostTierState.lastVal = boost;
  }
  if (cached.dotCar) cached.dotCar.className = `status-dot dyn-hascar ${hasCar ? 'bool-on' : 'bool-off'}`;
  if (cached.dotBoost) cached.dotBoost.className = `status-dot dyn-boosting ${isBoosting ? 'bool-on' : 'bool-off'}`;
  if (cached.dotGround) cached.dotGround.className = `status-dot dyn-onground ${onGround ? 'bool-on' : 'bool-off'}`;
  if (cached.dotWall) cached.dotWall.className = `status-dot dyn-onwall ${onWall ? 'bool-on' : 'bool-off'}`;
  if (cached.dotSlide) cached.dotSlide.className = `status-dot dyn-slide ${powersliding ? 'bool-on' : 'bool-off'}`;
  if (cached.dotDemo) cached.dotDemo.className = `status-dot dyn-demo ${demolished ? 'bool-on' : 'bool-off'}`;
  if (cached.dotSuper) cached.dotSuper.className = `status-dot dyn-super ${supersonic ? 'bool-on' : 'bool-off'}`;
}

// 25. Team Roster Panel
function updateTeamRosterPanel(
  cached: CachedComponentInstance,
  _inst: ComponentInstance,
  latestData: TelemetryBuffer,
  _globalSettings: GlobalLayoutSettings
): void {
  if (cached.p1Name && latestData.p1Name !== cached.lastTextContent) {
    cached.p1Name.textContent = latestData.p1Name;
    cached.lastTextContent = latestData.p1Name;
  }
  if (cached.p1Val && latestData.p1Boost !== cached.boostTierState.lastVal) {
    cached.p1Val.textContent = latestData.p1Boost.toString();
  }
  if (cached.p1Fill) {
    const transformStr = `scaleX(${latestData.p1Boost / 100})`;
    if (transformStr !== cached.boostTierState.lastTransform) {
      cached.p1Fill.style.transform = transformStr;
      cached.boostTierState.lastTransform = transformStr;
      cached.p1Fill.style.backgroundColor = latestData.p1Boost < 30 ? '#ef4444' : latestData.p1Boost < 60 ? '#f59e0b' : '#10b981';
    }
    cached.boostTierState.lastVal = latestData.p1Boost;
  }

  if (cached.p2Name && latestData.p2Name !== previousData.p2Name) cached.p2Name.textContent = latestData.p2Name;
  if (cached.p2Val && latestData.p2Boost !== previousData.p2Boost) cached.p2Val.textContent = latestData.p2Boost.toString();
  if (cached.p2Fill && latestData.p2Boost !== previousData.p2Boost) {
    cached.p2Fill.style.transform = `scaleX(${latestData.p2Boost / 100})`;
    cached.p2Fill.style.backgroundColor = latestData.p2Boost < 30 ? '#ef4444' : latestData.p2Boost < 60 ? '#f59e0b' : '#10b981';
  }

  if (cached.p3Name && latestData.p3Name !== previousData.p3Name) cached.p3Name.textContent = latestData.p3Name;
  if (cached.p3Val && latestData.p3Boost !== previousData.p3Boost) cached.p3Val.textContent = latestData.p3Boost.toString();
  if (cached.p3Fill && latestData.p3Boost !== previousData.p3Boost) {
    cached.p3Fill.style.transform = `scaleX(${latestData.p3Boost / 100})`;
    cached.p3Fill.style.backgroundColor = latestData.p3Boost < 30 ? '#ef4444' : latestData.p3Boost < 60 ? '#f59e0b' : '#10b981';
  }
}

/**
 * Component Handlers Strategy Dictionary
 */
const componentHandlers: Record<string, ComponentUpdateFn> = {
  'element-boost-text': updateBoostText,
  'element-boost-text-fixed': updateBoostText,
  'element-speed-text': updateSpeedText,
  'element-player-name-text': updatePlayerNameText,
  'element-time-text': updateTimeText,
  'element-ball-speed-text': updateBallSpeedText,
  'element-ball-team-text': updateBallTeamText,
  'element-score-diff-text': updateScoreDiffText,
  'element-match-score-text': updateMatchScoreText,
  'element-team-color-box': updateTeamColorBox,

  'element-boost-bar': updateHorizontalBoostBar,
  'element-boost-bar-no-blink': updateHorizontalBoostBar,
  'boost-bar': updateHorizontalBoostBar,
  'player-boost-bar': updateHorizontalBoostBar,
  'widget-boost-bar': updateHorizontalBoostBar,

  'element-vertical-boost-bar': updateVerticalBoostBar,
  'element-boost-alert-bar': updateBoostAlertBar,

  'element-speed-bar': updateHorizontalSpeedBar,
  'element-vertical-speed-bar': updateVerticalSpeedBar,

  'element-curved-boost-bar': updateCurvedBoostBar,
  'element-curved-speedometer': updateCurvedSpeedometer,

  'element-demolished-indicator': updateBooleanIndicator,
  'element-hascar-indicator': updateBooleanIndicator,
  'element-boosting-indicator': updateBooleanIndicator,
  'element-onground-indicator': updateBooleanIndicator,
  'element-onwall-indicator': updateBooleanIndicator,
  'element-powersliding-indicator': updateBooleanIndicator,
  'element-supersonic-indicator': updateBooleanIndicator,
  'element-overtime-indicator': updateBooleanIndicator,

  'element-custom-text': updateCustomText,
  'custom-text': updateCustomText,

  'score-diff': updateScoreDiffWidget,
  'widget-score-diff': updateScoreDiffWidget,

  'time-remaining': updateTimeRemainingWidget,
  'widget-time-remaining': updateTimeRemainingWidget,

  'team-colors': updateTeamColorsWidget,
  'widget-team-colors': updateTeamColorsWidget,

  'boost-combo': updateBoostComboWidget,
  'widget-boost-combo': updateBoostComboWidget,

  'panel-match-header': updateMatchHeaderPanel,
  'panel-player-telemetry': updatePlayerTelemetryPanel,
  'panel-team-roster': updateTeamRosterPanel,
};

/**
 * ============================================================================
 * 🏎️ High-Frequency Animation Tick Loop (@ 120Hz - 360Hz+)
 * ============================================================================
 */
function tick(now: number): void {
  // 1. Log benchmark frame timestamp if recording
  recordBenchmarkFrame(now);

  // 2. Step mock physics simulation if enabled
  if (overlayState.isSimulating) {
    updateMockStream(latestData);
  }

  // 3. Developer Dashboard Renderer (Abstracted into separate module)
  if (overlayState.isDevDashboardVisible) {
    const devDom = getDevDashboardCache();
    if (devDom) {
      renderDevDashboard(latestData, previousData, devDom);
    }
  }

  // 4. Competitive Scene HUD Renderer (Dictionary-driven with early exits & dirty checking)
  if (overlayState.isCompetitiveVisible) {
    const cachedInstances = getCompetitiveDomCache();
    const len = cachedInstances.length;
    const autoHide = globalSettings.autoHideNonExistingPlayers !== false;
    const myTeamColor = latestData.myPrimaryColor || DEFAULT_TEAM_COLORS.myPrimaryColor;
    const oppTeamColor = latestData.oppPrimaryColor || DEFAULT_TEAM_COLORS.oppPrimaryColor;

    // Local property dirty-checking flags
    const dirtyGlobal = (
      latestData.timeSeconds !== previousData.timeSeconds ||
      latestData.bOvertime !== previousData.bOvertime ||
      latestData.ballSpeed !== previousData.ballSpeed ||
      latestData.ballTeamNum !== previousData.ballTeamNum ||
      latestData.myScore !== previousData.myScore ||
      latestData.oppScore !== previousData.oppScore ||
      latestData.scoreDiff !== previousData.scoreDiff ||
      latestData.myPrimaryColor !== previousData.myPrimaryColor ||
      latestData.mySecondaryColor !== previousData.mySecondaryColor ||
      latestData.oppPrimaryColor !== previousData.oppPrimaryColor ||
      latestData.oppSecondaryColor !== previousData.oppSecondaryColor
    );

    const dirtyP1 = (
      latestData.p1Name !== previousData.p1Name ||
      latestData.p1Speed !== previousData.p1Speed ||
      latestData.p1Boost !== previousData.p1Boost ||
      latestData.p1HasCar !== previousData.p1HasCar ||
      latestData.p1Boosting !== previousData.p1Boosting ||
      latestData.p1OnGround !== previousData.p1OnGround ||
      latestData.p1OnWall !== previousData.p1OnWall ||
      latestData.p1Powersliding !== previousData.p1Powersliding ||
      latestData.p1Demolished !== previousData.p1Demolished ||
      latestData.p1Supersonic !== previousData.p1Supersonic
    );

    const dirtyP2 = (
      latestData.p2Name !== previousData.p2Name ||
      latestData.p2Speed !== previousData.p2Speed ||
      latestData.p2Boost !== previousData.p2Boost ||
      latestData.p2HasCar !== previousData.p2HasCar ||
      latestData.p2Boosting !== previousData.p2Boosting ||
      latestData.p2OnGround !== previousData.p2OnGround ||
      latestData.p2OnWall !== previousData.p2OnWall ||
      latestData.p2Powersliding !== previousData.p2Powersliding ||
      latestData.p2Demolished !== previousData.p2Demolished ||
      latestData.p2Supersonic !== previousData.p2Supersonic
    );

    const dirtyP3 = (
      latestData.p3Name !== previousData.p3Name ||
      latestData.p3Speed !== previousData.p3Speed ||
      latestData.p3Boost !== previousData.p3Boost ||
      latestData.p3HasCar !== previousData.p3HasCar ||
      latestData.p3Boosting !== previousData.p3Boosting ||
      latestData.p3OnGround !== previousData.p3OnGround ||
      latestData.p3OnWall !== previousData.p3OnWall ||
      latestData.p3Powersliding !== previousData.p3Powersliding ||
      latestData.p3Demolished !== previousData.p3Demolished ||
      latestData.p3Supersonic !== previousData.p3Supersonic
    );

    for (let i = 0; i < len; i++) {
      const cached = cachedInstances[i];
      const inst = cached.inst;
      const container = cached.container;
      const p: TargetPlayer = inst.targetPlayer || 'p1';

      // Dynamic player properties
      const name = p === 'p1' ? latestData.p1Name : p === 'p2' ? latestData.p2Name : latestData.p3Name;
      const speed = p === 'p1' ? latestData.p1Speed : p === 'p2' ? latestData.p2Speed : latestData.p3Speed;
      const boost = p === 'p1' ? latestData.p1Boost : p === 'p2' ? latestData.p2Boost : latestData.p3Boost;
      const hasCar = p === 'p1' ? latestData.p1HasCar : p === 'p2' ? latestData.p2HasCar : latestData.p3HasCar;
      const isBoosting = p === 'p1' ? latestData.p1Boosting : p === 'p2' ? latestData.p2Boosting : latestData.p3Boosting;
      const onGround = p === 'p1' ? latestData.p1OnGround : p === 'p2' ? latestData.p2OnGround : latestData.p3OnGround;
      const onWall = p === 'p1' ? latestData.p1OnWall : p === 'p2' ? latestData.p2OnWall : latestData.p3OnWall;
      const powersliding = p === 'p1' ? latestData.p1Powersliding : p === 'p2' ? latestData.p2Powersliding : latestData.p3Powersliding;
      const demolished = p === 'p1' ? latestData.p1Demolished : p === 'p2' ? latestData.p2Demolished : latestData.p3Demolished;
      const supersonic = p === 'p1' ? latestData.p1Supersonic : p === 'p2' ? latestData.p2Supersonic : latestData.p3Supersonic;

      // Dynamic player early exit check: for dynamic players (P2 & P3), if !hasCar, skip iteration
      if (p !== 'p1') {
        if (!hasCar) {
          if (autoHide && cached.lastDisplay !== 'none') {
            container.style.display = 'none';
            cached.lastDisplay = 'none';
          }
          continue;
        }
      }

      // Auto-hide non-existing players' components
      if (autoHide && (inst.category === 'player' || inst.targetPlayer)) {
        if (!hasCar) {
          if (cached.lastDisplay !== 'none') {
            container.style.display = 'none';
            cached.lastDisplay = 'none';
          }
          continue;
        } else if (cached.lastDisplay !== '') {
          container.style.display = '';
          cached.lastDisplay = '';
        }
      } else if (cached.lastDisplay !== '') {
        container.style.display = '';
        cached.lastDisplay = '';
      }

      // Dirty check to skip unchanged components
      const type = inst.componentType;
      let isDirty = false;
      if (type === 'panel-team-roster') {
        isDirty = dirtyP1 || dirtyP2 || dirtyP3;
      } else if (type === 'panel-match-header') {
        isDirty = dirtyGlobal;
      } else if (type === 'panel-player-telemetry') {
        isDirty = p === 'p1' ? dirtyP1 : p === 'p2' ? dirtyP2 : dirtyP3;
      } else if (
        inst.category === 'global' ||
        type.includes('time') ||
        type.includes('ball') ||
        type.includes('score') ||
        type.includes('team-color') ||
        type === 'element-overtime-indicator'
      ) {
        isDirty = dirtyGlobal;
      } else {
        isDirty = p === 'p1' ? dirtyP1 : p === 'p2' ? dirtyP2 : dirtyP3;
      }

      if (!isDirty) {
        continue;
      }

      // Strategy pattern handler dispatch
      const handler = componentHandlers[type];
      if (handler) {
        handler(
          cached,
          inst,
          latestData,
          globalSettings,
          p,
          name,
          speed,
          boost,
          hasCar,
          isBoosting,
          onGround,
          onWall,
          powersliding,
          demolished,
          supersonic,
          myTeamColor,
          oppTeamColor
        );
      }
    }
  }

  // 5. State Synchronization: Update previousData for next frame
  previousData.timeSeconds = latestData.timeSeconds;
  previousData.bOvertime = latestData.bOvertime;
  previousData.ballSpeed = latestData.ballSpeed;
  previousData.ballTeamNum = latestData.ballTeamNum;
  previousData.myScore = latestData.myScore;
  previousData.oppScore = latestData.oppScore;
  previousData.scoreDiff = latestData.scoreDiff;
  previousData.myPrimaryColor = latestData.myPrimaryColor;
  previousData.mySecondaryColor = latestData.mySecondaryColor;
  previousData.oppPrimaryColor = latestData.oppPrimaryColor;
  previousData.oppSecondaryColor = latestData.oppSecondaryColor;

  previousData.p1Name = latestData.p1Name;
  previousData.p1Speed = latestData.p1Speed;
  previousData.p1Boost = latestData.p1Boost;
  previousData.p1HasCar = latestData.p1HasCar;
  previousData.p1Boosting = latestData.p1Boosting;
  previousData.p1OnGround = latestData.p1OnGround;
  previousData.p1OnWall = latestData.p1OnWall;
  previousData.p1Powersliding = latestData.p1Powersliding;
  previousData.p1Demolished = latestData.p1Demolished;
  previousData.p1Supersonic = latestData.p1Supersonic;

  previousData.p2Name = latestData.p2Name;
  previousData.p2Speed = latestData.p2Speed;
  previousData.p2Boost = latestData.p2Boost;
  previousData.p2HasCar = latestData.p2HasCar;
  previousData.p2Boosting = latestData.p2Boosting;
  previousData.p2OnGround = latestData.p2OnGround;
  previousData.p2OnWall = latestData.p2OnWall;
  previousData.p2Powersliding = latestData.p2Powersliding;
  previousData.p2Demolished = latestData.p2Demolished;
  previousData.p2Supersonic = latestData.p2Supersonic;

  previousData.p3Name = latestData.p3Name;
  previousData.p3Speed = latestData.p3Speed;
  previousData.p3Boost = latestData.p3Boost;
  previousData.p3HasCar = latestData.p3HasCar;
  previousData.p3Boosting = latestData.p3Boosting;
  previousData.p3OnGround = latestData.p3OnGround;
  previousData.p3OnWall = latestData.p3OnWall;
  previousData.p3Powersliding = latestData.p3Powersliding;
  previousData.p3Demolished = latestData.p3Demolished;
  previousData.p3Supersonic = latestData.p3Supersonic;

  // 6. Schedule next frame
  requestAnimationFrame(tick);
}

/**
 * Bootstrap low-frequency overlay subsystems
 */
async function bootstrap(): Promise<void> {
  try {
    await loadLayers();
    await setupOverlayEventListeners();
    switchRefMode('empty');
    switchSceneMode('not-connected');
    connectWebSocket();
    requestAnimationFrame(tick);
  } catch (err) {
    console.error('Failed to bootstrap overlay:', err);
    requestAnimationFrame(tick);
  }
}

if (typeof window !== 'undefined') {
  bootstrap();
}
