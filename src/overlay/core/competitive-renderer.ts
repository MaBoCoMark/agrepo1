import {
  TelemetryBuffer,
  GlobalLayoutSettings,
  DEFAULT_TEAM_COLORS,
  ColorSource,
  TargetPlayer
} from './component-types';
import { CachedComponentInstance, updateReelSlot } from './dom-cache';
import { loadGlobalLayoutSettings } from './layout-store';
import {
  toRealUuSpeed,
  calcNonlinearSpeedProgress,
  calcSpeedColor
} from './speed-meter';

/**
 * ============================================================================
 * 🏎️ Competitive Scene High-Performance Reactive HUD Engine
 * ============================================================================
 *
 * Performance Architecture:
 * 1. Zero full-loop iterations inside RAF. Component listeners are indexed by property.
 * 2. Property selective update:
 *    if (previousData.prop !== latestData.prop) {
 *      listeners.forEach(fn => fn(latestData.prop));
 *      previousData.prop = latestData.prop;
 *    }
 * 3. 0 layout reflows / forced layout computations (GPU scale transforms, digit slot transforms, cached text, tier checks).
 * 4. Zero memory allocations / GC pressure inside high-frequency render ticks.
 * 5. Auto-hide non-existing players (P2 & P3) decoupled from high-frequency tick loop and
 *    evaluated strictly on low-frequency data triggers.
 * ============================================================================
 */

let globalSettings: GlobalLayoutSettings = loadGlobalLayoutSettings();
let boundCachedInstances: CachedComponentInstance[] = [];
let currentP2Exists = true;
let currentP3Exists = true;

export function getOverlayGlobalSettings(): GlobalLayoutSettings { return globalSettings; }

export function updateOverlayGlobalSettings(settings: GlobalLayoutSettings): void {
  globalSettings = settings;
}

/**
 * Evaluates visibility for non-existing player components (P2 and P3)
 * strictly tied to low-frequency match/sync events.
 */
export function applyAutoHideNonExistingPlayers(
  p2Exists?: boolean,
  p3Exists?: boolean,
  cachedInstances?: CachedComponentInstance[]
): void {
  if (p2Exists !== undefined) currentP2Exists = p2Exists;
  if (p3Exists !== undefined) currentP3Exists = p3Exists;

  const instances = cachedInstances || boundCachedInstances;
  if (!instances || instances.length === 0) return;
  const autoHide = globalSettings.autoHideNonExistingPlayers !== false;

  for (let i = 0; i < instances.length; i++) {
    const cached = instances[i];
    const inst = cached.inst;
    const p: TargetPlayer = inst.targetPlayer || 'p1';

    if (inst.category === 'player' || inst.targetPlayer) {
      if (p === 'p2') {
        const show = !autoHide || currentP2Exists;
        const targetDisplay = show ? '' : 'none';
        if (cached.lastDisplay !== targetDisplay) {
          cached.container.style.display = targetDisplay;
          cached.lastDisplay = targetDisplay;
        }
      } else if (p === 'p3') {
        const show = !autoHide || currentP3Exists;
        const targetDisplay = show ? '' : 'none';
        if (cached.lastDisplay !== targetDisplay) {
          cached.container.style.display = targetDisplay;
          cached.lastDisplay = targetDisplay;
        }
      }
    }
  }
}

// Inlined formatting helpers
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

// ----------------------------------------------------------------------------
// Property Listeners
// ----------------------------------------------------------------------------
type NumberListener = (val: number) => void;
type StringListener = (val: string) => void;
type BoolListener = (val: boolean) => void;
type VoidListener = () => void;

let timeSecondsListeners: NumberListener[] = [];
let bOvertimeListeners: BoolListener[] = [];
let ballSpeedListeners: NumberListener[] = [];
let ballTeamListeners: NumberListener[] = [];
let scoreDiffListeners: NumberListener[] = [];
let matchScoreListeners: VoidListener[] = [];
let myScoreListeners: NumberListener[] = [];
let oppScoreListeners: NumberListener[] = [];
let teamColorsListeners: VoidListener[] = [];

// P1
let p1SpeedListeners: NumberListener[] = [];
let p1BoostListeners: NumberListener[] = [];
let p1NameListeners: StringListener[] = [];
let p1HasCarListeners: BoolListener[] = [];
let p1BoostingListeners: BoolListener[] = [];
let p1OnGroundListeners: BoolListener[] = [];
let p1OnWallListeners: BoolListener[] = [];
let p1PowerslidingListeners: BoolListener[] = [];
let p1DemolishedListeners: BoolListener[] = [];
let p1SupersonicListeners: BoolListener[] = [];

// P2
let p2SpeedListeners: NumberListener[] = [];
let p2BoostListeners: NumberListener[] = [];
let p2NameListeners: StringListener[] = [];
let p2HasCarListeners: BoolListener[] = [];
let p2BoostingListeners: BoolListener[] = [];
let p2OnGroundListeners: BoolListener[] = [];
let p2OnWallListeners: BoolListener[] = [];
let p2PowerslidingListeners: BoolListener[] = [];
let p2DemolishedListeners: BoolListener[] = [];
let p2SupersonicListeners: BoolListener[] = [];

// P3
let p3SpeedListeners: NumberListener[] = [];
let p3BoostListeners: NumberListener[] = [];
let p3NameListeners: StringListener[] = [];
let p3HasCarListeners: BoolListener[] = [];
let p3BoostingListeners: BoolListener[] = [];
let p3OnGroundListeners: BoolListener[] = [];
let p3OnWallListeners: BoolListener[] = [];
let p3PowerslidingListeners: BoolListener[] = [];
let p3DemolishedListeners: BoolListener[] = [];
let p3SupersonicListeners: BoolListener[] = [];

function addSpeedListener(p: TargetPlayer, fn: NumberListener) {
  if (p === 'p1') p1SpeedListeners.push(fn);
  else if (p === 'p2') p2SpeedListeners.push(fn);
  else if (p === 'p3') p3SpeedListeners.push(fn);
}

function addBoostListener(p: TargetPlayer, fn: NumberListener) {
  if (p === 'p1') p1BoostListeners.push(fn);
  else if (p === 'p2') p2BoostListeners.push(fn);
  else if (p === 'p3') p3BoostListeners.push(fn);
}

function addNameListener(p: TargetPlayer, fn: StringListener) {
  if (p === 'p1') p1NameListeners.push(fn);
  else if (p === 'p2') p2NameListeners.push(fn);
  else if (p === 'p3') p3NameListeners.push(fn);
}

function addHasCarListener(p: TargetPlayer, fn: BoolListener) {
  if (p === 'p1') p1HasCarListeners.push(fn);
  else if (p === 'p2') p2HasCarListeners.push(fn);
  else if (p === 'p3') p3HasCarListeners.push(fn);
}

function addBoostingListener(p: TargetPlayer, fn: BoolListener) {
  if (p === 'p1') p1BoostingListeners.push(fn);
  else if (p === 'p2') p2BoostingListeners.push(fn);
  else if (p === 'p3') p3BoostingListeners.push(fn);
}

function addOnGroundListener(p: TargetPlayer, fn: BoolListener) {
  if (p === 'p1') p1OnGroundListeners.push(fn);
  else if (p === 'p2') p2OnGroundListeners.push(fn);
  else if (p === 'p3') p3OnGroundListeners.push(fn);
}

function addOnWallListener(p: TargetPlayer, fn: BoolListener) {
  if (p === 'p1') p1OnWallListeners.push(fn);
  else if (p === 'p2') p2OnWallListeners.push(fn);
  else if (p === 'p3') p3OnWallListeners.push(fn);
}

function addPowerslidingListener(p: TargetPlayer, fn: BoolListener) {
  if (p === 'p1') p1PowerslidingListeners.push(fn);
  else if (p === 'p2') p2PowerslidingListeners.push(fn);
  else if (p === 'p3') p3PowerslidingListeners.push(fn);
}

function addDemolishedListener(p: TargetPlayer, fn: BoolListener) {
  if (p === 'p1') p1DemolishedListeners.push(fn);
  else if (p === 'p2') p2DemolishedListeners.push(fn);
  else if (p === 'p3') p3DemolishedListeners.push(fn);
}

function addSupersonicListener(p: TargetPlayer, fn: BoolListener) {
  if (p === 'p1') p1SupersonicListeners.push(fn);
  else if (p === 'p2') p2SupersonicListeners.push(fn);
  else if (p === 'p3') p3SupersonicListeners.push(fn);
}

/**
 * Compiles reactive listeners when Competitive DOM Cache is built.
 */
export function bindCompetitiveDomCache(
  cachedInstances: CachedComponentInstance[],
  settings: GlobalLayoutSettings,
  latestData: TelemetryBuffer
): void {
  globalSettings = settings;
  boundCachedInstances = cachedInstances;

  // 1. Reset all listener arrays
  timeSecondsListeners = [];
  bOvertimeListeners = [];
  ballSpeedListeners = [];
  ballTeamListeners = [];
  scoreDiffListeners = [];
  matchScoreListeners = [];
  myScoreListeners = [];
  oppScoreListeners = [];
  teamColorsListeners = [];

  p1SpeedListeners = [];
  p1BoostListeners = [];
  p1NameListeners = [];
  p1HasCarListeners = [];
  p1BoostingListeners = [];
  p1OnGroundListeners = [];
  p1OnWallListeners = [];
  p1PowerslidingListeners = [];
  p1DemolishedListeners = [];
  p1SupersonicListeners = [];

  p2SpeedListeners = [];
  p2BoostListeners = [];
  p2NameListeners = [];
  p2HasCarListeners = [];
  p2BoostingListeners = [];
  p2OnGroundListeners = [];
  p2OnWallListeners = [];
  p2PowerslidingListeners = [];
  p2DemolishedListeners = [];
  p2SupersonicListeners = [];

  p3SpeedListeners = [];
  p3BoostListeners = [];
  p3NameListeners = [];
  p3HasCarListeners = [];
  p3BoostingListeners = [];
  p3OnGroundListeners = [];
  p3OnWallListeners = [];
  p3PowerslidingListeners = [];
  p3DemolishedListeners = [];
  p3SupersonicListeners = [];

  const len = cachedInstances.length;

  for (let i = 0; i < len; i++) {
    const cached = cachedInstances[i];
    const inst = cached.inst;
    const p: TargetPlayer = inst.targetPlayer || 'p1';
    const type = inst.componentType;

    // ------------------------------------------------------------------------
    // Component Handlers
    // ------------------------------------------------------------------------
    switch (type) {
      // 1. Boost Text (Digit Slot Transform Reel - 0 DOM Layout)
      case 'element-boost-text':
      case 'element-boost-text-fixed': {
        const valEl = cached.valEl;
        if (valEl) {
          const colorHigh = inst.customProps?.colorHigh || '#10b981';
          const colorMid = inst.customProps?.colorMid || '#f59e0b';
          const colorLow = inst.customProps?.colorLow || '#ef4444';
          const canBlink = inst.customProps?.enableBlink !== false && type !== 'element-boost-text-fixed';
          const tierState = cached.boostTierState;
          const reel = cached.digitReel;

          addBoostListener(p, (boost: number) => {
            if (reel && reel.slots.length >= 3) {
              const b = Math.max(0, Math.min(100, Math.round(boost)));
              const d100 = Math.floor(b / 100);
              const d10 = Math.floor((b % 100) / 10);
              const d1 = b % 10;
              updateReelSlot(reel.slots[0], d100, b >= 100 ? '1' : '0');
              updateReelSlot(reel.slots[1], d10, b >= 10 ? '1' : '0');
              updateReelSlot(reel.slots[2], d1, '1');
            } else {
              const str = boost.toString();
              if (str !== cached.lastTextContent) {
                valEl.textContent = str;
                cached.lastTextContent = str;
              }
            }

            let color = colorHigh;
            let blink = false;
            if (boost <= 12) {
              color = colorLow;
              blink = canBlink;
            } else if (boost < 20) {
              color = colorLow;
            } else if (boost < 60) {
              color = colorMid;
            }

            if (blink !== tierState.lastBlink) {
              valEl.classList.toggle('danger-blink', blink);
              tierState.lastBlink = blink;
            }
            if (type !== 'element-boost-text-fixed' && color !== cached.lastColor) {
              valEl.style.color = color;
              cached.lastColor = color;
            }
          });
        }
        break;
      }

      // 2. Speed Text (Digit Slot Transform Reel - 0 DOM Layout)
      case 'element-speed-text': {
        const valEl = cached.valEl;
        if (valEl) {
          const unit = inst.speedUnit;
          const reel = cached.digitReel;
          addSpeedListener(p, (speed: number) => {
            if (reel && reel.slots.length >= 4) {
              const spdNum = unit === 'uu/s' ? toRealUuSpeed(speed) : (speed > 150 ? speed * 0.036 : speed);
              const s = Math.max(0, Math.min(9999, Math.round(spdNum)));
              const d1000 = Math.floor(s / 1000);
              const d100 = Math.floor((s % 1000) / 100);
              const d10 = Math.floor((s % 100) / 10);
              const d1 = s % 10;
              updateReelSlot(reel.slots[0], d1000, s >= 1000 ? '1' : '0');
              updateReelSlot(reel.slots[1], d100, s >= 100 ? '1' : '0');
              updateReelSlot(reel.slots[2], d10, s >= 10 ? '1' : '0');
              updateReelSlot(reel.slots[3], d1, '1');
            } else {
              const str = fmtSpeed(speed, unit);
              if (str !== cached.lastTextContent) {
                valEl.textContent = str;
                cached.lastTextContent = str;
              }
            }
          });
        }
        break;
      }

      case 'player-speed':
      case 'widget-player-speed': {
        const valEl = cached.valEl;
        if (valEl) {
          const unit = inst.speedUnit;
          addSpeedListener(p, (speed: number) => {
            const str = fmtSpeed(speed, unit);
            if (str !== cached.lastTextContent) {
              valEl.textContent = str;
              cached.lastTextContent = str;
            }
          });
        }
        break;
      }

      // 3. Player Name Text
      case 'element-player-name-text':
      case 'player-name':
      case 'widget-player-name': {
        const valEl = cached.valEl;
        if (valEl) {
          addNameListener(p, (name: string) => {
            if (name !== cached.lastTextContent) {
              valEl.textContent = name;
              cached.lastTextContent = name;
            }
          });
        }
        break;
      }

      // 4. Time Text & System Time (Digit Slot Transform Reel - 0 DOM Layout)
      case 'element-time-text': {
        const valEl = cached.valEl;
        if (valEl) {
          const reel = cached.digitReel;
          timeSecondsListeners.push((sec: number) => {
            if (reel && reel.slots.length >= 4) {
              const absSec = Math.max(0, Math.min(3599, Math.abs(Math.trunc(sec))));
              const m = Math.floor(absSec / 60);
              const s = absSec % 60;
              const m1 = Math.floor(m / 10);
              const m2 = m % 10;
              const s1 = Math.floor(s / 10);
              const s2 = s % 10;
              updateReelSlot(reel.slots[0], m1, m >= 10 ? '1' : '0');
              updateReelSlot(reel.slots[1], m2, '1');
              updateReelSlot(reel.slots[2], s1, '1');
              updateReelSlot(reel.slots[3], s2, '1');
            } else {
              const str = fmtMinSec(sec);
              if (str !== cached.lastTextContent) {
                valEl.textContent = str;
                cached.lastTextContent = str;
              }
            }
          });
        }
        break;
      }

      case 'time-remaining':
      case 'widget-time-remaining': {
        const valEl = cached.valEl;
        if (valEl) {
          timeSecondsListeners.push((sec: number) => {
            const str = fmtMinSec(sec);
            if (str !== cached.lastTextContent) {
              valEl.textContent = str;
              cached.lastTextContent = str;
            }
          });
        }
        break;
      }

      case 'element-system-time': {
        const valEl = cached.valEl;
        if (valEl) {
          const reel = cached.digitReel;
          timeSecondsListeners.push(() => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            const s = now.getSeconds();
            if (reel && reel.slots.length >= 6) {
              const h1 = Math.floor(h / 10);
              const h2 = h % 10;
              const m1 = Math.floor(m / 10);
              const m2 = m % 10;
              const s1 = Math.floor(s / 10);
              const s2 = s % 10;
              updateReelSlot(reel.slots[0], h1, '1');
              updateReelSlot(reel.slots[1], h2, '1');
              updateReelSlot(reel.slots[2], m1, '1');
              updateReelSlot(reel.slots[3], m2, '1');
              updateReelSlot(reel.slots[4], s1, '1');
              updateReelSlot(reel.slots[5], s2, '1');
            } else {
              const hs = h.toString().padStart(2, '0');
              const ms = m.toString().padStart(2, '0');
              const ss = s.toString().padStart(2, '0');
              const str = `${hs}:${ms}:${ss}`;
              if (str !== cached.lastTextContent) {
                valEl.textContent = str;
                cached.lastTextContent = str;
              }
            }
          });
        }
        break;
      }

      // 5. Ball Speed Text (Digit Slot Transform Reel - 0 DOM Layout)
      case 'element-ball-speed-text': {
        const valEl = cached.valEl;
        if (valEl) {
          const unit = inst.speedUnit;
          const reel = cached.digitReel;
          ballSpeedListeners.push((ballSpeed: number) => {
            if (reel && reel.slots.length >= 4) {
              const spdNum = unit === 'uu/s' ? toRealUuSpeed(ballSpeed) : (ballSpeed > 150 ? ballSpeed * 0.036 : ballSpeed);
              const s = Math.max(0, Math.min(9999, Math.round(spdNum)));
              const d1000 = Math.floor(s / 1000);
              const d100 = Math.floor((s % 1000) / 100);
              const d10 = Math.floor((s % 100) / 10);
              const d1 = s % 10;
              updateReelSlot(reel.slots[0], d1000, s >= 1000 ? '1' : '0');
              updateReelSlot(reel.slots[1], d100, s >= 100 ? '1' : '0');
              updateReelSlot(reel.slots[2], d10, s >= 10 ? '1' : '0');
              updateReelSlot(reel.slots[3], d1, '1');
            } else {
              const str = fmtSpeed(ballSpeed, unit);
              if (str !== cached.lastTextContent) {
                valEl.textContent = str;
                cached.lastTextContent = str;
              }
            }
          });
        }
        break;
      }

      case 'ball-speed':
      case 'widget-ball-speed': {
        const valEl = cached.valEl;
        if (valEl) {
          const unit = inst.speedUnit;
          ballSpeedListeners.push((ballSpeed: number) => {
            const str = fmtSpeed(ballSpeed, unit);
            if (str !== cached.lastTextContent) {
              valEl.textContent = str;
              cached.lastTextContent = str;
            }
          });
        }
        break;
      }

      // 6. Ball Team Text
      case 'element-ball-team-text':
      case 'ball-team':
      case 'widget-ball-team': {
        const valEl = cached.valEl;
        if (valEl) {
          const updateBallTeam = (teamNum: number) => {
            const isBlue = teamNum === 0;
            const str = isBlue ? 'BLUE' : 'ORANGE';
            if (str !== cached.lastTextContent) {
              valEl.textContent = str;
              cached.lastTextContent = str;
            }
            const col = isBlue
              ? (latestData.myPrimaryColor || DEFAULT_TEAM_COLORS.myPrimaryColor)
              : (latestData.oppPrimaryColor || DEFAULT_TEAM_COLORS.oppPrimaryColor);
            if (col !== cached.lastColor) {
              valEl.style.color = col;
              cached.lastColor = col;
            }
          };
          ballTeamListeners.push(updateBallTeam);
          teamColorsListeners.push(() => updateBallTeam(latestData.ballTeamNum));
        }
        break;
      }

      // 7. Score Diff Text
      case 'element-score-diff-text': {
        const valEl = cached.valEl;
        if (valEl) {
          scoreDiffListeners.push((diff: number) => {
            if (diff !== cached.lastScoreDiff) {
              valEl.textContent = fmtScoreDiff(diff);
              valEl.classList.toggle('score-pos', diff > 0);
              valEl.classList.toggle('score-neg', diff < 0);
              valEl.classList.toggle('score-tie', diff === 0);
              cached.lastScoreDiff = diff;
            }
          });
        }
        break;
      }

      // 8. Match Score Text
      case 'element-match-score-text': {
        const valEl = cached.valEl;
        if (valEl) {
          matchScoreListeners.push(() => {
            const str = `${latestData.myScore} - ${latestData.oppScore}`;
            if (str !== cached.lastScoreText) {
              valEl.textContent = str;
              cached.lastScoreText = str;
            }
          });
        }
        break;
      }

      // 9. My / Opp Score Text
      case 'element-my-score-text': {
        const valEl = cached.valEl;
        if (valEl) {
          myScoreListeners.push((s: number) => {
            const str = s.toString();
            if (str !== cached.lastTextContent) {
              valEl.textContent = str;
              cached.lastTextContent = str;
            }
          });
        }
        break;
      }

      case 'element-opp-score-text': {
        const valEl = cached.valEl;
        if (valEl) {
          oppScoreListeners.push((s: number) => {
            const str = s.toString();
            if (str !== cached.lastTextContent) {
              valEl.textContent = str;
              cached.lastTextContent = str;
            }
          });
        }
        break;
      }

      // 10. Team Color Box
      case 'element-team-color-box': {
        const boxEl = cached.boxEl;
        if (boxEl) {
          const mode = inst.customProps?.boxColorMode || 'my-primary';
          const customBg = inst.customProps?.bgColor;
          const updateBox = () => {
            const color = resolveColor(mode, customBg, DEFAULT_TEAM_COLORS.myPrimaryColor, latestData);
            if (color !== cached.lastColor) {
              boxEl.style.backgroundColor = color;
              cached.lastColor = color;
            }
          };
          teamColorsListeners.push(updateBox);
        }
        break;
      }

      // 11. Horizontal Boost Bars
      case 'element-boost-bar':
      case 'element-boost-bar-no-blink':
      case 'boost-bar':
      case 'player-boost-bar':
      case 'widget-boost-bar': {
        const fillEl = cached.fillEl;
        if (fillEl) {
          const colorHigh = inst.customProps?.colorHigh || '#10b981';
          const colorMid = inst.customProps?.colorMid || '#f59e0b';
          const colorLow = inst.customProps?.colorLow || '#ef4444';
          const canBlink = inst.customProps?.enableBlink !== false && type !== 'element-boost-bar-no-blink';
          const tierState = cached.boostTierState;

          addBoostListener(p, (boost: number) => {
            const scale = boost / 100;
            const transformStr = `scaleX(${scale})`;
            if (transformStr !== tierState.lastTransform) {
              fillEl.style.transform = transformStr;
              tierState.lastTransform = transformStr;
            }

            let currentTier = 3;
            let blink = false;
            let color = colorHigh;
            if (boost <= 12) {
              currentTier = 0;
              color = colorLow;
              blink = canBlink;
            } else if (boost < 20) {
              currentTier = 1;
              color = colorLow;
            } else if (boost < 60) {
              currentTier = 2;
              color = colorMid;
            }

            if (currentTier !== tierState.tier || blink !== tierState.lastBlink || color !== cached.lastColor) {
              tierState.tier = currentTier;
              tierState.lastBlink = blink;
              cached.lastColor = color;
              fillEl.style.backgroundColor = color;
              fillEl.classList.toggle('danger-blink', blink);
            }
          });
        }
        break;
      }

      // 12. Vertical Boost Bar
      case 'element-vertical-boost-bar': {
        const fillEl = cached.fillEl;
        if (fillEl) {
          const colorHigh = inst.customProps?.colorHigh || '#10b981';
          const colorMid = inst.customProps?.colorMid || '#f59e0b';
          const colorLow = inst.customProps?.colorLow || '#ef4444';
          const canBlink = inst.customProps?.enableBlink !== false;
          const tierState = cached.boostTierState;

          addBoostListener(p, (boost: number) => {
            const scale = boost / 100;
            const transformStr = `scaleY(${scale})`;
            if (transformStr !== tierState.lastTransform) {
              fillEl.style.transform = transformStr;
              tierState.lastTransform = transformStr;
            }

            let currentTier = 3;
            let blink = false;
            let color = colorHigh;
            if (boost <= 12) {
              currentTier = 0;
              color = colorLow;
              blink = canBlink;
            } else if (boost < 20) {
              currentTier = 1;
              color = colorLow;
            } else if (boost < 60) {
              currentTier = 2;
              color = colorMid;
            }

            if (currentTier !== tierState.tier || blink !== tierState.lastBlink || color !== cached.lastColor) {
              tierState.tier = currentTier;
              tierState.lastBlink = blink;
              cached.lastColor = color;
              fillEl.style.backgroundColor = color;
              fillEl.classList.toggle('danger-blink', blink);
            }
          });
        }
        break;
      }

      // 13. Boost Alert Bar
      case 'element-boost-alert-bar': {
        const boxEl = cached.boxEl;
        if (boxEl) {
          const threshold = Number(inst.customProps?.threshold ?? 12);
          const alertColor = inst.customProps?.alertColor || '#ef4444';
          const enableBlink = inst.customProps?.enableBlink !== false;

          addBoostListener(p, (boost: number) => {
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
          });
        }
        break;
      }

      // 14. Horizontal Speed Bar
      case 'element-speed-bar': {
        const fillEl = cached.fillEl;
        if (fillEl) {
          const split1410Pos = Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40);
          const colorLow = inst.customProps?.colorLow || '#d4af37';
          const colorMidStart = inst.customProps?.colorMidStart || '#77ca7a';
          const colorMidEnd = inst.customProps?.colorMidEnd || '#59f168';
          const tierState = cached.boostTierState;

          addSpeedListener(p, (speed: number) => {
            const uuSpeed = toRealUuSpeed(speed);
            const pct = calcNonlinearSpeedProgress(uuSpeed, split1410Pos);
            const transformStr = `scaleX(${pct / 100})`;
            if (transformStr !== tierState.lastTransform) {
              fillEl.style.transform = transformStr;
              tierState.lastTransform = transformStr;
            }

            const { color, isSupersonic } = calcSpeedColor(uuSpeed, colorLow, colorMidStart, colorMidEnd);
            if (isSupersonic !== cached.lastGlow || color !== cached.lastColor) {
              cached.lastGlow = isSupersonic;
              cached.lastColor = color;
              fillEl.style.backgroundColor = color;
              fillEl.classList.toggle('supersonic-glow', isSupersonic);
            }
          });
        }
        break;
      }

      // 15. Vertical Speed Bar
      case 'element-vertical-speed-bar': {
        const fillEl = cached.fillEl;
        if (fillEl) {
          const split1410Pos = Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40);
          const colorLow = inst.customProps?.colorLow || '#d4af37';
          const colorMidStart = inst.customProps?.colorMidStart || '#77ca7a';
          const colorMidEnd = inst.customProps?.colorMidEnd || '#59f168';
          const tierState = cached.boostTierState;

          addSpeedListener(p, (speed: number) => {
            const uuSpeed = toRealUuSpeed(speed);
            const pct = calcNonlinearSpeedProgress(uuSpeed, split1410Pos);
            const transformStr = `scaleY(${pct / 100})`;
            if (transformStr !== tierState.lastTransform) {
              fillEl.style.transform = transformStr;
              tierState.lastTransform = transformStr;
            }

            const { color, isSupersonic } = calcSpeedColor(uuSpeed, colorLow, colorMidStart, colorMidEnd);
            if (isSupersonic !== cached.lastGlow || color !== cached.lastColor) {
              cached.lastGlow = isSupersonic;
              cached.lastColor = color;
              fillEl.style.backgroundColor = color;
              fillEl.classList.toggle('supersonic-glow', isSupersonic);
            }
          });
        }
        break;
      }

      // 16. Curved Boost Bar (SVG Arc)
      case 'element-curved-boost-bar': {
        const fill = cached.fillEl as SVGCircleElement | null;
        if (fill) {
          const thick = Number(inst.customProps?.thickness ?? 8);
          const gap = Number(inst.customProps?.gap ?? 90);
          const orient = Number(inst.customProps?.orientation ?? 90);
          const radius = 50 - (thick / 2);
          const perimeter = 2 * Math.PI * radius;
          const activeAngle = 360 - gap;
          const totalDash = perimeter * (activeAngle / 360);
          const colorHigh = inst.customProps?.colorHigh || '#10b981';
          const colorMid = inst.customProps?.colorMid || '#f59e0b';
          const colorLow = inst.customProps?.colorLow || '#ef4444';
          const enableBlink = inst.customProps?.enableBlink !== false;

          addBoostListener(p, (boost: number) => {
            const progressDash = totalDash * Math.max(0, Math.min(1, boost / 100));
            const dashStr = `${progressDash} ${perimeter}`;

            if (dashStr !== cached.lastCurvedDash) {
              fill.setAttribute('r', radius.toString());
              fill.setAttribute('stroke-width', thick.toString());
              fill.setAttribute('stroke-dasharray', dashStr);
              fill.style.transform = `rotate(${orient + (gap / 2)}deg)`;
              fill.style.transformOrigin = '50px 50px';
              cached.lastCurvedDash = dashStr;

              let color = colorHigh;
              let blink = false;
              if (boost <= 12) {
                color = colorLow;
                blink = enableBlink;
              } else if (boost < 20) {
                color = colorLow;
              } else if (boost < 60) {
                color = colorMid;
              }

              fill.setAttribute('stroke', color);
              fill.classList.toggle('danger-blink', blink);
            }
          });
        }
        break;
      }

      // 17. Curved Speedometer (SVG Arc)
      case 'element-curved-speedometer': {
        const fill = cached.fillEl as SVGCircleElement | null;
        if (fill) {
          const thick = Number(inst.customProps?.thickness ?? 8);
          const gap = Number(inst.customProps?.gap ?? 90);
          const orient = Number(inst.customProps?.orientation ?? 90);
          const radius = 50 - (thick / 2);
          const perimeter = 2 * Math.PI * radius;
          const activeAngle = 360 - gap;
          const totalDash = perimeter * (activeAngle / 360);
          const split1410Pos = Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40);
          const colorLow = inst.customProps?.colorLow || '#d4af37';
          const colorMidStart = inst.customProps?.colorMidStart || '#77ca7a';
          const colorMidEnd = inst.customProps?.colorMidEnd || '#59f168';

          addSpeedListener(p, (speed: number) => {
            const uuSpeed = toRealUuSpeed(speed);
            const pct = calcNonlinearSpeedProgress(uuSpeed, split1410Pos);
            const progressDash = totalDash * (pct / 100);
            const dashStr = `${progressDash} ${perimeter}`;

            const { color, isSupersonic } = calcSpeedColor(uuSpeed, colorLow, colorMidStart, colorMidEnd);

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
          });
        }
        break;
      }

      // 18. Boolean Indicators
      case 'element-demolished-indicator':
      case 'element-hascar-indicator':
      case 'element-boosting-indicator':
      case 'element-onground-indicator':
      case 'element-onwall-indicator':
      case 'element-powersliding-indicator':
      case 'element-supersonic-indicator':
      case 'element-overtime-indicator': {
        const dotEl = cached.dotEl;
        if (dotEl) {
          let defaultActiveColor = '#30d158';
          if (type === 'element-demolished-indicator') defaultActiveColor = '#ff453a';
          else if (type === 'element-hascar-indicator') defaultActiveColor = '#30d158';
          else if (type === 'element-boosting-indicator') defaultActiveColor = '#ff9500';
          else if (type === 'element-onground-indicator') defaultActiveColor = '#0a84ff';
          else if (type === 'element-onwall-indicator') defaultActiveColor = '#bf5af2';
          else if (type === 'element-powersliding-indicator') defaultActiveColor = '#ffd60a';
          else if (type === 'element-supersonic-indicator') defaultActiveColor = '#bf5af2';
          else if (type === 'element-overtime-indicator') defaultActiveColor = '#ff453a';

          const invertBool = inst.customProps?.invertBool;
          const activeColorMode = inst.customProps?.activeColorMode;
          const customActiveColor = inst.customProps?.activeColor;
          const inactiveColor = inst.customProps?.inactiveColor || 'rgba(51, 65, 85, 0.5)';

          const onBoolChange = (rawVal: boolean) => {
            const isFiltered = invertBool ? !rawVal : Boolean(rawVal);
            if (isFiltered !== cached.lastBoolState) {
              cached.lastBoolState = isFiltered;

              dotEl.className = `el-pure-dot dyn-dot ${isFiltered ? 'bool-on' : 'bool-off'}`;

              const activeColor = resolveColor(activeColorMode, customActiveColor, defaultActiveColor, latestData);
              const color = isFiltered ? activeColor : inactiveColor;
              dotEl.style.backgroundColor = color;
              if (isFiltered && color !== 'transparent' && !color.startsWith('rgba(0, 0, 0, 0)')) {
                dotEl.style.boxShadow = `0 0 10px ${color}`;
              } else {
                dotEl.style.boxShadow = 'none';
              }
            }
          };

          if (type === 'element-overtime-indicator') bOvertimeListeners.push(onBoolChange);
          else if (type === 'element-demolished-indicator') addDemolishedListener(p, onBoolChange);
          else if (type === 'element-hascar-indicator') addHasCarListener(p, onBoolChange);
          else if (type === 'element-boosting-indicator') addBoostingListener(p, onBoolChange);
          else if (type === 'element-onground-indicator') addOnGroundListener(p, onBoolChange);
          else if (type === 'element-onwall-indicator') addOnWallListener(p, onBoolChange);
          else if (type === 'element-powersliding-indicator') addPowerslidingListener(p, onBoolChange);
          else if (type === 'element-supersonic-indicator') addSupersonicListener(p, onBoolChange);
        }
        break;
      }

      // 19. Custom Text (Boolean Dynamic Opacity)
      case 'element-custom-text':
      case 'custom-text': {
        const valEl = cached.valEl;
        if (valEl) {
          const text = inst.customProps?.customText || 'SUPERSONIC';
          if (text !== cached.lastTextContent) {
            valEl.textContent = text;
            cached.lastTextContent = text;
          }
          const boolVar = inst.customProps?.boolVar || 'supersonic';
          const invertBool = inst.customProps?.invertBool;
          const effectiveOpacity = inst.followGlobal !== false ? (settings.opacity ?? 1.0) : (inst.opacity ?? 1.0);
          const enOp = inst.customProps?.enabledOpacity ?? 1.0;
          const disOp = inst.customProps?.disabledOpacity ?? 0.2;

          const onBoolChange = (stateVal: boolean) => {
            const isFiltered = invertBool ? !stateVal : Boolean(stateVal);
            if (isFiltered !== cached.lastBoolState) {
              cached.lastBoolState = isFiltered;
              cached.container.style.opacity = (effectiveOpacity * (isFiltered ? enOp : disOp)).toString();
            }
          };

          if (boolVar === 'supersonic') addSupersonicListener(p, onBoolChange);
          else if (boolVar === 'boosting') addBoostingListener(p, onBoolChange);
          else if (boolVar === 'hascar') addHasCarListener(p, onBoolChange);
          else if (boolVar === 'onground') addOnGroundListener(p, onBoolChange);
          else if (boolVar === 'onwall') addOnWallListener(p, onBoolChange);
          else if (boolVar === 'powersliding') addPowerslidingListener(p, onBoolChange);
          else if (boolVar === 'demolished') addDemolishedListener(p, onBoolChange);
          else if (boolVar === 'overtime') bOvertimeListeners.push(onBoolChange);
        }
        break;
      }

      // 20. Global Text Indicator / Overtime Status
      case 'element-global-text-indicator': {
        const valEl = cached.valEl;
        if (valEl) {
          bOvertimeListeners.push((ot: boolean) => {
            if (ot !== cached.lastBoolState) {
              cached.lastBoolState = ot;
              valEl.textContent = ot ? 'OVERTIME' : 'REGULAR TIME';
              valEl.style.color = ot ? '#ff3b30' : '#30d158';
            }
          });
        }
        break;
      }

      case 'overtime-status':
      case 'widget-overtime-status': {
        const dotEl = cached.dotEl;
        if (dotEl) {
          bOvertimeListeners.push((ot: boolean) => {
            if (ot !== cached.lastBoolState) {
              cached.lastBoolState = ot;
              dotEl.className = `status-dot dyn-dot ${ot ? 'bool-on ot-active' : 'bool-off'}`;
            }
          });
        }
        break;
      }

      // 21. Player Status Indicator
      case 'player-status':
      case 'widget-player-status': {
        const dotEl = cached.dotEl;
        if (dotEl) {
          addSupersonicListener(p, (supersonic: boolean) => {
            if (supersonic !== cached.lastBoolState) {
              cached.lastBoolState = supersonic;
              dotEl.className = `status-dot dyn-dot ${supersonic ? 'bool-on active' : 'bool-off'}`;
            }
          });
        }
        break;
      }

      // 22. Score Diff Widget
      case 'score-diff':
      case 'widget-score-diff': {
        if (cached.valEl) {
          const valEl = cached.valEl;
          scoreDiffListeners.push((diff: number) => {
            if (diff !== cached.lastScoreDiff) {
              valEl.textContent = fmtScoreDiff(diff);
              valEl.classList.toggle('score-pos', diff > 0);
              valEl.classList.toggle('score-neg', diff < 0);
              valEl.classList.toggle('score-tie', diff === 0);
              cached.lastScoreDiff = diff;
            }
          });
        }
        if (cached.subValEl) {
          const subValEl = cached.subValEl;
          matchScoreListeners.push(() => {
            const s = `${latestData.myScore}-${latestData.oppScore}`;
            if (s !== cached.lastScoreText) {
              subValEl.textContent = s;
              cached.lastScoreText = s;
            }
          });
        }
        break;
      }

      // 23. Team Colors Widget
      case 'team-colors':
      case 'widget-team-colors': {
        teamColorsListeners.push(() => {
          const myC = latestData.myPrimaryColor || DEFAULT_TEAM_COLORS.myPrimaryColor;
          const oppC = latestData.oppPrimaryColor || DEFAULT_TEAM_COLORS.oppPrimaryColor;
          if (cached.myPrimary && myC !== cached.lastColor) {
            cached.myPrimary.style.backgroundColor = myC;
            cached.lastColor = myC;
          }
          if (cached.oppPrimary) {
            cached.oppPrimary.style.backgroundColor = oppC;
          }
        });
        break;
      }

      // 24. Boost Combo Widget
      case 'boost-combo':
      case 'widget-boost-combo': {
        const tierState = cached.boostTierState;
        const canBlink = inst.customProps?.enableBlink !== false;
        addBoostListener(p, (boost: number) => {
          if (cached.valEl && boost !== tierState.lastVal) {
            cached.valEl.textContent = boost.toString();
          }
          if (cached.fillEl) {
            const scale = boost / 100;
            const transformStr = `scaleX(${scale})`;
            if (transformStr !== tierState.lastTransform) {
              cached.fillEl.style.transform = transformStr;
              tierState.lastTransform = transformStr;
              const color = boost < 30 ? '#ef4444' : boost < 60 ? '#f59e0b' : '#10b981';
              cached.fillEl.style.backgroundColor = color;
              cached.fillEl.classList.toggle('danger-blink', canBlink && boost < 12);
            }
          }
          tierState.lastVal = boost;
        });
        break;
      }

      // 25. Boost Val Widget
      case 'boost-val':
      case 'player-boost-val':
      case 'widget-boost-val': {
        const valEl = cached.valEl;
        if (valEl) {
          const tierState = cached.boostTierState;
          addBoostListener(p, (boost: number) => {
            if (boost !== tierState.lastVal) {
              valEl.textContent = boost.toString();
              tierState.lastVal = boost;
            }
          });
        }
        break;
      }

      // 26. Panel: Match Header
      case 'panel-match-header': {
        if (cached.diffVal) {
          const diffVal = cached.diffVal;
          scoreDiffListeners.push((diff: number) => {
            if (diff !== cached.lastScoreDiff) {
              diffVal.textContent = fmtScoreDiff(diff);
              diffVal.classList.toggle('score-pos', diff > 0);
              diffVal.classList.toggle('score-neg', diff < 0);
              diffVal.classList.toggle('score-tie', diff === 0);
              cached.lastScoreDiff = diff;
            }
          });
        }
        if (cached.scoreText) {
          const scoreText = cached.scoreText;
          matchScoreListeners.push(() => {
            const s = `${latestData.myScore} - ${latestData.oppScore}`;
            if (s !== cached.lastScoreText) {
              scoreText.textContent = s;
              cached.lastScoreText = s;
            }
          });
        }
        if (cached.timeVal) {
          const timeVal = cached.timeVal;
          timeSecondsListeners.push((sec: number) => {
            if (sec !== cached.lastTimeSeconds) {
              timeVal.textContent = fmtMinSec(sec);
              cached.lastTimeSeconds = sec;
            }
          });
        }
        if (cached.otVal) {
          const otVal = cached.otVal;
          bOvertimeListeners.push((ot: boolean) => {
            if (ot !== cached.lastBoolState) {
              cached.lastBoolState = ot;
              otVal.textContent = ot ? 'OVERTIME' : 'REGULAR';
              otVal.style.color = ot ? '#f59e0b' : '#64748b';
            }
          });
        }
        if (cached.ballVal) {
          const ballVal = cached.ballVal;
          const unit = inst.speedUnit;
          ballSpeedListeners.push((bSpd: number) => {
            const spd = `${fmtSpeed(bSpd, unit)} ${unit === 'uu/s' ? 'uu/s' : 'km/h'}`;
            if (spd !== cached.lastSpeedDisplay) {
              ballVal.textContent = spd;
              cached.lastSpeedDisplay = spd;
            }
          });
        }
        break;
      }

      // 27. Panel: Player Telemetry
      case 'panel-player-telemetry': {
        if (cached.p1Name) {
          const p1Name = cached.p1Name;
          addNameListener(p, (name: string) => {
            if (name !== cached.lastTextContent) {
              p1Name.textContent = name;
              cached.lastTextContent = name;
            }
          });
        }
        if (cached.valEl) {
          const valEl = cached.valEl;
          const unit = inst.speedUnit;
          addSpeedListener(p, (spd: number) => {
            const s = fmtSpeed(spd, unit);
            if (s !== cached.lastSpeedDisplay) {
              valEl.textContent = s;
              cached.lastSpeedDisplay = s;
            }
          });
        }
        if (cached.p1Val || cached.p1Fill) {
          const p1Val = cached.p1Val;
          const p1Fill = cached.p1Fill;
          const tierState = cached.boostTierState;
          addBoostListener(p, (boost: number) => {
            if (p1Val && boost !== tierState.lastVal) {
              p1Val.textContent = boost.toString();
            }
            if (p1Fill) {
              const transformStr = `scaleX(${boost / 100})`;
              if (transformStr !== tierState.lastTransform) {
                p1Fill.style.transform = transformStr;
                tierState.lastTransform = transformStr;
                p1Fill.style.backgroundColor = boost < 20 ? '#ef4444' : boost < 60 ? '#f59e0b' : '#10b981';
              }
            }
            tierState.lastVal = boost;
          });
        }
        if (cached.dotCar) {
          const dot = cached.dotCar;
          addHasCarListener(p, (hasCar) => { dot.className = `status-dot dyn-hascar ${hasCar ? 'bool-on' : 'bool-off'}`; });
        }
        if (cached.dotBoost) {
          const dot = cached.dotBoost;
          addBoostingListener(p, (isBoosting) => { dot.className = `status-dot dyn-boosting ${isBoosting ? 'bool-on' : 'bool-off'}`; });
        }
        if (cached.dotGround) {
          const dot = cached.dotGround;
          addOnGroundListener(p, (onGround) => { dot.className = `status-dot dyn-onground ${onGround ? 'bool-on' : 'bool-off'}`; });
        }
        if (cached.dotWall) {
          const dot = cached.dotWall;
          addOnWallListener(p, (onWall) => { dot.className = `status-dot dyn-onwall ${onWall ? 'bool-on' : 'bool-off'}`; });
        }
        if (cached.dotSlide) {
          const dot = cached.dotSlide;
          addPowerslidingListener(p, (powersliding) => { dot.className = `status-dot dyn-slide ${powersliding ? 'bool-on' : 'bool-off'}`; });
        }
        if (cached.dotDemo) {
          const dot = cached.dotDemo;
          addDemolishedListener(p, (demolished) => { dot.className = `status-dot dyn-demo ${demolished ? 'bool-on' : 'bool-off'}`; });
        }
        if (cached.dotSuper) {
          const dot = cached.dotSuper;
          addSupersonicListener(p, (supersonic) => { dot.className = `status-dot dyn-super ${supersonic ? 'bool-on' : 'bool-off'}`; });
        }
        break;
      }

      // 28. Panel: Team Roster
      case 'panel-team-roster': {
        if (cached.p1Name) {
          const el = cached.p1Name;
          p1NameListeners.push((name) => { el.textContent = name; });
        }
        if (cached.p1Val || cached.p1Fill) {
          const p1Val = cached.p1Val;
          const p1Fill = cached.p1Fill;
          const tierState = cached.boostTierState;
          p1BoostListeners.push((boost) => {
            if (p1Val && boost !== tierState.lastVal) p1Val.textContent = boost.toString();
            if (p1Fill) {
              const t = `scaleX(${boost / 100})`;
              if (t !== tierState.lastTransform) {
                p1Fill.style.transform = t;
                tierState.lastTransform = t;
                p1Fill.style.backgroundColor = boost < 20 ? '#ef4444' : boost < 60 ? '#f59e0b' : '#10b981';
              }
            }
            tierState.lastVal = boost;
          });
        }
        if (cached.p2Name) {
          const el = cached.p2Name;
          p2NameListeners.push((name) => { el.textContent = name; });
        }
        if (cached.p2Val || cached.p2Fill) {
          const p2Val = cached.p2Val;
          const p2Fill = cached.p2Fill;
          p2BoostListeners.push((boost) => {
            if (p2Val) p2Val.textContent = boost.toString();
            if (p2Fill) {
              p2Fill.style.transform = `scaleX(${boost / 100})`;
              p2Fill.style.backgroundColor = boost < 20 ? '#ef4444' : boost < 60 ? '#f59e0b' : '#10b981';
            }
          });
        }
        if (cached.p3Name) {
          const el = cached.p3Name;
          p3NameListeners.push((name) => { el.textContent = name; });
        }
        if (cached.p3Val || cached.p3Fill) {
          const p3Val = cached.p3Val;
          const p3Fill = cached.p3Fill;
          p3BoostListeners.push((boost) => {
            if (p3Val) p3Val.textContent = boost.toString();
            if (p3Fill) {
              p3Fill.style.transform = `scaleX(${boost / 100})`;
              p3Fill.style.backgroundColor = boost < 20 ? '#ef4444' : boost < 60 ? '#f59e0b' : '#10b981';
            }
          });
        }
        break;
      }
    }
  }

  // Initial low-frequency evaluation for non-existing player components
  applyAutoHideNonExistingPlayers(undefined, undefined, cachedInstances);
}

/**
 * ============================================================================
 * ⚡ Selective Property Dispatcher for Competitive Scene
 * ============================================================================
 * Strict RAF rule:
 * if (previousData.prop !== latestData.prop) {
 *   listeners.forEach(fn => fn(latestData.prop));
 *   previousData.prop = latestData.prop;
 * }
 */
export function renderCompetitiveSceneSelective(
  latestData: TelemetryBuffer,
  previousData: TelemetryBuffer
): void {
  // 1. P1 Telemetry
  if (previousData.p1HasCar !== latestData.p1HasCar) {
    const v = latestData.p1HasCar;
    for (let i = 0; i < p1HasCarListeners.length; i++) p1HasCarListeners[i](v);
    previousData.p1HasCar = v;
  }
  if (previousData.p1Name !== latestData.p1Name) {
    const v = latestData.p1Name;
    for (let i = 0; i < p1NameListeners.length; i++) p1NameListeners[i](v);
    previousData.p1Name = v;
  }
  if (latestData.p1HasCar) {
    if (previousData.p1Speed !== latestData.p1Speed) {
      const v = latestData.p1Speed;
      for (let i = 0; i < p1SpeedListeners.length; i++) p1SpeedListeners[i](v);
      previousData.p1Speed = v;
    }
    if (previousData.p1Boost !== latestData.p1Boost) {
      const v = latestData.p1Boost;
      for (let i = 0; i < p1BoostListeners.length; i++) p1BoostListeners[i](v);
      previousData.p1Boost = v;
    }
    if (previousData.p1Boosting !== latestData.p1Boosting) {
      const v = latestData.p1Boosting;
      for (let i = 0; i < p1BoostingListeners.length; i++) p1BoostingListeners[i](v);
      previousData.p1Boosting = v;
    }
    if (previousData.p1OnGround !== latestData.p1OnGround) {
      const v = latestData.p1OnGround;
      for (let i = 0; i < p1OnGroundListeners.length; i++) p1OnGroundListeners[i](v);
      previousData.p1OnGround = v;
    }
    if (previousData.p1OnWall !== latestData.p1OnWall) {
      const v = latestData.p1OnWall;
      for (let i = 0; i < p1OnWallListeners.length; i++) p1OnWallListeners[i](v);
      previousData.p1OnWall = v;
    }
    if (previousData.p1Powersliding !== latestData.p1Powersliding) {
      const v = latestData.p1Powersliding;
      for (let i = 0; i < p1PowerslidingListeners.length; i++) p1PowerslidingListeners[i](v);
      previousData.p1Powersliding = v;
    }
    if (previousData.p1Demolished !== latestData.p1Demolished) {
      const v = latestData.p1Demolished;
      for (let i = 0; i < p1DemolishedListeners.length; i++) p1DemolishedListeners[i](v);
      previousData.p1Demolished = v;
    }
    if (previousData.p1Supersonic !== latestData.p1Supersonic) {
      const v = latestData.p1Supersonic;
      for (let i = 0; i < p1SupersonicListeners.length; i++) p1SupersonicListeners[i](v);
      previousData.p1Supersonic = v;
    }
  }

  // 2. P2 Telemetry (Decoupled & Skipped if !latestData.p2HasCar)
  if (previousData.p2HasCar !== latestData.p2HasCar) {
    const v = latestData.p2HasCar;
    for (let i = 0; i < p2HasCarListeners.length; i++) p2HasCarListeners[i](v);
    previousData.p2HasCar = v;
  }
  if (previousData.p2Name !== latestData.p2Name) {
    const v = latestData.p2Name;
    for (let i = 0; i < p2NameListeners.length; i++) p2NameListeners[i](v);
    previousData.p2Name = v;
  }
  if (latestData.p2HasCar) {
    if (previousData.p2Speed !== latestData.p2Speed) {
      const v = latestData.p2Speed;
      for (let i = 0; i < p2SpeedListeners.length; i++) p2SpeedListeners[i](v);
      previousData.p2Speed = v;
    }
    if (previousData.p2Boost !== latestData.p2Boost) {
      const v = latestData.p2Boost;
      for (let i = 0; i < p2BoostListeners.length; i++) p2BoostListeners[i](v);
      previousData.p2Boost = v;
    }
    if (previousData.p2Boosting !== latestData.p2Boosting) {
      const v = latestData.p2Boosting;
      for (let i = 0; i < p2BoostingListeners.length; i++) p2BoostingListeners[i](v);
      previousData.p2Boosting = v;
    }
    if (previousData.p2OnGround !== latestData.p2OnGround) {
      const v = latestData.p2OnGround;
      for (let i = 0; i < p2OnGroundListeners.length; i++) p2OnGroundListeners[i](v);
      previousData.p2OnGround = v;
    }
    if (previousData.p2OnWall !== latestData.p2OnWall) {
      const v = latestData.p2OnWall;
      for (let i = 0; i < p2OnWallListeners.length; i++) p2OnWallListeners[i](v);
      previousData.p2OnWall = v;
    }
    if (previousData.p2Powersliding !== latestData.p2Powersliding) {
      const v = latestData.p2Powersliding;
      for (let i = 0; i < p2PowerslidingListeners.length; i++) p2PowerslidingListeners[i](v);
      previousData.p2Powersliding = v;
    }
    if (previousData.p2Demolished !== latestData.p2Demolished) {
      const v = latestData.p2Demolished;
      for (let i = 0; i < p2DemolishedListeners.length; i++) p2DemolishedListeners[i](v);
      previousData.p2Demolished = v;
    }
    if (previousData.p2Supersonic !== latestData.p2Supersonic) {
      const v = latestData.p2Supersonic;
      for (let i = 0; i < p2SupersonicListeners.length; i++) p2SupersonicListeners[i](v);
      previousData.p2Supersonic = v;
    }
  }

  // 3. P3 Telemetry (Decoupled & Skipped if !latestData.p3HasCar)
  if (previousData.p3HasCar !== latestData.p3HasCar) {
    const v = latestData.p3HasCar;
    for (let i = 0; i < p3HasCarListeners.length; i++) p3HasCarListeners[i](v);
    previousData.p3HasCar = v;
  }
  if (previousData.p3Name !== latestData.p3Name) {
    const v = latestData.p3Name;
    for (let i = 0; i < p3NameListeners.length; i++) p3NameListeners[i](v);
    previousData.p3Name = v;
  }
  if (latestData.p3HasCar) {
    if (previousData.p3Speed !== latestData.p3Speed) {
      const v = latestData.p3Speed;
      for (let i = 0; i < p3SpeedListeners.length; i++) p3SpeedListeners[i](v);
      previousData.p3Speed = v;
    }
    if (previousData.p3Boost !== latestData.p3Boost) {
      const v = latestData.p3Boost;
      for (let i = 0; i < p3BoostListeners.length; i++) p3BoostListeners[i](v);
      previousData.p3Boost = v;
    }
    if (previousData.p3Boosting !== latestData.p3Boosting) {
      const v = latestData.p3Boosting;
      for (let i = 0; i < p3BoostingListeners.length; i++) p3BoostingListeners[i](v);
      previousData.p3Boosting = v;
    }
    if (previousData.p3OnGround !== latestData.p3OnGround) {
      const v = latestData.p3OnGround;
      for (let i = 0; i < p3OnGroundListeners.length; i++) p3OnGroundListeners[i](v);
      previousData.p3OnGround = v;
    }
    if (previousData.p3OnWall !== latestData.p3OnWall) {
      const v = latestData.p3OnWall;
      for (let i = 0; i < p3OnWallListeners.length; i++) p3OnWallListeners[i](v);
      previousData.p3OnWall = v;
    }
    if (previousData.p3Powersliding !== latestData.p3Powersliding) {
      const v = latestData.p3Powersliding;
      for (let i = 0; i < p3PowerslidingListeners.length; i++) p3PowerslidingListeners[i](v);
      previousData.p3Powersliding = v;
    }
    if (previousData.p3Demolished !== latestData.p3Demolished) {
      const v = latestData.p3Demolished;
      for (let i = 0; i < p3DemolishedListeners.length; i++) p3DemolishedListeners[i](v);
      previousData.p3Demolished = v;
    }
    if (previousData.p3Supersonic !== latestData.p3Supersonic) {
      const v = latestData.p3Supersonic;
      for (let i = 0; i < p3SupersonicListeners.length; i++) p3SupersonicListeners[i](v);
      previousData.p3Supersonic = v;
    }
  }

  // 4. Global Match Time & Overtime
  if (previousData.timeSeconds !== latestData.timeSeconds) {
    const v = latestData.timeSeconds;
    for (let i = 0; i < timeSecondsListeners.length; i++) timeSecondsListeners[i](v);
    previousData.timeSeconds = v;
  }
  if (previousData.bOvertime !== latestData.bOvertime) {
    const v = latestData.bOvertime;
    for (let i = 0; i < bOvertimeListeners.length; i++) bOvertimeListeners[i](v);
    previousData.bOvertime = v;
  }

  // 5. Ball Telemetry
  if (previousData.ballSpeed !== latestData.ballSpeed) {
    const v = latestData.ballSpeed;
    for (let i = 0; i < ballSpeedListeners.length; i++) ballSpeedListeners[i](v);
    previousData.ballSpeed = v;
  }
  if (previousData.ballTeamNum !== latestData.ballTeamNum) {
    const v = latestData.ballTeamNum;
    for (let i = 0; i < ballTeamListeners.length; i++) ballTeamListeners[i](v);
    previousData.ballTeamNum = v;
  }

  // 6. Match Scores & Diff
  if (previousData.scoreDiff !== latestData.scoreDiff) {
    const v = latestData.scoreDiff;
    for (let i = 0; i < scoreDiffListeners.length; i++) scoreDiffListeners[i](v);
    previousData.scoreDiff = v;
  }
  if (previousData.myScore !== latestData.myScore || previousData.oppScore !== latestData.oppScore) {
    const myS = latestData.myScore;
    const oppS = latestData.oppScore;
    for (let i = 0; i < matchScoreListeners.length; i++) matchScoreListeners[i]();
    if (previousData.myScore !== myS) {
      for (let i = 0; i < myScoreListeners.length; i++) myScoreListeners[i](myS);
      previousData.myScore = myS;
    }
    if (previousData.oppScore !== oppS) {
      for (let i = 0; i < oppScoreListeners.length; i++) oppScoreListeners[i](oppS);
      previousData.oppScore = oppS;
    }
  }

  // 7. Team Colors
  if (
    previousData.myPrimaryColor !== latestData.myPrimaryColor ||
    previousData.mySecondaryColor !== latestData.mySecondaryColor ||
    previousData.oppPrimaryColor !== latestData.oppPrimaryColor ||
    previousData.oppSecondaryColor !== latestData.oppSecondaryColor
  ) {
    for (let i = 0; i < teamColorsListeners.length; i++) teamColorsListeners[i]();
    previousData.myPrimaryColor = latestData.myPrimaryColor;
    previousData.mySecondaryColor = latestData.mySecondaryColor;
    previousData.oppPrimaryColor = latestData.oppPrimaryColor;
    previousData.oppSecondaryColor = latestData.oppSecondaryColor;
  }
}
