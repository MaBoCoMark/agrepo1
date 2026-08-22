/**
 * ============================================================================
 * ⚡ Overlay Main Performance Engine
 * ============================================================================
 *
 * HOT PATH LOCALIZATION:
 * All high-frequency requestAnimationFrame (rAF) dirty-checking and DOM updates
 * live directly in this file for maximum V8 JIT inlining and cache locality.
 *
 * ZERO querySelector calls during normal rAF execution.
 * Pre-cached DOM element references only.
 * ============================================================================
 */

import { TelemetryBuffer, GlobalLayoutSettings, DEFAULT_TEAM_COLORS, ColorSource } from './component-types';
import { previousData, latestData, overlayState } from './telemetry-state';
import {
  getDevDashboardCache,
  getCompetitiveDomCache
} from './dom-cache';
import { loadGlobalLayoutSettings } from './layout-store';
import { updateMockStream } from './mock-stream';
import { recordBenchmarkFrame } from './benchmark-recorder';
import { loadLayers, switchSceneMode, switchRefMode } from './scene-manager';
import { setupOverlayEventListeners } from './event-bridge';
import { connectWebSocket } from './websocket-manager';

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
    const uu = speed > 150 ? speed : speed / 0.036;
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
 * High-Frequency Animation Tick Loop (@ 120Hz - 360Hz+)
 * Directly flattened into overlay.ts with hot path dirty-checking.
 */
function tick(now: number): void {
  // 1. Log benchmark frame timestamp if recording
  recordBenchmarkFrame(now);

  // 2. Step mock physics simulation if enabled
  if (overlayState.isSimulating) {
    updateMockStream(latestData);
  }

  // =========================================================================
  // 3. Hot Path: Developer Dashboard Renderer (Flat Direct Dirty-Checking)
  // =========================================================================
  if (overlayState.isDevDashboardVisible) {
    const devDom = getDevDashboardCache();
    if (devDom) {
      // Time & Overtime
      if (latestData.timeSeconds !== previousData.timeSeconds) {
        if (devDom.countdown) devDom.countdown.textContent = fmtMinSec(latestData.timeSeconds);
      }
      if (latestData.bOvertime !== previousData.bOvertime) {
        if (devDom.overtime) {
          devDom.overtime.textContent = latestData.bOvertime ? 'OVERTIME' : 'REGULAR TIME';
          devDom.overtime.style.color = latestData.bOvertime ? '#ff3b30' : '#30d158';
        }
      }

      // Ball Speed & Ball Team
      if (latestData.ballSpeed !== previousData.ballSpeed) {
        if (devDom.ballSpeed) devDom.ballSpeed.textContent = `${latestData.ballSpeed} KPH`;
      }
      if (latestData.ballTeamNum !== previousData.ballTeamNum) {
        if (devDom.ballTeam) {
          devDom.ballTeam.textContent = latestData.ballTeamNum === 0 ? 'TEAM 0 (BLUE)' : 'TEAM 1 (ORANGE)';
          devDom.ballTeam.style.color = latestData.ballTeamNum === 0 ? '#1873FF' : '#C26418';
        }
      }

      // Scores
      if (latestData.myScore !== previousData.myScore || latestData.oppScore !== previousData.oppScore) {
        if (devDom.matchScore) devDom.matchScore.textContent = `${latestData.myScore} - ${latestData.oppScore}`;
      }
      if (latestData.scoreDiff !== previousData.scoreDiff) {
        if (devDom.scoreDiff) {
          devDom.scoreDiff.textContent = fmtScoreDiff(latestData.scoreDiff);
          devDom.scoreDiff.style.color = latestData.scoreDiff > 0 ? '#30d158' : latestData.scoreDiff < 0 ? '#ff453a' : '#ffffff';
        }
      }

      // Team Colors
      if (latestData.myPrimaryColor !== previousData.myPrimaryColor && devDom.myPrimaryColor) {
        devDom.myPrimaryColor.style.backgroundColor = latestData.myPrimaryColor || '#1873FF';
      }
      if (latestData.mySecondaryColor !== previousData.mySecondaryColor && devDom.mySecondaryColor) {
        devDom.mySecondaryColor.style.backgroundColor = latestData.mySecondaryColor || '#E5E5E5';
      }
      if (latestData.oppPrimaryColor !== previousData.oppPrimaryColor && devDom.oppPrimaryColor) {
        devDom.oppPrimaryColor.style.backgroundColor = latestData.oppPrimaryColor || '#C26418';
      }
      if (latestData.oppSecondaryColor !== previousData.oppSecondaryColor && devDom.oppSecondaryColor) {
        devDom.oppSecondaryColor.style.backgroundColor = latestData.oppSecondaryColor || '#E5E5E5';
      }

      // P1 Dirty-Checking
      if (latestData.p1Name !== previousData.p1Name && devDom.p1Name) devDom.p1Name.textContent = latestData.p1Name;
      if (latestData.p1Speed !== previousData.p1Speed && devDom.p1Speed) devDom.p1Speed.textContent = latestData.p1Speed.toString();
      if (latestData.p1Boost !== previousData.p1Boost) {
        if (devDom.p1BoostVal) devDom.p1BoostVal.textContent = latestData.p1Boost.toString();
        if (devDom.p1BoostBar) {
          devDom.p1BoostBar.style.transform = `scaleX(${latestData.p1Boost / 100})`;
          const b = latestData.p1Boost;
          const color = b < 30 ? '#ef4444' : b < 60 ? '#f59e0b' : '#10b981';
          devDom.p1BoostBar.style.backgroundColor = color;
          devDom.p1BoostBar.classList.toggle('danger-blink', b < 12);
        }
      }
      if (latestData.p1HasCar !== previousData.p1HasCar && devDom.p1HasCar) devDom.p1HasCar.className = `status-dot ${latestData.p1HasCar ? 'bool-on' : 'bool-off'}`;
      if (latestData.p1Boosting !== previousData.p1Boosting && devDom.p1Boosting) devDom.p1Boosting.className = `status-dot ${latestData.p1Boosting ? 'bool-on' : 'bool-off'}`;
      if (latestData.p1OnGround !== previousData.p1OnGround && devDom.p1OnGround) devDom.p1OnGround.className = `status-dot ${latestData.p1OnGround ? 'bool-on' : 'bool-off'}`;
      if (latestData.p1OnWall !== previousData.p1OnWall && devDom.p1OnWall) devDom.p1OnWall.className = `status-dot ${latestData.p1OnWall ? 'bool-on' : 'bool-off'}`;
      if (latestData.p1Powersliding !== previousData.p1Powersliding && devDom.p1Powersliding) devDom.p1Powersliding.className = `status-dot ${latestData.p1Powersliding ? 'bool-on' : 'bool-off'}`;
      if (latestData.p1Demolished !== previousData.p1Demolished && devDom.p1Demolished) devDom.p1Demolished.className = `status-dot ${latestData.p1Demolished ? 'bool-on' : 'bool-off'}`;
      if (latestData.p1Supersonic !== previousData.p1Supersonic && devDom.p1Supersonic) devDom.p1Supersonic.className = `status-dot ${latestData.p1Supersonic ? 'bool-on' : 'bool-off'}`;

      // P2 Dirty-Checking
      if (latestData.p2Name !== previousData.p2Name && devDom.p2Name) devDom.p2Name.textContent = latestData.p2Name;
      if (latestData.p2Speed !== previousData.p2Speed && devDom.p2Speed) devDom.p2Speed.textContent = latestData.p2Speed.toString();
      if (latestData.p2Boost !== previousData.p2Boost) {
        if (devDom.p2BoostVal) devDom.p2BoostVal.textContent = latestData.p2Boost.toString();
        if (devDom.p2BoostBar) {
          devDom.p2BoostBar.style.transform = `scaleX(${latestData.p2Boost / 100})`;
          const b = latestData.p2Boost;
          const color = b < 30 ? '#ef4444' : b < 60 ? '#f59e0b' : '#10b981';
          devDom.p2BoostBar.style.backgroundColor = color;
          devDom.p2BoostBar.classList.toggle('danger-blink', b < 12);
        }
      }
      if (latestData.p2HasCar !== previousData.p2HasCar && devDom.p2HasCar) devDom.p2HasCar.className = `status-dot ${latestData.p2HasCar ? 'bool-on' : 'bool-off'}`;
      if (latestData.p2Boosting !== previousData.p2Boosting && devDom.p2Boosting) devDom.p2Boosting.className = `status-dot ${latestData.p2Boosting ? 'bool-on' : 'bool-off'}`;
      if (latestData.p2OnGround !== previousData.p2OnGround && devDom.p2OnGround) devDom.p2OnGround.className = `status-dot ${latestData.p2OnGround ? 'bool-on' : 'bool-off'}`;
      if (latestData.p2OnWall !== previousData.p2OnWall && devDom.p2OnWall) devDom.p2OnWall.className = `status-dot ${latestData.p2OnWall ? 'bool-on' : 'bool-off'}`;
      if (latestData.p2Powersliding !== previousData.p2Powersliding && devDom.p2Powersliding) devDom.p2Powersliding.className = `status-dot ${latestData.p2Powersliding ? 'bool-on' : 'bool-off'}`;
      if (latestData.p2Demolished !== previousData.p2Demolished && devDom.p2Demolished) devDom.p2Demolished.className = `status-dot ${latestData.p2Demolished ? 'bool-on' : 'bool-off'}`;
      if (latestData.p2Supersonic !== previousData.p2Supersonic && devDom.p2Supersonic) devDom.p2Supersonic.className = `status-dot ${latestData.p2Supersonic ? 'bool-on' : 'bool-off'}`;

      // P3 Dirty-Checking
      if (latestData.p3Name !== previousData.p3Name && devDom.p3Name) devDom.p3Name.textContent = latestData.p3Name;
      if (latestData.p3Speed !== previousData.p3Speed && devDom.p3Speed) devDom.p3Speed.textContent = latestData.p3Speed.toString();
      if (latestData.p3Boost !== previousData.p3Boost) {
        if (devDom.p3BoostVal) devDom.p3BoostVal.textContent = latestData.p3Boost.toString();
        if (devDom.p3BoostBar) {
          devDom.p3BoostBar.style.transform = `scaleX(${latestData.p3Boost / 100})`;
          const b = latestData.p3Boost;
          const color = b < 30 ? '#ef4444' : b < 60 ? '#f59e0b' : '#10b981';
          devDom.p3BoostBar.style.backgroundColor = color;
          devDom.p3BoostBar.classList.toggle('danger-blink', b < 12);
        }
      }
      if (latestData.p3HasCar !== previousData.p3HasCar && devDom.p3HasCar) devDom.p3HasCar.className = `status-dot ${latestData.p3HasCar ? 'bool-on' : 'bool-off'}`;
      if (latestData.p3Boosting !== previousData.p3Boosting && devDom.p3Boosting) devDom.p3Boosting.className = `status-dot ${latestData.p3Boosting ? 'bool-on' : 'bool-off'}`;
      if (latestData.p3OnGround !== previousData.p3OnGround && devDom.p3OnGround) devDom.p3OnGround.className = `status-dot ${latestData.p3OnGround ? 'bool-on' : 'bool-off'}`;
      if (latestData.p3OnWall !== previousData.p3OnWall && devDom.p3OnWall) devDom.p3OnWall.className = `status-dot ${latestData.p3OnWall ? 'bool-on' : 'bool-off'}`;
      if (latestData.p3Powersliding !== previousData.p3Powersliding && devDom.p3Powersliding) devDom.p3Powersliding.className = `status-dot ${latestData.p3Powersliding ? 'bool-on' : 'bool-off'}`;
      if (latestData.p3Demolished !== previousData.p3Demolished && devDom.p3Demolished) devDom.p3Demolished.className = `status-dot ${latestData.p3Demolished ? 'bool-on' : 'bool-off'}`;
      if (latestData.p3Supersonic !== previousData.p3Supersonic && devDom.p3Supersonic) devDom.p3Supersonic.className = `status-dot ${latestData.p3Supersonic ? 'bool-on' : 'bool-off'}`;
    }
  }

  // =========================================================================
  // 4. Hot Path: Competitive Scene HUD Renderer (Flat Direct Dirty-Checking)
  // =========================================================================
  if (overlayState.isCompetitiveVisible) {
    const cachedInstances = getCompetitiveDomCache();
    const len = cachedInstances.length;
    const autoHide = globalSettings.autoHideNonExistingPlayers !== false;
    const myTeamColor = latestData.myPrimaryColor || DEFAULT_TEAM_COLORS.myPrimaryColor;
    const oppTeamColor = latestData.oppPrimaryColor || DEFAULT_TEAM_COLORS.oppPrimaryColor;

    for (let i = 0; i < len; i++) {
      const cached = cachedInstances[i];
      const inst = cached.inst;
      const container = cached.container;

      // Extract target player properties
      const p = inst.targetPlayer || 'p1';
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

      // Auto-hide non-existing players' components
      if (autoHide && (inst.category === 'player' || inst.targetPlayer)) {
        if (!hasCar) {
          if (cached.lastDisplay !== 'none') {
            container.style.display = 'none';
            cached.lastDisplay = 'none';
          }
          continue;
        } else {
          if (cached.lastDisplay !== '') {
            container.style.display = '';
            cached.lastDisplay = '';
          }
        }
      } else {
        if (cached.lastDisplay !== '') {
          container.style.display = '';
          cached.lastDisplay = '';
        }
      }

      // Fast per-component dirty update
      switch (inst.componentType) {
        // Boost Text
        case 'element-boost-text':
        case 'element-boost-text-fixed': {
          if (cached.valEl) {
            const str = boost.toString();
            if (str !== cached.lastTextContent) {
              cached.valEl.textContent = str;
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
                cached.valEl.classList.toggle('danger-blink', blink);
                cached.boostTierState.lastBlink = blink;
              }
              if (color !== cached.lastColor) {
                cached.valEl.style.color = color;
                cached.lastColor = color;
              }
            }
          }
          break;
        }

        // Speed Text
        case 'element-speed-text': {
          if (cached.valEl) {
            const str = fmtSpeed(speed, inst.speedUnit);
            if (str !== cached.lastTextContent) {
              cached.valEl.textContent = str;
              cached.lastTextContent = str;
            }
          }
          break;
        }

        // Player Name
        case 'element-player-name-text': {
          if (cached.valEl && name !== cached.lastTextContent) {
            cached.valEl.textContent = name;
            cached.lastTextContent = name;
          }
          break;
        }

        // Time Text
        case 'element-time-text': {
          if (cached.valEl && latestData.timeSeconds !== cached.lastTimeSeconds) {
            cached.valEl.textContent = fmtMinSec(latestData.timeSeconds);
            cached.lastTimeSeconds = latestData.timeSeconds;
          }
          break;
        }

        // Ball Speed Text
        case 'element-ball-speed-text': {
          if (cached.valEl) {
            const str = fmtSpeed(latestData.ballSpeed, inst.speedUnit);
            if (str !== cached.lastTextContent) {
              cached.valEl.textContent = str;
              cached.lastTextContent = str;
            }
          }
          break;
        }

        // Ball Team Text
        case 'element-ball-team-text': {
          if (cached.valEl && latestData.ballTeamNum !== cached.lastBallTeam) {
            cached.valEl.textContent = latestData.ballTeamNum === 0 ? 'BLUE' : 'ORANGE';
            cached.valEl.style.color = latestData.ballTeamNum === 0 ? myTeamColor : oppTeamColor;
            cached.lastBallTeam = latestData.ballTeamNum;
          }
          break;
        }

        // Score Diff Text
        case 'element-score-diff-text': {
          if (cached.valEl && latestData.scoreDiff !== cached.lastScoreDiff) {
            cached.valEl.textContent = fmtScoreDiff(latestData.scoreDiff);
            cached.valEl.classList.toggle('score-pos', latestData.scoreDiff > 0);
            cached.valEl.classList.toggle('score-neg', latestData.scoreDiff < 0);
            cached.valEl.classList.toggle('score-tie', latestData.scoreDiff === 0);
            cached.lastScoreDiff = latestData.scoreDiff;
          }
          break;
        }

        // Match Score Text
        case 'element-match-score-text': {
          if (cached.valEl) {
            const str = `${latestData.myScore} - ${latestData.oppScore}`;
            if (str !== cached.lastScoreText) {
              cached.valEl.textContent = str;
              cached.lastScoreText = str;
            }
          }
          break;
        }

        // Team Color Box (6-Color System)
        case 'element-team-color-box': {
          if (cached.boxEl) {
            const mode = inst.customProps?.boxColorMode || 'my-primary';
            const color = resolveColor(mode, inst.customProps?.bgColor, myTeamColor, latestData);
            if (color !== cached.lastColor) {
              cached.boxEl.style.backgroundColor = color;
              cached.lastColor = color;
            }
          }
          break;
        }

        // Horizontal Boost Bar (GPU scaleX)
        case 'element-boost-bar':
        case 'element-boost-bar-no-blink':
        case 'boost-bar':
        case 'player-boost-bar':
        case 'widget-boost-bar': {
          if (cached.fillEl) {
            const scale = boost / 100;
            const transformStr = `scaleX(${scale})`;
            if (transformStr !== cached.boostTierState.lastTransform) {
              cached.fillEl.style.transform = transformStr;
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

            if (currentTier !== cached.boostTierState.tier || blink !== cached.boostTierState.lastBlink) {
              cached.boostTierState.tier = currentTier;
              cached.boostTierState.lastBlink = blink;
              cached.fillEl.style.backgroundColor = color;
              cached.fillEl.classList.toggle('danger-blink', blink);
            }
          }
          break;
        }

        // Vertical Boost Bar (GPU scaleY)
        case 'element-vertical-boost-bar': {
          if (cached.fillEl) {
            const scale = boost / 100;
            const transformStr = `scaleY(${scale})`;
            if (transformStr !== cached.boostTierState.lastTransform) {
              cached.fillEl.style.transform = transformStr;
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

            if (currentTier !== cached.boostTierState.tier || blink !== cached.boostTierState.lastBlink) {
              cached.boostTierState.tier = currentTier;
              cached.boostTierState.lastBlink = blink;
              cached.fillEl.style.backgroundColor = color;
              cached.fillEl.classList.toggle('danger-blink', blink);
            }
          }
          break;
        }

        // Boost Alert Bar
        case 'element-boost-alert-bar': {
          if (cached.boxEl) {
            const threshold = Number(inst.customProps?.threshold ?? 12);
            const alertColor = inst.customProps?.alertColor || '#ef4444';
            const enableBlink = inst.customProps?.enableBlink !== false;
            const isAlert = boost <= threshold;

            if (isAlert !== cached.lastBoolState) {
              cached.lastBoolState = isAlert;
              if (isAlert) {
                if (enableBlink) {
                  cached.boxEl.classList.add('alert-active');
                  cached.boxEl.style.borderColor = alertColor;
                  cached.boxEl.style.boxShadow = '';
                } else {
                  cached.boxEl.classList.remove('alert-active');
                  cached.boxEl.style.borderColor = alertColor;
                  cached.boxEl.style.boxShadow = `0 0 16px ${alertColor}, inset 0 0 10px ${alertColor}`;
                }
              } else {
                cached.boxEl.classList.remove('alert-active');
                cached.boxEl.style.borderColor = 'transparent';
                cached.boxEl.style.boxShadow = 'none';
              }
            }
          }
          break;
        }

        // Horizontal Speed Bar (GPU scaleX)
        case 'element-speed-bar': {
          if (cached.fillEl) {
            const uuSpeed = speed > 150 ? speed : speed / 0.036;
            const pct = Math.min(100, Math.max(0, (uuSpeed / 2300) * 100));
            const transformStr = `scaleX(${pct / 100})`;
            if (transformStr !== cached.boostTierState.lastTransform) {
              cached.fillEl.style.transform = transformStr;
              cached.boostTierState.lastTransform = transformStr;
            }

            let color = inst.customProps?.colorLow || '#d4af37';
            let glow = false;
            if (uuSpeed >= 2200) {
              color = inst.customProps?.colorHigh || inst.customProps?.colorSupersonic || '#9333ea';
              glow = true;
            } else if (uuSpeed >= 1400) {
              color = inst.customProps?.colorMid || inst.customProps?.colorMidStart || '#77ca7a';
            }

            if (glow !== cached.lastGlow || color !== cached.lastColor) {
              cached.lastGlow = glow;
              cached.lastColor = color;
              cached.fillEl.style.backgroundColor = color;
              cached.fillEl.classList.toggle('supersonic-glow', glow);
            }
          }
          break;
        }

        // Vertical Speed Bar (GPU scaleY)
        case 'element-vertical-speed-bar': {
          if (cached.fillEl) {
            const uuSpeed = speed > 150 ? speed : speed / 0.036;
            const pct = Math.min(100, Math.max(0, (uuSpeed / 2300) * 100));
            const transformStr = `scaleY(${pct / 100})`;
            if (transformStr !== cached.boostTierState.lastTransform) {
              cached.fillEl.style.transform = transformStr;
              cached.boostTierState.lastTransform = transformStr;
            }

            let color = inst.customProps?.colorLow || '#d4af37';
            let glow = false;
            if (uuSpeed >= 2200) {
              color = inst.customProps?.colorHigh || inst.customProps?.colorSupersonic || '#9333ea';
              glow = true;
            } else if (uuSpeed >= 1400) {
              color = inst.customProps?.colorMid || inst.customProps?.colorMidStart || '#77ca7a';
            }

            if (glow !== cached.lastGlow || color !== cached.lastColor) {
              cached.lastGlow = glow;
              cached.lastColor = color;
              cached.fillEl.style.backgroundColor = color;
              cached.fillEl.classList.toggle('supersonic-glow', glow);
            }
          }
          break;
        }

        // Curved Boost Bar (SVG Arc)
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
          break;
        }

        // Curved Speedometer (SVG Arc)
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
            const uuSpeed = speed > 150 ? speed : speed / 0.036;
            const progressDash = totalDash * Math.max(0, Math.min(1, uuSpeed / 2300));
            const dashStr = `${progressDash} ${perimeter}`;

            if (dashStr !== cached.lastCurvedDash) {
              fill.setAttribute('r', radius.toString());
              fill.setAttribute('stroke-width', thick.toString());
              fill.setAttribute('stroke-dasharray', dashStr);
              fill.style.transform = `rotate(${orient + (gap / 2)}deg)`;
              fill.style.transformOrigin = '50px 50px';
              cached.lastCurvedDash = dashStr;

              let strokeColor = inst.customProps?.colorLow || '#d4af37';
              let glow = false;
              if (uuSpeed >= 2200) {
                strokeColor = inst.customProps?.colorHigh || '#a020f0';
                glow = true;
              } else if (uuSpeed >= 1400) {
                strokeColor = inst.customProps?.colorMid || '#77ca7a';
              }

              fill.setAttribute('stroke', strokeColor);
              fill.classList.toggle('curved-supersonic', glow);
            }
          }
          break;
        }

        // Boolean Indicators (with 6-color system)
        case 'element-demolished-indicator':
        case 'element-hascar-indicator':
        case 'element-boosting-indicator':
        case 'element-onground-indicator':
        case 'element-onwall-indicator':
        case 'element-powersliding-indicator':
        case 'element-supersonic-indicator':
        case 'element-overtime-indicator': {
          if (cached.dotEl) {
            let rawVal = false;
            let defaultActiveColor = '#30d158';
            if (inst.componentType === 'element-demolished-indicator') { rawVal = demolished; defaultActiveColor = '#ff453a'; }
            else if (inst.componentType === 'element-hascar-indicator') { rawVal = hasCar; defaultActiveColor = '#30d158'; }
            else if (inst.componentType === 'element-boosting-indicator') { rawVal = isBoosting; defaultActiveColor = '#ff9500'; }
            else if (inst.componentType === 'element-onground-indicator') { rawVal = onGround; defaultActiveColor = '#0a84ff'; }
            else if (inst.componentType === 'element-onwall-indicator') { rawVal = onWall; defaultActiveColor = '#bf5af2'; }
            else if (inst.componentType === 'element-powersliding-indicator') { rawVal = powersliding; defaultActiveColor = '#ffd60a'; }
            else if (inst.componentType === 'element-supersonic-indicator') { rawVal = supersonic; defaultActiveColor = '#bf5af2'; }
            else if (inst.componentType === 'element-overtime-indicator') { rawVal = latestData.bOvertime; defaultActiveColor = '#ff453a'; }

            const isFiltered = inst.customProps?.invertBool ? !rawVal : Boolean(rawVal);
            if (isFiltered !== cached.lastBoolState) {
              cached.lastBoolState = isFiltered;
              cached.dotEl.className = `el-pure-dot dyn-dot ${isFiltered ? 'bool-on' : 'bool-off'}`;

              const activeColor = resolveColor(
                inst.customProps?.activeColorMode,
                inst.customProps?.activeColor,
                defaultActiveColor,
                latestData
              );
              const inactiveColor = inst.customProps?.inactiveColor || 'rgba(51, 65, 85, 0.5)';
              const color = isFiltered ? activeColor : inactiveColor;
              cached.dotEl.style.backgroundColor = color;
              if (isFiltered && color !== 'transparent' && !color.startsWith('rgba(0, 0, 0, 0)')) {
                cached.dotEl.style.boxShadow = `0 0 10px ${color}`;
              } else {
                cached.dotEl.style.boxShadow = 'none';
              }
            }
          }
          break;
        }

        // Custom Text
        case 'element-custom-text':
        case 'custom-text': {
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
              container.style.opacity = (effectiveOpacity * (isFiltered ? enOp : disOp)).toString();
            }
          }
          break;
        }

        // Composite Widget: Score Diff
        case 'score-diff':
        case 'widget-score-diff': {
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
          break;
        }

        // Composite Widget: Time Remaining
        case 'time-remaining':
        case 'widget-time-remaining': {
          if (cached.valEl && latestData.timeSeconds !== cached.lastTimeSeconds) {
            cached.valEl.textContent = fmtMinSec(latestData.timeSeconds);
            cached.lastTimeSeconds = latestData.timeSeconds;
          }
          break;
        }

        // Composite Widget: Team Colors
        case 'team-colors':
        case 'widget-team-colors': {
          if (cached.myPrimary && myTeamColor !== cached.lastColor) {
            cached.myPrimary.style.backgroundColor = myTeamColor;
            cached.lastColor = myTeamColor;
          }
          if (cached.oppPrimary) {
            cached.oppPrimary.style.backgroundColor = oppTeamColor;
          }
          break;
        }

        // Composite Widget: Boost Combo
        case 'boost-combo':
        case 'widget-boost-combo': {
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
          break;
        }

        // Composite Panel: Match Header
        case 'panel-match-header': {
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
          break;
        }

        // Composite Panel: Player Telemetry
        case 'panel-player-telemetry': {
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
          break;
        }

        // Composite Panel: Team Roster
        case 'panel-team-roster': {
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

          if (cached.p2Name) cached.p2Name.textContent = latestData.p2Name;
          if (cached.p2Val) cached.p2Val.textContent = latestData.p2Boost.toString();
          if (cached.p2Fill) {
            cached.p2Fill.style.transform = `scaleX(${latestData.p2Boost / 100})`;
            cached.p2Fill.style.backgroundColor = latestData.p2Boost < 30 ? '#ef4444' : latestData.p2Boost < 60 ? '#f59e0b' : '#10b981';
          }

          if (cached.p3Name) cached.p3Name.textContent = latestData.p3Name;
          if (cached.p3Val) cached.p3Val.textContent = latestData.p3Boost.toString();
          if (cached.p3Fill) {
            cached.p3Fill.style.transform = `scaleX(${latestData.p3Boost / 100})`;
            cached.p3Fill.style.backgroundColor = latestData.p3Boost < 30 ? '#ef4444' : latestData.p3Boost < 60 ? '#f59e0b' : '#10b981';
          }
          break;
        }
      }
    }
  }

  // 5. Update previousData primitives for next frame
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
