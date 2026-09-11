import { latestData, overlayState } from './telemetry-state';

/**
 * ============================================================================
 * 🎬 Replay Viewer Controller
 * ============================================================================
 */

export interface ReplayViewerData {
  scorerName: string;
  goalSpeed: string;
  assisterName: string | null;
}

export let currentReplayData: ReplayViewerData = {
  scorerName: 'Swabbie',
  goalSpeed: '92KPH',
  assisterName: 'Beast'
};

export let replayTransitionDuration = 0.75; // seconds
export let replayEntranceDelay = 1.00; // seconds (default 1.00s, adjustable 0.00s - 2.00s)

export function setReplayTransitionDuration(duration: number): void {
  replayTransitionDuration = duration;
}

export function setReplayEntranceDelay(delay: number): void {
  replayEntranceDelay = Math.max(0, Math.min(2.0, Number(delay) || 0));
}

export function updateReplaySvgBorder(): void {
  const svgPath = document.getElementById('svgBorderPath');
  if (!svgPath) return;
  const winW = window.innerWidth;
  const baseTop = 120;
  const sideY = -16;
  const centerY = 47;
  const wingW = 7;
  const slopeW = 15;

  const sideY_px = baseTop + sideY;
  const centerY_px = baseTop + centerY;

  const p1_x = winW * (wingW / 100);
  const p2_x = winW * ((wingW + slopeW) / 100);
  const p3_x = winW * ((100 - wingW - slopeW) / 100);
  const p4_x = winW * ((100 - wingW) / 100);

  const dPath = `M 0 ${sideY_px} L ${p1_x} ${sideY_px} L ${p2_x} ${centerY_px} L ${p3_x} ${centerY_px} L ${p4_x} ${sideY_px} L ${winW} ${sideY_px}`;
  svgPath.setAttribute('d', dPath);
}

export function updateReplayViewerDOM(): void {
  const scorerEl = document.getElementById('replay-goal-player');
  const speedEl = document.getElementById('replay-goal-speed');
  const assistItemEl = document.getElementById('replay-assist-item');
  const assistPlayerEl = document.getElementById('replay-assist-player');

  if (scorerEl) {
    scorerEl.textContent = currentReplayData.scorerName || 'Player';
  }
  if (speedEl) {
    speedEl.textContent = currentReplayData.goalSpeed || '0KPH';
  }
  if (assistItemEl) {
    if (currentReplayData.assisterName && currentReplayData.assisterName.trim().length > 0) {
      assistItemEl.style.display = 'flex';
      if (assistPlayerEl) {
        assistPlayerEl.textContent = currentReplayData.assisterName.trim();
      }
    } else {
      assistItemEl.style.display = 'none';
    }
  }
}

export function processGoalScored(rawObj: any): void {
  if (!rawObj) return;
  const scorerName = rawObj.Scorer?.Name || '';
  const goalSpeedRaw = rawObj.GoalSpeed;
  let speedStr = '0KPH';
  if (typeof goalSpeedRaw === 'number') {
    const kph = goalSpeedRaw > 150 ? Math.floor(goalSpeedRaw * 0.036) : Math.floor(goalSpeedRaw); speedStr = `${kph}KPH`;
  } else if (typeof goalSpeedRaw === 'string') {
    speedStr = goalSpeedRaw.endsWith('KPH') ? goalSpeedRaw : `${goalSpeedRaw}KPH`;
  }

  const assisterName = (rawObj.Assister && rawObj.Assister.Name && rawObj.Assister.Name.trim().length > 0)
    ? rawObj.Assister.Name.trim()
    : null;

  currentReplayData = {
    scorerName: scorerName || 'Player',
    goalSpeed: speedStr,
    assisterName
  };

  updateReplayViewerDOM();
}

let switchSceneModeFn: ((target: string, notifyConfigurator?: boolean) => void) | null = null;
let replayEnterTimeout: any = null;

export function registerSceneSwitcher(fn: (target: string, notifyConfigurator?: boolean) => void): void {
  switchSceneModeFn = fn;
}

export function enterReplayView(): void {
  if (switchSceneModeFn) {
    switchSceneModeFn('replay-viewer', true);
  }
  updateReplayViewerDOM();
  updateReplaySvgBorder();

  if (replayEnterTimeout) {
    clearTimeout(replayEnterTimeout);
    replayEnterTimeout = null;
  }

  const footer = document.getElementById('replayFooter') || document.querySelector('.rl-footer');
  if (footer) {
    footer.classList.remove('rl-footer-hiding');
    footer.classList.remove('rl-footer-visible');
  }

  const triggerSlideUp = () => {
    const f = document.getElementById('replayFooter') || document.querySelector('.rl-footer');
    if (f) {
      f.classList.remove('rl-footer-hiding');
      f.classList.remove('rl-footer-visible');
      void (f as HTMLElement).offsetHeight;
      f.classList.add('rl-footer-visible');
    }
  };

  if (replayEntranceDelay <= 0) {
    triggerSlideUp();
  } else {
    replayEnterTimeout = setTimeout(() => {
      replayEnterTimeout = null;
      triggerSlideUp();
    }, replayEntranceDelay * 1000);
  }
}

export function willEndReplayView(): void {
  if (replayEnterTimeout) {
    clearTimeout(replayEnterTimeout);
    replayEnterTimeout = null;
  }
  const footer = document.getElementById('replayFooter') || document.querySelector('.rl-footer');
  if (footer) {
    footer.classList.remove('rl-footer-visible');
    footer.classList.add('rl-footer-hiding');
  }
}

export function immediateEndReplayView(): void {
  if (replayEnterTimeout) {
    clearTimeout(replayEnterTimeout);
    replayEnterTimeout = null;
  }
  const footer = document.getElementById('replayFooter') || document.querySelector('.rl-footer');
  if (footer) {
    footer.classList.remove('rl-footer-visible');
    footer.classList.remove('rl-footer-hiding');
  }
  if (overlayState.currentActiveScene === 'replay-viewer') {
    if (latestData.p1Name && latestData.p1Name !== '-') {
      if (switchSceneModeFn) switchSceneModeFn('competitive', true);
    } else {
      if (switchSceneModeFn) switchSceneModeFn('empty', true);
    }
  }
}
