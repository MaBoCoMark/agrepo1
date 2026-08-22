import { GlobalLayoutSettings, TelemetryBuffer } from './component-types';
import { CachedComponentInstance } from './dom-cache';
import { updateBoostMeterElement } from './boost-meter';

/**
 * ============================================================================
 * 🏎️ Competitive HUD High-Performance Renderer
 * ============================================================================
 *
 * Requirements strictly met:
 * 1. Zero `querySelector` / `querySelectorAll` inside the RAF loop.
 * 2. Zero layout recalculations / reflows (GPU scale transforms for bars).
 * 3. Diff-checking on all dynamic values to prevent unnecessary DOM writes.
 * ============================================================================
 */

function formatMinutesSeconds(totalSeconds: number): string {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(Math.trunc(totalSeconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const formattedSecs = secs.toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}${mins}:${formattedSecs}`;
}

function toKph(rawSpeed: number): number {
  if (rawSpeed > 150) return rawSpeed * 0.036;
  return rawSpeed;
}

function toUu(rawSpeed: number): number {
  if (rawSpeed > 150) return rawSpeed;
  return rawSpeed / 0.036;
}

function formatSpeed(rawSpeed: number, speedUnit?: string): string {
  if (speedUnit === 'uu/s') {
    return Math.round(toUu(rawSpeed)).toString();
  }
  return Math.round(toKph(rawSpeed)).toString();
}

function formatScoreDiff(diff: number): string {
  if (diff === 0) return '0';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

function applyBoolIndicatorFast(
  dot: HTMLElement | null,
  rawVal: boolean,
  cached: CachedComponentInstance,
  activeColor: string,
  inactiveColor: string = 'rgba(51, 65, 85, 0.5)'
) {
  if (!dot) return;
  const isFiltered = cached.inst.customProps?.invertBool ? !rawVal : Boolean(rawVal);
  if (isFiltered !== cached.lastBoolState) {
    cached.lastBoolState = isFiltered;
    dot.className = `el-pure-dot dyn-dot ${isFiltered ? 'bool-on' : 'bool-off'}`;
    const color = isFiltered ? activeColor : (cached.inst.customProps?.inactiveColor || inactiveColor);
    dot.style.backgroundColor = color;
    if (isFiltered && color !== 'transparent' && !color.startsWith('rgba(0, 0, 0, 0)')) {
      dot.style.boxShadow = `0 0 10px ${color}`;
    } else {
      dot.style.boxShadow = 'none';
    }
  }
}

export function renderCompetitiveSceneFast(
  cachedInstances: CachedComponentInstance[],
  latestData: TelemetryBuffer,
  globalSettings: GlobalLayoutSettings
): void {
  const autoHide = globalSettings.autoHideNonExistingPlayers !== false;
  const myTeamColor = latestData.myPrimaryColor || '#1873FF';
  const oppTeamColor = latestData.oppPrimaryColor || '#C26418';

  const len = cachedInstances.length;
  for (let i = 0; i < len; i++) {
    const cached = cachedInstances[i];
    const inst = cached.inst;
    const container = cached.container;

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

    // 0. Auto-hide non-existing players' components
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

    // 1. Dispatch Component Rendering based on pre-cached element handles
    switch (inst.componentType) {
      // --------------------------------------------------
      // Boost Text
      // --------------------------------------------------
      case 'element-boost-text':
      case 'element-boost-text-fixed': {
        const valEl = cached.valEl;
        if (valEl) {
          const str = boost.toString();
          if (str !== cached.lastTextContent) {
            valEl.textContent = str;
            cached.lastTextContent = str;

            let fallbackColor = inst.customProps?.colorHigh || '#10b981';
            let blink = false;
            if (boost < 12) {
              fallbackColor = inst.customProps?.colorLow || '#ef4444';
              blink = inst.customProps?.enableBlink !== false && inst.componentType !== 'element-boost-text-fixed';
            } else if (boost < 30) {
              fallbackColor = inst.customProps?.colorLow || '#ef4444';
            } else if (boost < 60) {
              fallbackColor = inst.customProps?.colorMid || '#f59e0b';
            }

            if (blink !== cached.boostTierState.lastBlink) {
              valEl.classList.toggle('danger-blink', blink);
              cached.boostTierState.lastBlink = blink;
            }

            if (fallbackColor !== cached.lastColor) {
              valEl.style.color = fallbackColor;
              cached.lastColor = fallbackColor;
            }
          }
        }
        break;
      }

      // --------------------------------------------------
      // Speed Text
      // --------------------------------------------------
      case 'element-speed-text': {
        const valEl = cached.valEl;
        if (valEl) {
          const str = formatSpeed(speed, inst.speedUnit);
          if (str !== cached.lastTextContent) {
            valEl.textContent = str;
            cached.lastTextContent = str;
          }
        }
        break;
      }

      // --------------------------------------------------
      // Player Name
      // --------------------------------------------------
      case 'element-player-name-text': {
        const valEl = cached.valEl;
        if (valEl && name !== cached.lastTextContent) {
          valEl.textContent = name;
          cached.lastTextContent = name;
        }
        break;
      }

      // --------------------------------------------------
      // Time Text
      // --------------------------------------------------
      case 'element-time-text': {
        const valEl = cached.valEl;
        if (valEl && latestData.timeSeconds !== cached.lastTimeSeconds) {
          valEl.textContent = formatMinutesSeconds(latestData.timeSeconds);
          cached.lastTimeSeconds = latestData.timeSeconds;
        }
        break;
      }

      // --------------------------------------------------
      // Ball Speed Text
      // --------------------------------------------------
      case 'element-ball-speed-text': {
        const valEl = cached.valEl;
        if (valEl) {
          const str = formatSpeed(latestData.ballSpeed, inst.speedUnit);
          if (str !== cached.lastTextContent) {
            valEl.textContent = str;
            cached.lastTextContent = str;
          }
        }
        break;
      }

      // --------------------------------------------------
      // Ball Team Text
      // --------------------------------------------------
      case 'element-ball-team-text': {
        const valEl = cached.valEl;
        if (valEl && latestData.ballTeamNum !== cached.lastBallTeam) {
          valEl.textContent = latestData.ballTeamNum === 0 ? 'BLUE' : 'ORANGE';
          valEl.style.color = latestData.ballTeamNum === 0 ? myTeamColor : oppTeamColor;
          cached.lastBallTeam = latestData.ballTeamNum;
        }
        break;
      }

      // --------------------------------------------------
      // Score Diff Text
      // --------------------------------------------------
      case 'element-score-diff-text': {
        const valEl = cached.valEl;
        if (valEl && latestData.scoreDiff !== cached.lastScoreDiff) {
          valEl.textContent = formatScoreDiff(latestData.scoreDiff);
          valEl.classList.toggle('score-pos', latestData.scoreDiff > 0);
          valEl.classList.toggle('score-neg', latestData.scoreDiff < 0);
          valEl.classList.toggle('score-tie', latestData.scoreDiff === 0);
          cached.lastScoreDiff = latestData.scoreDiff;
        }
        break;
      }

      // --------------------------------------------------
      // Match Score Text
      // --------------------------------------------------
      case 'element-match-score-text': {
        const valEl = cached.valEl;
        if (valEl) {
          const str = `${latestData.myScore} - ${latestData.oppScore}`;
          if (str !== cached.lastScoreText) {
            valEl.textContent = str;
            cached.lastScoreText = str;
          }
        }
        break;
      }

      // --------------------------------------------------
      // My Score / Opp Score Text
      // --------------------------------------------------
      case 'element-my-score-text': {
        const valEl = cached.valEl;
        if (valEl) {
          const str = latestData.myScore.toString();
          if (str !== cached.lastTextContent) {
            valEl.textContent = str;
            cached.lastTextContent = str;
          }
        }
        break;
      }
      case 'element-opp-score-text': {
        const valEl = cached.valEl;
        if (valEl) {
          const str = latestData.oppScore.toString();
          if (str !== cached.lastTextContent) {
            valEl.textContent = str;
            cached.lastTextContent = str;
          }
        }
        break;
      }

      // --------------------------------------------------
      // Static Text
      // --------------------------------------------------
      case 'element-static-text': {
        const valEl = cached.valEl;
        const text = inst.customProps?.staticText || 'LABEL';
        if (valEl && text !== cached.lastTextContent) {
          valEl.textContent = text;
          cached.lastTextContent = text;
        }
        break;
      }

      // --------------------------------------------------
      // Custom Text (Boolean Dynamic Opacity)
      // --------------------------------------------------
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

      // --------------------------------------------------
      // Global Text Indicator (Overtime vs Regular)
      // --------------------------------------------------
      case 'element-global-text-indicator': {
        const valEl = cached.valEl;
        if (valEl && latestData.bOvertime !== cached.lastBoolState) {
          cached.lastBoolState = latestData.bOvertime;
          valEl.textContent = latestData.bOvertime ? 'OVERTIME' : 'REGULAR TIME';
          valEl.style.color = latestData.bOvertime ? '#ff3b30' : '#30d158';
        }
        break;
      }

      // --------------------------------------------------
      // Team Color Box
      // --------------------------------------------------
      case 'element-team-color-box': {
        const box = cached.boxEl;
        if (box && myTeamColor !== cached.lastColor) {
          box.style.backgroundColor = myTeamColor;
          cached.lastColor = myTeamColor;
        }
        break;
      }

      // --------------------------------------------------
      // Boolean Dots Indicators
      // --------------------------------------------------
      case 'element-hascar-indicator':
        applyBoolIndicatorFast(cached.dotEl, hasCar, cached, '#30d158');
        break;
      case 'element-boosting-indicator':
        applyBoolIndicatorFast(cached.dotEl, isBoosting, cached, '#ff9500');
        break;
      case 'element-onground-indicator':
        applyBoolIndicatorFast(cached.dotEl, onGround, cached, '#0a84ff');
        break;
      case 'element-onwall-indicator':
        applyBoolIndicatorFast(cached.dotEl, onWall, cached, '#bf5af2');
        break;
      case 'element-powersliding-indicator':
        applyBoolIndicatorFast(cached.dotEl, powersliding, cached, '#ffd60a');
        break;
      case 'element-demolished-indicator':
        applyBoolIndicatorFast(cached.dotEl, demolished, cached, '#ff453a');
        break;
      case 'element-supersonic-indicator':
        applyBoolIndicatorFast(cached.dotEl, supersonic, cached, '#bf5af2');
        break;
      case 'element-overtime-indicator':
        applyBoolIndicatorFast(cached.dotEl, latestData.bOvertime, cached, '#ff453a');
        break;

      // --------------------------------------------------
      // Horizontal Boost Bars (GPU scaleX)
      // --------------------------------------------------
      case 'element-boost-bar':
      case 'element-boost-bar-no-blink':
      case 'boost-bar':
      case 'player-boost-bar':
      case 'widget-boost-bar': {
        const fill = cached.fillEl;
        if (fill) {
          updateBoostMeterElement(
            fill,
            cached.valEl,
            null,
            boost,
            cached.boostTierState,
            inst.customProps?.enableBlink !== false && inst.componentType !== 'element-boost-bar-no-blink',
            inst.customProps?.colorHigh,
            inst.customProps?.colorMid,
            inst.customProps?.colorLow
          );
        }
        break;
      }

      // --------------------------------------------------
      // Vertical Boost Bar (GPU scaleY)
      // --------------------------------------------------
      case 'element-vertical-boost-bar': {
        const fill = cached.fillEl;
        if (fill) {
          const scale = boost / 100;
          const transformStr = `scaleY(${scale})`;
          if (transformStr !== cached.boostTierState.lastTransform) {
            fill.style.transform = transformStr;
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
            fill.style.backgroundColor = color;
            fill.classList.toggle('danger-blink', blink);
          }
        }
        break;
      }

      // --------------------------------------------------
      // Boost Alert Bar
      // --------------------------------------------------
      case 'element-boost-alert-bar': {
        const box = cached.boxEl;
        if (box) {
          const threshold = Number(inst.customProps?.threshold ?? 12);
          const alertColor = inst.customProps?.alertColor || '#ef4444';
          const enableBlink = inst.customProps?.enableBlink !== false;
          const isAlert = boost <= threshold;

          if (isAlert !== cached.lastBoolState) {
            cached.lastBoolState = isAlert;
            if (isAlert) {
              if (enableBlink) {
                box.classList.add('alert-active');
                box.style.borderColor = alertColor;
                box.style.boxShadow = '';
              } else {
                box.classList.remove('alert-active');
                box.style.borderColor = alertColor;
                box.style.boxShadow = `0 0 16px ${alertColor}, inset 0 0 10px ${alertColor}`;
              }
            } else {
              box.classList.remove('alert-active');
              box.style.borderColor = 'transparent';
              box.style.boxShadow = 'none';
            }
          }
        }
        break;
      }

      // --------------------------------------------------
      // Horizontal Speed Bar (GPU scaleX)
      // --------------------------------------------------
      case 'element-speed-bar': {
        const fill = cached.fillEl;
        if (fill) {
          const uuSpeed = toUu(speed);
          const pct = Math.min(100, Math.max(0, (uuSpeed / 2300) * 100));
          const transformStr = `scaleX(${pct / 100})`;
          if (transformStr !== cached.boostTierState.lastTransform) {
            fill.style.transform = transformStr;
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
            fill.style.backgroundColor = color;
            fill.classList.toggle('supersonic-glow', glow);
          }
        }
        break;
      }

      // --------------------------------------------------
      // Vertical Speed Bar (GPU scaleY)
      // --------------------------------------------------
      case 'element-vertical-speed-bar': {
        const fill = cached.fillEl;
        if (fill) {
          const uuSpeed = toUu(speed);
          const pct = Math.min(100, Math.max(0, (uuSpeed / 2300) * 100));
          const transformStr = `scaleY(${pct / 100})`;
          if (transformStr !== cached.boostTierState.lastTransform) {
            fill.style.transform = transformStr;
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
            fill.style.backgroundColor = color;
            fill.classList.toggle('supersonic-glow', glow);
          }
        }
        break;
      }

      // --------------------------------------------------
      // Curved Boost Gauge (SVG)
      // --------------------------------------------------
      case 'element-curved-boost-bar': {
        const fill = cached.fillEl as SVGCircleElement | null;
        if (fill) {
          const thick = Number(inst.customProps?.thickness ?? 8);
          const gap = Number(inst.customProps?.gap ?? 90);
          const radius = 50 - thick / 2;
          const perimeter = 2 * Math.PI * radius;
          const activeAngle = 360 - gap;
          const totalDash = perimeter * (activeAngle / 360);
          const pct = Math.max(0, Math.min(1, boost / 100));
          const progressDash = totalDash * pct;
          const dashStr = `${progressDash} ${perimeter}`;

          if (dashStr !== cached.lastCurvedDash) {
            fill.setAttribute('stroke-dasharray', dashStr);
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

      // --------------------------------------------------
      // Curved Speedometer (SVG)
      // --------------------------------------------------
      case 'element-curved-speedometer': {
        const fill = cached.fillEl as SVGCircleElement | null;
        if (fill) {
          const thick = Number(inst.customProps?.thickness ?? 8);
          const gap = Number(inst.customProps?.gap ?? 90);
          const radius = 50 - thick / 2;
          const perimeter = 2 * Math.PI * radius;
          const activeAngle = 360 - gap;
          const totalDash = perimeter * (activeAngle / 360);
          const uuSpeed = toUu(speed);
          const pct = Math.max(0, Math.min(1, uuSpeed / 2300));
          const progressDash = totalDash * pct;
          const dashStr = `${progressDash} ${perimeter}`;

          if (dashStr !== cached.lastCurvedDash) {
            fill.setAttribute('stroke-dasharray', dashStr);
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

      // --------------------------------------------------
      // Composite: Score Diff Widget
      // --------------------------------------------------
      case 'score-diff':
      case 'widget-score-diff': {
        if (cached.valEl && latestData.scoreDiff !== cached.lastScoreDiff) {
          cached.valEl.textContent = formatScoreDiff(latestData.scoreDiff);
          cached.valEl.classList.toggle('score-pos', latestData.scoreDiff > 0);
          cached.valEl.classList.toggle('score-neg', latestData.scoreDiff < 0);
          cached.valEl.classList.toggle('score-tie', latestData.scoreDiff === 0);
          cached.lastScoreDiff = latestData.scoreDiff;
        }
        if (cached.subValEl) {
          const str = `${latestData.myScore}-${latestData.oppScore}`;
          if (str !== cached.lastScoreText) {
            cached.subValEl.textContent = str;
            cached.lastScoreText = str;
          }
        }
        break;
      }

      // --------------------------------------------------
      // Composite: Time Remaining Widget
      // --------------------------------------------------
      case 'time-remaining':
      case 'widget-time-remaining': {
        if (cached.valEl && latestData.timeSeconds !== cached.lastTimeSeconds) {
          cached.valEl.textContent = formatMinutesSeconds(latestData.timeSeconds);
          cached.lastTimeSeconds = latestData.timeSeconds;
        }
        break;
      }

      // --------------------------------------------------
      // Composite: Overtime Status Widget
      // --------------------------------------------------
      case 'overtime-status':
      case 'widget-overtime-status': {
        if (cached.dotEl && latestData.bOvertime !== cached.lastBoolState) {
          cached.lastBoolState = latestData.bOvertime;
          cached.dotEl.className = `status-dot dyn-dot ${latestData.bOvertime ? 'bool-on ot-active' : 'bool-off ot-inactive'}`;
        }
        break;
      }

      // --------------------------------------------------
      // Composite: Ball Speed Widget
      // --------------------------------------------------
      case 'ball-speed':
      case 'widget-ball-speed': {
        if (cached.valEl) {
          const str = formatSpeed(latestData.ballSpeed, inst.speedUnit);
          if (str !== cached.lastTextContent) {
            cached.valEl.textContent = str;
            cached.lastTextContent = str;
          }
        }
        break;
      }

      // --------------------------------------------------
      // Composite: Ball Team Widget
      // --------------------------------------------------
      case 'ball-team':
      case 'widget-ball-team': {
        if (cached.valEl && latestData.ballTeamNum !== cached.lastBallTeam) {
          cached.valEl.textContent = latestData.ballTeamNum === 0 ? 'BLUE' : 'ORANGE';
          cached.valEl.style.color = latestData.ballTeamNum === 0 ? myTeamColor : oppTeamColor;
          cached.lastBallTeam = latestData.ballTeamNum;
        }
        break;
      }

      // --------------------------------------------------
      // Composite: Team Colors Widget
      // --------------------------------------------------
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

      // --------------------------------------------------
      // Composite: Player Name / Speed / Boost Combo Widgets
      // --------------------------------------------------
      case 'player-name':
      case 'widget-player-name': {
        if (cached.valEl && name !== cached.lastTextContent) {
          cached.valEl.textContent = name;
          cached.lastTextContent = name;
        }
        break;
      }

      case 'player-speed':
      case 'widget-player-speed': {
        if (cached.valEl) {
          const str = formatSpeed(speed, inst.speedUnit);
          if (str !== cached.lastTextContent) {
            cached.valEl.textContent = str;
            cached.lastTextContent = str;
          }
        }
        break;
      }

      case 'boost-val':
      case 'player-boost-val':
      case 'widget-boost-val': {
        if (cached.valEl && boost !== cached.boostTierState.lastVal) {
          cached.valEl.textContent = boost.toString();
          cached.boostTierState.lastVal = boost;
        }
        break;
      }

      case 'boost-combo':
      case 'widget-boost-combo': {
        if (cached.valEl && boost !== cached.boostTierState.lastVal) {
          cached.valEl.textContent = boost.toString();
        }
        if (cached.fillEl) {
          updateBoostMeterElement(
            cached.fillEl,
            cached.valEl,
            null,
            boost,
            cached.boostTierState,
            inst.customProps?.enableBlink !== false
          );
        }
        break;
      }

      case 'player-status':
      case 'widget-player-status': {
        const isSupersonic = supersonic;
        if (cached.dotEl && isSupersonic !== cached.lastBoolState) {
          cached.lastBoolState = isSupersonic;
          cached.dotEl.className = `status-dot dyn-dot ${isSupersonic ? 'bool-on active' : 'bool-off'}`;
        }
        break;
      }

      // --------------------------------------------------
      // Composite Panels (Match Header, Player Telemetry, Team Roster)
      // --------------------------------------------------
      case 'panel-match-header': {
        if (cached.diffVal && latestData.scoreDiff !== cached.lastScoreDiff) {
          cached.diffVal.textContent = formatScoreDiff(latestData.scoreDiff);
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
          cached.timeVal.textContent = formatMinutesSeconds(latestData.timeSeconds);
          cached.lastTimeSeconds = latestData.timeSeconds;
        }
        if (cached.otVal && latestData.bOvertime !== cached.lastBoolState) {
          cached.lastBoolState = latestData.bOvertime;
          cached.otVal.textContent = latestData.bOvertime ? 'OVERTIME' : 'REGULAR';
          cached.otVal.style.color = latestData.bOvertime ? '#f59e0b' : '#64748b';
        }
        if (cached.ballVal) {
          const spd = `${formatSpeed(latestData.ballSpeed, inst.speedUnit)} ${inst.speedUnit === 'uu/s' ? 'uu/s' : 'km/h'}`;
          if (spd !== cached.lastSpeedDisplay) {
            cached.ballVal.textContent = spd;
            cached.lastSpeedDisplay = spd;
          }
        }
        break;
      }

      case 'panel-player-telemetry': {
        if (cached.p1Name && name !== cached.lastTextContent) {
          cached.p1Name.textContent = name;
          cached.lastTextContent = name;
        }
        if (cached.valEl) {
          const spd = formatSpeed(speed, inst.speedUnit);
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
            cached.p1Fill.style.backgroundColor = boost < 30 ? '#ef4444' : (boost < 60 ? '#f59e0b' : '#10b981');
          }
          cached.boostTierState.lastVal = boost;
        }

        // Booleans in telemetry panel
        if (cached.dotCar) cached.dotCar.className = `status-dot dyn-hascar ${hasCar ? 'bool-on' : 'bool-off'}`;
        if (cached.dotBoost) cached.dotBoost.className = `status-dot dyn-boosting ${isBoosting ? 'bool-on' : 'bool-off'}`;
        if (cached.dotGround) cached.dotGround.className = `status-dot dyn-onground ${onGround ? 'bool-on' : 'bool-off'}`;
        if (cached.dotWall) cached.dotWall.className = `status-dot dyn-onwall ${onWall ? 'bool-on' : 'bool-off'}`;
        if (cached.dotSlide) cached.dotSlide.className = `status-dot dyn-slide ${powersliding ? 'bool-on' : 'bool-off'}`;
        if (cached.dotDemo) cached.dotDemo.className = `status-dot dyn-demo ${demolished ? 'bool-on' : 'bool-off'}`;
        if (cached.dotSuper) cached.dotSuper.className = `status-dot dyn-super ${supersonic ? 'bool-on' : 'bool-off'}`;
        break;
      }

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
            cached.p1Fill.style.backgroundColor = latestData.p1Boost < 30 ? '#ef4444' : (latestData.p1Boost < 60 ? '#f59e0b' : '#10b981');
          }
          cached.boostTierState.lastVal = latestData.p1Boost;
        }

        if (cached.p2Name) cached.p2Name.textContent = latestData.p2Name;
        if (cached.p2Val) cached.p2Val.textContent = latestData.p2Boost.toString();
        if (cached.p2Fill) {
          cached.p2Fill.style.transform = `scaleX(${latestData.p2Boost / 100})`;
          cached.p2Fill.style.backgroundColor = latestData.p2Boost < 30 ? '#ef4444' : (latestData.p2Boost < 60 ? '#f59e0b' : '#10b981');
        }

        if (cached.p3Name) cached.p3Name.textContent = latestData.p3Name;
        if (cached.p3Val) cached.p3Val.textContent = latestData.p3Boost.toString();
        if (cached.p3Fill) {
          cached.p3Fill.style.transform = `scaleX(${latestData.p3Boost / 100})`;
          cached.p3Fill.style.backgroundColor = latestData.p3Boost < 30 ? '#ef4444' : (latestData.p3Boost < 60 ? '#f59e0b' : '#10b981');
        }
        break;
      }
    }
  }
}
