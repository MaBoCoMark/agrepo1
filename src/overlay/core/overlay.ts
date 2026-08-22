import { emitTo, emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getMergedManifest } from './config-loader';
import { ComponentInstance, GlobalLayoutSettings, TelemetryBuffer, DEFAULT_TEAM_COLORS } from './component-types';
import {
  COMPONENT_METAS,
  createComponentInnerHtml,
  updateComponentInstanceDom,
  initComponentCatalog
} from './component-registry';
import {
  getScreenHeightVw,
  calculateElementTopLeft,
  loadCompetitiveLayout,
  saveCompetitiveLayout,
  loadGlobalLayoutSettings,
  saveGlobalLayoutSettings
} from './layout-store';
import { DraggerController } from './dragger';

const refCanvas = document.getElementById('reference-canvas') as HTMLDivElement;
const sceneCanvas = document.getElementById('scene-canvas') as HTMLDivElement;

const spawnedRefs = new Map<string, HTMLElement>();
const spawnedScenes = new Map<string, HTMLElement>();
const manifest = getMergedManifest();

async function setOverlayClickThrough(ignore: boolean): Promise<void> {
  try {
    await invoke('set_overlay_click_through', { ignore });
  } catch (err) {
    // fallback
  }
  try {
    await emit('toggle-overlay-click-through', { ignore });
  } catch (err) {
    // ignore
  }
}

// 内存常驻零 GC 缓冲区
const previousData: TelemetryBuffer = {
  timeSeconds: -1,
  bOvertime: false,
  ballSpeed: -1,
  ballTeamNum: -1,
  myScore: -1,
  oppScore: -1,
  scoreDiff: -999,
  myPrimaryColor: '',
  mySecondaryColor: '',
  oppPrimaryColor: '',
  oppSecondaryColor: '',

  p1Name: '',
  p1Speed: -1,
  p1Boost: -1,
  p1HasCar: false,
  p1Boosting: false,
  p1OnGround: false,
  p1OnWall: false,
  p1Powersliding: false,
  p1Demolished: false,
  p1Supersonic: false,

  p2Name: '',
  p2Speed: -1,
  p2Boost: -1,
  p2HasCar: false,
  p2Boosting: false,
  p2OnGround: false,
  p2OnWall: false,
  p2Powersliding: false,
  p2Demolished: false,
  p2Supersonic: false,

  p3Name: '',
  p3Speed: -1,
  p3Boost: -1,
  p3HasCar: false,
  p3Boosting: false,
  p3OnGround: false,
  p3OnWall: false,
  p3Powersliding: false,
  p3Demolished: false,
  p3Supersonic: false
};

const latestData: TelemetryBuffer = {
  timeSeconds: 0,
  bOvertime: false,
  ballSpeed: 0,
  ballTeamNum: 0,
  myScore: 0,
  oppScore: 0,
  scoreDiff: 0,
  myPrimaryColor: DEFAULT_TEAM_COLORS.myPrimaryColor,
  mySecondaryColor: DEFAULT_TEAM_COLORS.mySecondaryColor,
  oppPrimaryColor: DEFAULT_TEAM_COLORS.oppPrimaryColor,
  oppSecondaryColor: DEFAULT_TEAM_COLORS.oppSecondaryColor,

  p1Name: '-',
  p1Speed: 0,
  p1Boost: 0,
  p1HasCar: false,
  p1Boosting: false,
  p1OnGround: false,
  p1OnWall: false,
  p1Powersliding: false,
  p1Demolished: false,
  p1Supersonic: false,

  p2Name: '-',
  p2Speed: 0,
  p2Boost: 0,
  p2HasCar: false,
  p2Boosting: false,
  p2OnGround: false,
  p2OnWall: false,
  p2Powersliding: false,
  p2Demolished: false,
  p2Supersonic: false,

  p3Name: '-',
  p3Speed: 0,
  p3Boost: 0,
  p3HasCar: false,
  p3Boosting: false,
  p3OnGround: false,
  p3OnWall: false,
  p3Powersliding: false,
  p3Demolished: false,
  p3Supersonic: false
};

// 状态控制开关与可见性哨兵
let isSimulating = false;
let isDevDashboardVisible = false;
let isCompetitiveVisible = false;
let isLayoutEditing = false;
let isAutoSceneControl = true;
let hasReceivedDataSinceConnected = false;
let currentActiveScene = 'not-connected';

// --- 🌟 DOM 节点缓存池 (Developer Dashboard) ---
interface DevDashboardDomNodes {
  countdown: HTMLElement | null;
  overtime: HTMLElement | null;
  ballSpeed: HTMLElement | null;
  ballTeam: HTMLElement | null;
  scoreDiff: HTMLElement | null;
  matchScore: HTMLElement | null;
  myPrimaryColor: HTMLElement | null;
  mySecondaryColor: HTMLElement | null;
  oppPrimaryColor: HTMLElement | null;
  oppSecondaryColor: HTMLElement | null;

  p1Name: HTMLElement | null;
  p1Speed: HTMLElement | null;
  p1BoostVal: HTMLElement | null;
  p1BoostBar: HTMLElement | null;
  p1BoostCell: HTMLElement | null;
  p1HasCar: HTMLElement | null;
  p1Boosting: HTMLElement | null;
  p1OnGround: HTMLElement | null;
  p1OnWall: HTMLElement | null;
  p1Powersliding: HTMLElement | null;
  p1Demolished: HTMLElement | null;
  p1Supersonic: HTMLElement | null;

  p2Name: HTMLElement | null;
  p2Speed: HTMLElement | null;
  p2BoostVal: HTMLElement | null;
  p2BoostBar: HTMLElement | null;
  p2BoostCell: HTMLElement | null;
  p2HasCar: HTMLElement | null;
  p2Boosting: HTMLElement | null;
  p2OnGround: HTMLElement | null;
  p2OnWall: HTMLElement | null;
  p2Powersliding: HTMLElement | null;
  p2Demolished: HTMLElement | null;
  p2Supersonic: HTMLElement | null;

  p3Name: HTMLElement | null;
  p3Speed: HTMLElement | null;
  p3BoostVal: HTMLElement | null;
  p3BoostBar: HTMLElement | null;
  p3BoostCell: HTMLElement | null;
  p3HasCar: HTMLElement | null;
  p3Boosting: HTMLElement | null;
  p3OnGround: HTMLElement | null;
  p3OnWall: HTMLElement | null;
  p3Powersliding: HTMLElement | null;
  p3Demolished: HTMLElement | null;
  p3Supersonic: HTMLElement | null;
}

let devDom: DevDashboardDomNodes | null = null;
let competitiveInstances: ComponentInstance[] = [];
let dragger: DraggerController | null = null;

// --- 🌟 Replay Viewer 状态与数据模型 ---
interface ReplayViewerData {
  scorerName: string;
  goalSpeed: string;
  assisterName: string | null;
}

let currentReplayData: ReplayViewerData = {
  scorerName: 'Swabbie',
  goalSpeed: '92KPH',
  assisterName: 'Beast'
};

let replayTransitionDuration = 0.75; // 秒，默认 0.75s

function updateReplaySvgBorder() {
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

function updateReplayViewerDOM() {
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

function processGoalScored(rawObj: any) {
  if (!rawObj) return;
  const scorerName = rawObj.Scorer?.Name || '';
  const goalSpeedRaw = rawObj.GoalSpeed;
  let speedStr = '0KPH';
  if (typeof goalSpeedRaw === 'number') {
    speedStr = `${Math.round(goalSpeedRaw)}KPH`;
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

function enterReplayView() {
  switchSceneMode('replay-viewer', true);
  updateReplayViewerDOM();
  updateReplaySvgBorder();

  const footer = document.getElementById('replayFooter') || document.querySelector('.rl-footer');
  if (footer) {
    footer.classList.remove('rl-footer-hiding');
    footer.classList.remove('rl-footer-visible');
    void (footer as HTMLElement).offsetHeight;
    footer.classList.add('rl-footer-visible');
  }
}

function willEndReplayView() {
  const footer = document.getElementById('replayFooter') || document.querySelector('.rl-footer');
  if (footer) {
    footer.classList.remove('rl-footer-visible');
    footer.classList.add('rl-footer-hiding');
  }
}

function immediateEndReplayView() {
  const footer = document.getElementById('replayFooter') || document.querySelector('.rl-footer');
  if (footer) {
    footer.classList.remove('rl-footer-visible');
    footer.classList.remove('rl-footer-hiding');
  }
  if (currentActiveScene === 'replay-viewer') {
    if (latestData.p1Name && latestData.p1Name !== '-') {
      switchSceneMode('competitive', true);
    } else {
      switchSceneMode('empty', true);
    }
  }
}

function cacheDevDashboardNodes() {
  devDom = {
    countdown: document.getElementById('countdown-val'),
    overtime: document.getElementById('overtime-indicator'),
    ballSpeed: document.getElementById('ball-speed-val'),
    ballTeam: document.getElementById('ball-team-val'),
    scoreDiff: document.getElementById('score-diff-val'),
    matchScore: document.getElementById('match-score-val'),
    myPrimaryColor: document.getElementById('my-color-primary'),
    mySecondaryColor: document.getElementById('my-color-secondary'),
    oppPrimaryColor: document.getElementById('opp-color-primary'),
    oppSecondaryColor: document.getElementById('opp-color-secondary'),

    p1Name: document.getElementById('p1-name-val'),
    p1Speed: document.getElementById('p1-speed-val'),
    p1BoostVal: document.getElementById('p1-boost-val'),
    p1BoostBar: document.getElementById('p1-boost-bar'),
    p1BoostCell: document.getElementById('p1-boost-cell'),
    p1HasCar: document.getElementById('p1-hascar-ind'),
    p1Boosting: document.getElementById('p1-boosting-ind'),
    p1OnGround: document.getElementById('p1-onground-ind'),
    p1OnWall: document.getElementById('p1-onwall-ind'),
    p1Powersliding: document.getElementById('p1-powersliding-ind'),
    p1Demolished: document.getElementById('p1-demolished-ind'),
    p1Supersonic: document.getElementById('p1-supersonic-ind'),

    p2Name: document.getElementById('p2-name-val'),
    p2Speed: document.getElementById('p2-speed-val'),
    p2BoostVal: document.getElementById('p2-boost-val'),
    p2BoostBar: document.getElementById('p2-boost-bar'),
    p2BoostCell: document.getElementById('p2-boost-cell'),
    p2HasCar: document.getElementById('p2-hascar-ind'),
    p2Boosting: document.getElementById('p2-boosting-ind'),
    p2OnGround: document.getElementById('p2-onground-ind'),
    p2OnWall: document.getElementById('p2-onwall-ind'),
    p2Powersliding: document.getElementById('p2-powersliding-ind'),
    p2Demolished: document.getElementById('p2-demolished-ind'),
    p2Supersonic: document.getElementById('p2-supersonic-ind'),

    p3Name: document.getElementById('p3-name-val'),
    p3Speed: document.getElementById('p3-speed-val'),
    p3BoostVal: document.getElementById('p3-boost-val'),
    p3BoostBar: document.getElementById('p3-boost-bar'),
    p3BoostCell: document.getElementById('p3-boost-cell'),
    p3HasCar: document.getElementById('p3-hascar-ind'),
    p3Boosting: document.getElementById('p3-boosting-ind'),
    p3OnGround: document.getElementById('p3-onground-ind'),
    p3OnWall: document.getElementById('p3-onwall-ind'),
    p3Powersliding: document.getElementById('p3-powersliding-ind'),
    p3Demolished: document.getElementById('p3-demolished-ind'),
    p3Supersonic: document.getElementById('p3-supersonic-ind')
  };
}

// --- ⚡️ 极速 UI 辅助函数 ---
function formatMinutesSeconds(totalSeconds: number): string {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(Math.trunc(totalSeconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const formattedSecs = secs.toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}${mins}:${formattedSecs}`;
}

function updateBoostUI(val: number, valEl: HTMLElement | null, barEl: HTMLElement | null, cellEl: HTMLElement | null) {
  if (valEl) valEl.textContent = val.toString();
  if (barEl) {
    barEl.style.transform = `scaleX(${val / 100})`;
    if (val < 20) {
      barEl.className = 'boost-bar-fill bar-red';
    } else if (val < 60) {
      barEl.className = 'boost-bar-fill bar-yellow';
    } else {
      barEl.className = 'boost-bar-fill bar-green';
    }
  }
  if (cellEl) {
    if (val <= 12) {
      cellEl.classList.add('glow-red');
    } else {
      cellEl.classList.remove('glow-red');
    }
  }
}

function updateBoolUI(val: boolean, el: HTMLElement | null) {
  if (!el) return;
  el.className = val ? 'status-dot bool-on' : 'status-dot bool-off';
}

function updateScoreDiffUI(diff: number, el: HTMLElement | null) {
  if (!el) return;
  if (diff === 0) {
    el.textContent = '0';
    el.className = 'global-val score-diff-text score-tie';
  } else if (diff > 0) {
    el.textContent = `+${diff}`;
    el.className = 'global-val score-diff-text score-pos';
  } else {
    el.textContent = `${diff}`;
    el.className = 'global-val score-diff-text score-neg';
  }
}

// --- ⚙️ 120Hz 高频双缓冲渲染循环 ---
function tick() {
  // 当处于布局编辑模式时，性能优化：不执行数据对比与渲染更新
  if (isLayoutEditing) {
    requestAnimationFrame(tick);
    return;
  }

  // 1. 模拟流更新
  if (isSimulating) {
    updateMockStream();
  }

  // 2. 🎛️ Developer Dashboard 场景高频更新
  if (isDevDashboardVisible && devDom) {
    if (latestData.timeSeconds !== previousData.timeSeconds) {
      if (devDom.countdown) devDom.countdown.textContent = formatMinutesSeconds(latestData.timeSeconds);
      previousData.timeSeconds = latestData.timeSeconds;
    }
    if (latestData.bOvertime !== previousData.bOvertime) {
      updateBoolUI(latestData.bOvertime, devDom.overtime);
      previousData.bOvertime = latestData.bOvertime;
    }
    if (latestData.ballSpeed !== previousData.ballSpeed) {
      if (devDom.ballSpeed) devDom.ballSpeed.textContent = latestData.ballSpeed.toString();
      previousData.ballSpeed = latestData.ballSpeed;
    }
    if (latestData.ballTeamNum !== previousData.ballTeamNum) {
      if (devDom.ballTeam) devDom.ballTeam.textContent = latestData.ballTeamNum.toString();
      previousData.ballTeamNum = latestData.ballTeamNum;
    }
    if (latestData.scoreDiff !== previousData.scoreDiff) {
      updateScoreDiffUI(latestData.scoreDiff, devDom.scoreDiff);
      previousData.scoreDiff = latestData.scoreDiff;
    }
    if (latestData.myScore !== previousData.myScore || latestData.oppScore !== previousData.oppScore) {
      if (devDom.matchScore) devDom.matchScore.textContent = `${latestData.myScore} - ${latestData.oppScore}`;
      previousData.myScore = latestData.myScore;
      previousData.oppScore = latestData.oppScore;
    }
    if (latestData.myPrimaryColor !== previousData.myPrimaryColor) {
      if (devDom.myPrimaryColor) devDom.myPrimaryColor.style.backgroundColor = latestData.myPrimaryColor;
      previousData.myPrimaryColor = latestData.myPrimaryColor;
    }
    if (latestData.mySecondaryColor !== previousData.mySecondaryColor) {
      if (devDom.mySecondaryColor) devDom.mySecondaryColor.style.backgroundColor = latestData.mySecondaryColor;
      previousData.mySecondaryColor = latestData.mySecondaryColor;
    }
    if (latestData.oppPrimaryColor !== previousData.oppPrimaryColor) {
      if (devDom.oppPrimaryColor) devDom.oppPrimaryColor.style.backgroundColor = latestData.oppPrimaryColor;
      previousData.oppPrimaryColor = latestData.oppPrimaryColor;
    }
    if (latestData.oppSecondaryColor !== previousData.oppSecondaryColor) {
      if (devDom.oppSecondaryColor) devDom.oppSecondaryColor.style.backgroundColor = latestData.oppSecondaryColor;
      previousData.oppSecondaryColor = latestData.oppSecondaryColor;
    }

    // --- P1 (Target) ---
    if (latestData.p1Name !== previousData.p1Name) {
      if (devDom.p1Name) devDom.p1Name.textContent = latestData.p1Name;
      previousData.p1Name = latestData.p1Name;
    }
    if (latestData.p1Speed !== previousData.p1Speed) {
      if (devDom.p1Speed) devDom.p1Speed.textContent = latestData.p1Speed.toString();
      previousData.p1Speed = latestData.p1Speed;
    }
    if (latestData.p1Boost !== previousData.p1Boost) {
      updateBoostUI(latestData.p1Boost, devDom.p1BoostVal, devDom.p1BoostBar, devDom.p1BoostCell);
      previousData.p1Boost = latestData.p1Boost;
    }
    if (latestData.p1HasCar !== previousData.p1HasCar) {
      updateBoolUI(latestData.p1HasCar, devDom.p1HasCar);
      previousData.p1HasCar = latestData.p1HasCar;
    }
    if (latestData.p1Boosting !== previousData.p1Boosting) {
      updateBoolUI(latestData.p1Boosting, devDom.p1Boosting);
      previousData.p1Boosting = latestData.p1Boosting;
    }
    if (latestData.p1OnGround !== previousData.p1OnGround) {
      updateBoolUI(latestData.p1OnGround, devDom.p1OnGround);
      previousData.p1OnGround = latestData.p1OnGround;
    }
    if (latestData.p1OnWall !== previousData.p1OnWall) {
      updateBoolUI(latestData.p1OnWall, devDom.p1OnWall);
      previousData.p1OnWall = latestData.p1OnWall;
    }
    if (latestData.p1Powersliding !== previousData.p1Powersliding) {
      updateBoolUI(latestData.p1Powersliding, devDom.p1Powersliding);
      previousData.p1Powersliding = latestData.p1Powersliding;
    }
    if (latestData.p1Demolished !== previousData.p1Demolished) {
      updateBoolUI(latestData.p1Demolished, devDom.p1Demolished);
      previousData.p1Demolished = latestData.p1Demolished;
    }
    if (latestData.p1Supersonic !== previousData.p1Supersonic) {
      updateBoolUI(latestData.p1Supersonic, devDom.p1Supersonic);
      previousData.p1Supersonic = latestData.p1Supersonic;
    }

    // --- P2 ---
    if (latestData.p2Name !== previousData.p2Name) {
      if (devDom.p2Name) devDom.p2Name.textContent = latestData.p2Name;
      previousData.p2Name = latestData.p2Name;
    }
    if (latestData.p2Speed !== previousData.p2Speed) {
      if (devDom.p2Speed) devDom.p2Speed.textContent = latestData.p2Speed.toString();
      previousData.p2Speed = latestData.p2Speed;
    }
    if (latestData.p2Boost !== previousData.p2Boost) {
      updateBoostUI(latestData.p2Boost, devDom.p2BoostVal, devDom.p2BoostBar, devDom.p2BoostCell);
      previousData.p2Boost = latestData.p2Boost;
    }
    if (latestData.p2HasCar !== previousData.p2HasCar) {
      updateBoolUI(latestData.p2HasCar, devDom.p2HasCar);
      previousData.p2HasCar = latestData.p2HasCar;
    }
    if (latestData.p2Boosting !== previousData.p2Boosting) {
      updateBoolUI(latestData.p2Boosting, devDom.p2Boosting);
      previousData.p2Boosting = latestData.p2Boosting;
    }
    if (latestData.p2OnGround !== previousData.p2OnGround) {
      updateBoolUI(latestData.p2OnGround, devDom.p2OnGround);
      previousData.p2OnGround = latestData.p2OnGround;
    }
    if (latestData.p2OnWall !== previousData.p2OnWall) {
      updateBoolUI(latestData.p2OnWall, devDom.p2OnWall);
      previousData.p2OnWall = latestData.p2OnWall;
    }
    if (latestData.p2Powersliding !== previousData.p2Powersliding) {
      updateBoolUI(latestData.p2Powersliding, devDom.p2Powersliding);
      previousData.p2Powersliding = latestData.p2Powersliding;
    }
    if (latestData.p2Demolished !== previousData.p2Demolished) {
      updateBoolUI(latestData.p2Demolished, devDom.p2Demolished);
      previousData.p2Demolished = latestData.p2Demolished;
    }
    if (latestData.p2Supersonic !== previousData.p2Supersonic) {
      updateBoolUI(latestData.p2Supersonic, devDom.p2Supersonic);
      previousData.p2Supersonic = latestData.p2Supersonic;
    }

    // --- P3 ---
    if (latestData.p3Name !== previousData.p3Name) {
      if (devDom.p3Name) devDom.p3Name.textContent = latestData.p3Name;
      previousData.p3Name = latestData.p3Name;
    }
    if (latestData.p3Speed !== previousData.p3Speed) {
      if (devDom.p3Speed) devDom.p3Speed.textContent = latestData.p3Speed.toString();
      previousData.p3Speed = latestData.p3Speed;
    }
    if (latestData.p3Boost !== previousData.p3Boost) {
      updateBoostUI(latestData.p3Boost, devDom.p3BoostVal, devDom.p3BoostBar, devDom.p3BoostCell);
      previousData.p3Boost = latestData.p3Boost;
    }
    if (latestData.p3HasCar !== previousData.p3HasCar) {
      updateBoolUI(latestData.p3HasCar, devDom.p3HasCar);
      previousData.p3HasCar = latestData.p3HasCar;
    }
    if (latestData.p3Boosting !== previousData.p3Boosting) {
      updateBoolUI(latestData.p3Boosting, devDom.p3Boosting);
      previousData.p3Boosting = latestData.p3Boosting;
    }
    if (latestData.p3OnGround !== previousData.p3OnGround) {
      updateBoolUI(latestData.p3OnGround, devDom.p3OnGround);
      previousData.p3OnGround = latestData.p3OnGround;
    }
    if (latestData.p3OnWall !== previousData.p3OnWall) {
      updateBoolUI(latestData.p3OnWall, devDom.p3OnWall);
      previousData.p3OnWall = latestData.p3OnWall;
    }
    if (latestData.p3Powersliding !== previousData.p3Powersliding) {
      updateBoolUI(latestData.p3Powersliding, devDom.p3Powersliding);
      previousData.p3Powersliding = latestData.p3Powersliding;
    }
    if (latestData.p3Demolished !== previousData.p3Demolished) {
      updateBoolUI(latestData.p3Demolished, devDom.p3Demolished);
      previousData.p3Demolished = latestData.p3Demolished;
    }
    if (latestData.p3Supersonic !== previousData.p3Supersonic) {
      updateBoolUI(latestData.p3Supersonic, devDom.p3Supersonic);
      previousData.p3Supersonic = latestData.p3Supersonic;
    }
  }

  // 3. 🏎️ Competitive 场景独立组件高频更新
  if (isCompetitiveVisible) {
    const compRoot = document.getElementById('competitive-root');
    if (compRoot) {
      for (let i = 0; i < competitiveInstances.length; i++) {
        const inst = competitiveInstances[i];
        const container = compRoot.querySelector(`[data-instance-id="${inst.instanceId}"]`) as HTMLElement | null;
        if (container) {
          updateComponentInstanceDom(container, inst, latestData);
        }
      }
    }
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

// --- 📥 2. WebSocket 管理与事件处理引擎 ---
interface RLPlayerRaw {
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

interface RLTeamRaw {
  Name?: string;
  TeamNum?: number;
  Score?: number;
  ColorPrimary?: string;
  ColorSecondary?: string;
}

interface RLGameRaw {
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

interface RLStateData {
  MatchGuid?: string;
  Players?: RLPlayerRaw[];
  Game?: RLGameRaw;
}

interface RLWebSocketMessage {
  Event?: string;
  Data?: string | RLStateData | any;
}

// WebSocket 配置与状态
let wsHost = '127.0.0.1';
let wsPort = '52950';
let isManualDisconnected = false;
let isAutoRetryDisabled = false;
let isCaptureRequested = false;
let captureTargetEvents: string[] = ['UpdateState'];
let ws: WebSocket | null = null;
let retryTimer: any = null;
let wsStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

function notifyWsStatus() {
  emitTo('configurator', 'ws-status-changed', {
    status: wsStatus,
    host: wsHost,
    port: wsPort
  });
}

function evaluateAutoScene() {
  if (!isAutoSceneControl) return;

  if (wsStatus !== 'connected') {
    hasReceivedDataSinceConnected = false;
    switchSceneMode('not-connected', true);
  } else {
    if (!hasReceivedDataSinceConnected && !isSimulating) {
      switchSceneMode('empty', true);
    }
  }
}

function processUpdateState(data: RLStateData) {
  if (!data) return;

  // 1. 全局参数
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
  }

  // 2. 确定 Target 与本方队伍
  const players = data.Players || [];
  let targetTeam: number | null = null;
  let targetName: string | null = null;

  const hasTarget = Boolean(data.Game?.bHasTarget || (data.Game?.Target && data.Game.Target.Name));
  const hasWinner = Boolean(data.Game?.bHasWinner);

  if (data.Game?.Target) {
    targetName = data.Game.Target.Name || null;
    targetTeam = data.Game.Target.TeamNum !== undefined ? data.Game.Target.TeamNum : null;
  }

  // 🌟 Automatic Scene Control 判断:
  // - 如果 UpdateState 中 bHasWinner 为 true，自动切换到 empty 场景
  // - 当处于 replay-viewer 场景时，UpdateState 绝不抢占切换场景或重新拉起回放，
  //   回放的进入与退出完全由 GoalReplayStart / GoalReplayWillEnd / GoalReplayEnd 权威事件驱动！
  // - 非回放状态且 hasTarget 为 true 时，保持或进入 competitive 场景
  if (isAutoSceneControl) {
    if (hasWinner) {
      if (currentActiveScene !== 'empty') {
        immediateEndReplayView();
        switchSceneMode('empty', true);
      }
    } else if (currentActiveScene !== 'replay-viewer' && hasTarget) {
      if (currentActiveScene !== 'competitive') {
        switchSceneMode('competitive', true);
      }
    }
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

  // 3. 解析比分与队伍颜色 (Game.Teams)
  if (data.Game?.Teams && Array.isArray(data.Game.Teams) && data.Game.Teams.length > 0) {
    const effectiveTargetTeam = targetTeam !== null ? targetTeam : (p1?.TeamNum !== undefined ? p1.TeamNum : 0);
    let myTeamObj = data.Game.Teams.find((t) => t.TeamNum === effectiveTargetTeam);
    let oppTeamObj = data.Game.Teams.find((t) => t.TeamNum !== effectiveTargetTeam);

    if (!myTeamObj && data.Game.Teams[0]) myTeamObj = data.Game.Teams[0];
    if (!oppTeamObj && data.Game.Teams[1]) oppTeamObj = data.Game.Teams[1];

    const myScore = myTeamObj?.Score ?? 0;
    const oppScore = oppTeamObj?.Score ?? 0;

    latestData.myScore = myScore;
    latestData.oppScore = oppScore;
    latestData.scoreDiff = myScore - oppScore;

    if (myTeamObj?.ColorPrimary) {
      const hex = myTeamObj.ColorPrimary.startsWith('#') ? myTeamObj.ColorPrimary : `#${myTeamObj.ColorPrimary}`;
      latestData.myPrimaryColor = hex;
    }
    if (myTeamObj?.ColorSecondary) {
      const hex = myTeamObj.ColorSecondary.startsWith('#') ? myTeamObj.ColorSecondary : `#${myTeamObj.ColorSecondary}`;
      latestData.mySecondaryColor = hex;
    }
    if (oppTeamObj?.ColorPrimary) {
      const hex = oppTeamObj.ColorPrimary.startsWith('#') ? oppTeamObj.ColorPrimary : `#${oppTeamObj.ColorPrimary}`;
      latestData.oppPrimaryColor = hex;
    }
    if (oppTeamObj?.ColorSecondary) {
      const hex = oppTeamObj.ColorSecondary.startsWith('#') ? oppTeamObj.ColorSecondary : `#${oppTeamObj.ColorSecondary}`;
      latestData.oppSecondaryColor = hex;
    }
  }

  // 填装 P1
  if (p1) {
    latestData.p1Name = p1.Name || 'P1';
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
    latestData.p1Name = '-';
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

  // 填装 P2 (队友 1)
  const p2 = teammates[0] || null;
  if (p2) {
    latestData.p2Name = p2.Name || 'P2';
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
    latestData.p2Name = '-';
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

  // 填装 P3 (队友 2)
  const p3 = teammates[1] || null;
  if (p3) {
    latestData.p3Name = p3.Name || 'P3';
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
    latestData.p3Name = '-';
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

// 统一事件路由器
function handleIncomingMessage(raw: RLWebSocketMessage) {
  if (isCaptureRequested && raw.Event && (captureTargetEvents.includes(raw.Event) || captureTargetEvents.includes('*'))) {
    isCaptureRequested = false;
    emitTo('configurator', 'packet-captured', {
      event: raw.Event,
      packet: JSON.stringify(raw, null, 2)
    });
  }

  switch (raw.Event) {
    case 'GoalScored': {
      hasReceivedDataSinceConnected = true;
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
      hasReceivedDataSinceConnected = true;
      if (isAutoSceneControl) {
        enterReplayView();
      }
      break;
    }

    case 'GoalReplayWillEnd': {
      if (isAutoSceneControl) {
        willEndReplayView();
      }
      break;
    }

    case 'GoalReplayEnd': {
      hasReceivedDataSinceConnected = true;
      if (isAutoSceneControl) {
        immediateEndReplayView();
      }
      break;
    }

    case 'MatchEnded':
    case 'MatchDestroyed': {
      if (isAutoSceneControl) {
        immediateEndReplayView();
        switchSceneMode('empty', true);
      }
      break;
    }

    case 'CountdownBegin':
    case 'RoundStarted': {
      hasReceivedDataSinceConnected = true;
      if (isAutoSceneControl && currentActiveScene === 'replay-viewer') {
        immediateEndReplayView();
      }
      if (!raw.Data) return;
      let data: RLStateData;
      try {
        data = typeof raw.Data === 'string' ? JSON.parse(raw.Data) : raw.Data;
      } catch {
        return;
      }
      if (!isSimulating) {
        processUpdateState(data);
      }
      break;
    }

    case 'MatchCreated':
    case 'MatchInitialized':
    case 'UpdateState': {
      hasReceivedDataSinceConnected = true;
      if (!raw.Data) return;
      let data: RLStateData;
      try {
        data = typeof raw.Data === 'string' ? JSON.parse(raw.Data) : raw.Data;
      } catch {
        return;
      }

      if (!isSimulating) {
        processUpdateState(data);
      }
      break;
    }

    default:
      break;
  }
}

function connectWebSocket() {
  if (isManualDisconnected) {
    wsStatus = 'disconnected';
    notifyWsStatus();
    evaluateAutoScene();
    return;
  }

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
      hasReceivedDataSinceConnected = false;
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
      hasReceivedDataSinceConnected = false;
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
    hasReceivedDataSinceConnected = false;
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

function disconnectWebSocket() {
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
  hasReceivedDataSinceConnected = false;
  notifyWsStatus();
  evaluateAutoScene();
}

connectWebSocket();

// --- 🎮 3. 真实样本与高拟真动态模拟器 ---
const REAL_SAMPLE_RAW: RLStateData = {
  MatchGuid: '852D9D5546F30BE5E44F6C88F7ED98EA',
  Players: [
    { Name: 'steamuser', Shortcut: 5, TeamNum: 1, bHasCar: true, Speed: 82.7996, Boost: 11, bSupersonic: true },
    { Name: 'Fury', Shortcut: 1, TeamNum: 0, bHasCar: true, Speed: 40.0, Boost: 50 },
    { Name: 'Sticks', Shortcut: 6, TeamNum: 1, bOnGround: true, bHasCar: true, Speed: 82.7997, Boost: 15, bBoosting: true, bSupersonic: true },
    { Name: 'Stinger', Shortcut: 2, TeamNum: 0, bHasCar: true, Speed: 55.0, Boost: 33 },
    { Name: 'Khan', Shortcut: 7, TeamNum: 1, bOnGround: true, bHasCar: true, Speed: 26.1496, Boost: 100 },
    { Name: 'Outlaw', Shortcut: 3, TeamNum: 0, bHasCar: true, Speed: 30.0, Boost: 45 }
  ],
  Game: {
    Teams: [
      { Name: 'Rovers', TeamNum: 0, Score: 0, ColorPrimary: '1873FF', ColorSecondary: 'E5E5E5' },
      { Name: '1', TeamNum: 1, Score: 1, ColorPrimary: 'C26418', ColorSecondary: 'E5E5E5' }
    ],
    PlaylistId: 24,
    TimeSeconds: 270,
    bOvertime: false,
    Ball: { Speed: 43.92, TeamNum: 0 },
    bReplay: false,
    bHasWinner: false,
    Winner: '',
    Arena: 'NeoTokyo_Arcade_P',
    bHasTarget: true,
    Target: { Name: 'steamuser', Shortcut: 5, TeamNum: 1 }
  }
};

const mockSimState = {
  timeRaw: 270.0,
  ballSpeed: 43.0,
  ballSpeedDir: 1,
  ballTeamToggleTimer: 0,
  scoreTimer: 0,

  p1Boost: { val: 8.0, step: 0.45, dir: 1 },
  p2Boost: { val: 18.0, step: 0.75, dir: -1 },
  p3Boost: { val: 85.0, step: 0.55, dir: -1 },

  p1Speed: { val: 82.0, step: 0.6, dir: 1, max: 100 },
  p2Speed: { val: 55.0, step: 0.9, dir: -1, max: 100 },
  p3Speed: { val: 26.0, step: 0.4, dir: 1, max: 100 },

  frameCount: 0
};

function initMockData() {
  processUpdateState(REAL_SAMPLE_RAW);
}

function updateMockStream() {
  mockSimState.frameCount++;

  // 1. 倒计时模拟
  mockSimState.timeRaw -= (1 / 120);
  if (mockSimState.timeRaw <= 0) {
    mockSimState.timeRaw = 300;
    latestData.bOvertime = !latestData.bOvertime;
  }
  latestData.timeSeconds = Math.floor(mockSimState.timeRaw);

  // 2. 球速与球最近击球队伍模拟
  mockSimState.ballSpeed += 0.3 * mockSimState.ballSpeedDir;
  if (mockSimState.ballSpeed >= 120) mockSimState.ballSpeedDir = -1;
  if (mockSimState.ballSpeed <= 10) mockSimState.ballSpeedDir = 1;
  latestData.ballSpeed = Math.floor(mockSimState.ballSpeed);

  mockSimState.ballTeamToggleTimer++;
  if (mockSimState.ballTeamToggleTimer > 240) {
    mockSimState.ballTeamToggleTimer = 0;
    latestData.ballTeamNum = latestData.ballTeamNum === 0 ? 1 : 0;
  }

  // 3. P1 Boost
  mockSimState.p1Boost.val += mockSimState.p1Boost.step * mockSimState.p1Boost.dir;
  if (mockSimState.p1Boost.val >= 100) { mockSimState.p1Boost.val = 100; mockSimState.p1Boost.dir = -1; }
  if (mockSimState.p1Boost.val <= 0) { mockSimState.p1Boost.val = 0; mockSimState.p1Boost.dir = 1; }
  latestData.p1Boost = Math.round(mockSimState.p1Boost.val);
  latestData.p1Boosting = mockSimState.p1Boost.dir < 0;
  latestData.p1HasCar = true;

  // 4. P2 Boost
  mockSimState.p2Boost.val += mockSimState.p2Boost.step * mockSimState.p2Boost.dir;
  if (mockSimState.p2Boost.val >= 100) { mockSimState.p2Boost.val = 100; mockSimState.p2Boost.dir = -1; }
  if (mockSimState.p2Boost.val <= 0) { mockSimState.p2Boost.val = 0; mockSimState.p2Boost.dir = 1; }
  latestData.p2Boost = Math.round(mockSimState.p2Boost.val);
  latestData.p2Boosting = mockSimState.p2Boost.dir < 0;
  latestData.p2HasCar = true;

  // 5. P3 Boost
  mockSimState.p3Boost.val += mockSimState.p3Boost.step * mockSimState.p3Boost.dir;
  if (mockSimState.p3Boost.val >= 100) { mockSimState.p3Boost.val = 100; mockSimState.p3Boost.dir = -1; }
  if (mockSimState.p3Boost.val <= 0) { mockSimState.p3Boost.val = 0; mockSimState.p3Boost.dir = 1; }
  latestData.p3Boost = Math.round(mockSimState.p3Boost.val);
  latestData.p3Boosting = mockSimState.p3Boost.dir < 0;
  latestData.p3HasCar = true;

  // 6. 速度模拟
  mockSimState.p1Speed.val += mockSimState.p1Speed.step * mockSimState.p1Speed.dir;
  if (mockSimState.p1Speed.val >= 95) mockSimState.p1Speed.dir = -1;
  if (mockSimState.p1Speed.val <= 10) mockSimState.p1Speed.dir = 1;
  latestData.p1Speed = Math.floor(mockSimState.p1Speed.val);
  latestData.p1Supersonic = latestData.p1Speed > 80;

  mockSimState.p2Speed.val += mockSimState.p2Speed.step * mockSimState.p2Speed.dir;
  if (mockSimState.p2Speed.val >= 90) mockSimState.p2Speed.dir = -1;
  if (mockSimState.p2Speed.val <= 5) mockSimState.p2Speed.dir = 1;
  latestData.p2Speed = Math.floor(mockSimState.p2Speed.val);
  latestData.p2Supersonic = latestData.p2Speed > 80;

  mockSimState.p3Speed.val += mockSimState.p3Speed.step * mockSimState.p3Speed.dir;
  if (mockSimState.p3Speed.val >= 85) mockSimState.p3Speed.dir = -1;
  if (mockSimState.p3Speed.val <= 0) mockSimState.p3Speed.dir = 1;
  latestData.p3Speed = Math.floor(mockSimState.p3Speed.val);
  latestData.p3Supersonic = latestData.p3Speed > 80;

  // 7. 比分微调模拟
  mockSimState.scoreTimer++;
  if (mockSimState.scoreTimer > 1200) { // 每 10 秒可能变动比分
    mockSimState.scoreTimer = 0;
    if (Math.random() > 0.5) {
      latestData.myScore += 1;
    } else {
      latestData.oppScore += 1;
    }
    latestData.scoreDiff = latestData.myScore - latestData.oppScore;
  }

  // 8. 布尔微调
  if (mockSimState.frameCount % 60 === 0) {
    latestData.p1OnGround = Math.random() > 0.3;
    latestData.p1OnWall = !latestData.p1OnGround && Math.random() > 0.5;
    latestData.p1Powersliding = Math.random() > 0.7;

    latestData.p2OnGround = Math.random() > 0.4;
    latestData.p2OnWall = !latestData.p2OnGround && Math.random() > 0.6;
    latestData.p2Powersliding = Math.random() > 0.8;

    latestData.p3OnGround = Math.random() > 0.2;
    latestData.p3OnWall = !latestData.p3OnGround && Math.random() > 0.7;
    latestData.p3Powersliding = Math.random() > 0.85;
  }
}

// --- 🖼️ 场景图层与 Competitive 独立组件管理器 ---
function renderCompetitiveScene(instances: ComponentInstance[]) {
  const root = document.getElementById('competitive-root');
  if (!root) return;

  root.innerHTML = '';
  const screenH = getScreenHeightVw();

  instances.forEach((inst, index) => {
    const container = document.createElement('div');
    container.className = 'comp-container';
    container.setAttribute('data-instance-id', inst.instanceId);

    const globalSettings = loadGlobalLayoutSettings();
    const effectiveOpacity = inst.followGlobal !== false ? globalSettings.opacity : inst.opacity;
    const { leftVw, topVw } = calculateElementTopLeft(inst, screenH);
    container.style.left = `${leftVw}vw`;
    container.style.top = `${topVw}vw`;
    container.style.width = `${inst.widthVw}vw`;
    container.style.height = `${inst.heightVw}vw`;
    container.style.opacity = effectiveOpacity.toString();
    container.style.zIndex = (index + 1).toString();

    const meta = COMPONENT_METAS[inst.componentType];
    const isProportional = meta ? meta.isProportional : false;
    container.innerHTML = `
      <div class=\"comp-inner ${isProportional ? 'comp-proportional' : 'comp-flexible'}\">
        ${createComponentInnerHtml(inst)}
      </div>
    `;

    // 点击组件选中并附着 8 点位 Dragger
    container.addEventListener('pointerdown', (e) => {
      if (!isLayoutEditing) return;
      e.stopPropagation();
      dragger?.selectInstance(inst.instanceId);
    });

    root.appendChild(container);

    if (dragger && isProportional) {
      dragger.updateProportionalScale(container, inst);
    }
  });

  if (dragger) {
    dragger.setInstances(instances);
  }
}

// 🌟 静态导入所有 Scene 和 Reference HTML 模板 (Vite ?raw 编译期内联打包)
const sceneHtmlModules = import.meta.glob('../scenes/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true
});

const refHtmlModules = import.meta.glob('../references/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true
});

function getSceneHtml(filePath: string): string {
  if (!filePath) return '';
  const fileName = filePath.split('/').pop() || '';
  const key = `../scenes/${fileName}`;
  const raw = sceneHtmlModules[key];
  if (!raw) return '';
  return typeof raw === 'string' ? raw : (raw && typeof (raw as any).default === 'string' ? (raw as any).default : String(raw || ''));
}

function getReferenceHtml(filePath: string): string {
  if (!filePath) return '';
  const fileName = filePath.split('/').pop() || '';
  const key = `../references/${fileName}`;
  const raw = refHtmlModules[key];
  if (!raw) return '';
  return typeof raw === 'string' ? raw : (raw && typeof (raw as any).default === 'string' ? (raw as any).default : String(raw || ''));
}

async function loadLayers() {
  try {
    for (const item of manifest.references) {
      const layer = document.createElement('div');
      layer.style.position = 'absolute';
      layer.style.top = '0';
      layer.style.left = '0';
      layer.style.display = 'none';
      if (item.file) {
        layer.innerHTML = getReferenceHtml(item.file);
      }
      refCanvas.appendChild(layer);
      spawnedRefs.set(item.id, layer);
    }

    for (const item of manifest.scenes) {
      const layer = document.createElement('div');
      layer.style.position = 'absolute';
      layer.style.top = '0';
      layer.style.left = '0';
      layer.style.width = '100%';
      layer.style.height = '100%';
      layer.style.display = 'none';
      if (item.file) {
        layer.innerHTML = getSceneHtml(item.file);
      }
      sceneCanvas.appendChild(layer);
      spawnedScenes.set(item.id, layer);
    }

    cacheDevDashboardNodes();
    initMockData();
    updateReplayViewerDOM();
    updateReplaySvgBorder();

    // 初始化 Competitive 独立组件系统
    competitiveInstances = loadCompetitiveLayout();
    const compScene = spawnedScenes.get('competitive');
    if (compScene) {
      dragger = new DraggerController(compScene);
      dragger.onLayoutChange((updatedLayout) => {
        competitiveInstances = updatedLayout;
        saveCompetitiveLayout(updatedLayout);
        emitTo('configurator', 'layout-updated-from-overlay', { layout: updatedLayout });
      });
      dragger.onSelect((instanceId) => {
        emitTo('configurator', 'component-selected-from-overlay', { instanceId });
      });
      renderCompetitiveScene(competitiveInstances);
    }
  } catch (err) {
    console.error('Error during loadLayers in overlay:', err);
  }
}

function switchRefMode(target: string) {
  spawnedRefs.forEach((layer, id) => {
    layer.style.display = id === target ? 'block' : 'none';
  });
  updateDimensions();
}

function switchSceneMode(target: string, notifyConfigurator: boolean = false) {
  currentActiveScene = target;
  spawnedScenes.forEach((layer, id) => {
    // 兼容 developer-dashboard 与 live-replay
    const isTarget = (id === target) || (target === 'developer-dashboard' && id === 'live-replay') || (target === 'live-replay' && id === 'developer-dashboard');
    layer.style.display = isTarget ? 'block' : 'none';
  });
  isDevDashboardVisible = (target === 'developer-dashboard' || target === 'live-replay');
  isCompetitiveVisible = (target === 'competitive');

  if (target !== 'competitive') {
    if (isLayoutEditing) {
      isLayoutEditing = false;
      document.body.classList.remove('layout-editing');
      dragger?.selectInstance(null);
      void setOverlayClickThrough(true);
    }
  }

  if (target === 'replay-viewer') {
    updateReplayViewerDOM();
    updateReplaySvgBorder();
  }

  if (isCompetitiveVisible) {
    renderCompetitiveScene(competitiveInstances);
  }

  if (notifyConfigurator) {
    emitTo('configurator', 'scene-auto-switched', { scene: target });
  }
}

function updateDimensions() {
  const scale = window.devicePixelRatio;
  const lWidth = window.innerWidth;
  const lHeight = window.innerHeight;
  spawnedRefs.forEach((layer, id) => {
    if (layer.style.display !== 'none') {
      if (id === '1080p') { layer.style.width = `${1920 / scale}px`; layer.style.height = `${1080 / scale}px`; }
      else if (id === '1440p') { layer.style.width = `${2560 / scale}px`; layer.style.height = `${1440 / scale}px`; }
      else if (id === '1600p') { layer.style.width = `${2560 / scale}px`; layer.style.height = `${1600 / scale}px`; }
    }
  });

  updateReplaySvgBorder();

  if (isCompetitiveVisible && dragger) {
    renderCompetitiveScene(competitiveInstances);
  }

  emitTo('configurator', 'overlay-metrics', [Math.round(lWidth * scale), Math.round(lHeight * scale), scale, lWidth, lHeight]);
}

async function bootstrap() {
  initComponentCatalog();
  await loadLayers();

  await listen<{ mode: string }>('change-ref-layer', (e) => switchRefMode(e.payload.mode));
  await listen<{ scene: string }>('change-scene-layer', (e) => switchSceneMode(e.payload.scene));
  await listen<{ opacity: number }>('change-ref-opacity', (e) => {
    refCanvas.style.opacity = e.payload.opacity.toString();
  });

  // Automatic Scene Control 监听
  await listen<{ enabled: boolean }>('toggle-auto-scene-control', (e) => {
    isAutoSceneControl = e.payload.enabled;
    if (isAutoSceneControl) {
      evaluateAutoScene();
    }
  });

  // Canvas 背景颜色控制监听
  await listen<{ color: string; mode: string }>('change-overlay-bg', (e) => {
    document.body.style.backgroundColor = e.payload.color;
  });

  // 模拟流开关
  await listen<{ enabled: boolean }>('toggle-mock-simulation', (e) => {
    isSimulating = e.payload.enabled;
    if (isSimulating) {
      initMockData();
      if (isAutoSceneControl) {
        switchSceneMode('competitive', true);
      }
    }
  });

  // 字体大小调节 (Developer Dashboard)
  await listen<{ size: number }>('change-font-scale', (e) => {
    document.documentElement.style.setProperty('--replay-font-scale', `${e.payload.size}vw`);
  });

  // 进度条尺寸调节 (Developer Dashboard)
  await listen<{ width: number; height: number }>('change-bar-dimensions', (e) => {
    document.documentElement.style.setProperty('--bar-width', `${e.payload.width}vw`);
    document.documentElement.style.setProperty('--bar-height', `${e.payload.height}vw`);
  });

  // 闪烁频率调节
  await listen<{ duration: number }>('change-blink-freq', (e) => {
    document.documentElement.style.setProperty('--boost-blink-duration', `${e.payload.duration}s`);
  });

  // 🌟 Replay 动画与过渡时长调节 (默认 0.75s)
  await listen<{ duration: number }>('change-replay-transition-time', (e) => {
    replayTransitionDuration = e.payload.duration;
    document.documentElement.style.setProperty('--replay-transition-duration', `${replayTransitionDuration}s`);
    document.documentElement.style.setProperty('--replay-exit-duration', `${Math.max(0.1, replayTransitionDuration * 0.85).toFixed(2)}s`);
  });

  // 🌟 手动切换 Replay Footer 上下进出动画 (测试按钮)
  await listen('toggle-replay-footer', () => {
    if (currentActiveScene !== 'replay-viewer') {
      enterReplayView();
      return;
    }
    const footer = document.getElementById('replayFooter') || document.querySelector('.rl-footer');
    if (footer) {
      if (footer.classList.contains('rl-footer-visible') && !footer.classList.contains('rl-footer-hiding')) {
        willEndReplayView();
      } else {
        enterReplayView();
      }
    } else {
      enterReplayView();
    }
  });

  // 🌟 模拟完整进球与回放生命周期 (测试按钮)
  await listen('simulate-replay-lifecycle', () => {
    processGoalScored({
      Scorer: { Name: 'Test Striker', Shortcut: 1, TeamNum: 0 },
      GoalSpeed: 112.5,
      Assister: Math.random() > 0.3 ? { Name: 'Playmaker', Shortcut: 2, TeamNum: 0 } : null
    });
    enterReplayView();

    setTimeout(() => {
      willEndReplayView();
      setTimeout(() => {
        immediateEndReplayView();
      }, Math.round(replayTransitionDuration * 1000) + 100);
    }, 3000);
  });

  // 🌟 Competitive 场景布局编辑模式切换
  await listen<{ enabled: boolean }>('toggle-layout-editing', async (e) => {
    isLayoutEditing = e.payload.enabled;
    if (isLayoutEditing) {
      document.body.classList.add('layout-editing');
      await setOverlayClickThrough(false);
    } else {
      document.body.classList.remove('layout-editing');
      dragger?.selectInstance(null);
      await setOverlayClickThrough(true);
    }
  });

  // 🌟 Global Layout Settings 监听 (来自 Configurator)
  await listen<{ settings: GlobalLayoutSettings }>('update-global-settings', (e) => {
    saveGlobalLayoutSettings(e.payload.settings);
    renderCompetitiveScene(competitiveInstances);
  });

  // 🌟 Competitive 场景布局更新 (来自 Configurator)
  await listen<{ layout: ComponentInstance[] }>('update-competitive-layout', (e) => {
    competitiveInstances = e.payload.layout;
    saveCompetitiveLayout(competitiveInstances);
    renderCompetitiveScene(competitiveInstances);
  });

  // 🌟 选中组件 (来自 Configurator)
  await listen<{ instanceId: string | null }>('select-competitive-component', (e) => {
    dragger?.selectInstance(e.payload.instanceId);
  });

  // 🌟 高亮 Hover 组件 (来自 Configurator)
  await listen<{ instanceId: string | null }>('hover-competitive-component', (e) => {
    const compRoot = document.getElementById('competitive-root');
    if (!compRoot) return;
    compRoot.querySelectorAll('.comp-container').forEach((el) => {
      if (el.getAttribute('data-instance-id') === e.payload.instanceId) {
        el.classList.add('hovered');
      } else {
        el.classList.remove('hovered');
      }
    });
  });

  // 🌟 WebSocket 配置与控制监听
  await listen<{ host: string; port: string }>('ws-set-config', (e) => {
    wsHost = e.payload.host;
    wsPort = e.payload.port;
    if (!isManualDisconnected) {
      if (ws) {
        ws.close();
      } else {
        connectWebSocket();
      }
    }
  });

  await listen('ws-connect', () => {
    isManualDisconnected = false;
    connectWebSocket();
  });

  await listen('ws-disconnect', () => {
    disconnectWebSocket();
  });

  await listen('query-ws-status', () => {
    notifyWsStatus();
  });

  await listen<{ events?: string[] }>('capture-next-packet', (e) => {
    isCaptureRequested = true;
    if (e.payload?.events && e.payload.events.length > 0) {
      captureTargetEvents = e.payload.events;
    }
  });

  await listen<{ events: string[] }>('set-capture-target-events', (e) => {
    if (e.payload?.events) {
      captureTargetEvents = e.payload.events;
    }
  });

  await listen<{ disabled: boolean }>('toggle-ws-auto-retry', (e) => {
    isAutoRetryDisabled = e.payload.disabled;
    if (isAutoRetryDisabled && retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  });

  window.addEventListener('resize', updateDimensions);
  switchRefMode(localStorage.getItem('saved_ref_mode') || 'empty');
  
  // 默认启动状态
  if (isAutoSceneControl) {
    evaluateAutoScene();
  } else {
    switchSceneMode(localStorage.getItem('saved_scene_mode') || 'developer-dashboard');
  }

  notifyWsStatus();
}

bootstrap();

(window as any).__OVERLAY_ENTRY__ = true;
console.log("Overlay system logic injection successful.");