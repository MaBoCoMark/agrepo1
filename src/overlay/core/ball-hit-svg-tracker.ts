import { STANDARD_BOOST_LOCATIONS } from './pitch-geometry';

/**
 * ============================================================================
 * 🏟️ Ball Hit SVG & Pitch MiniMap Engine (GPU-Accelerated Component Widget)
 * ============================================================================
 */

export interface BallHitSvgConfig {
  // Pitch Boundary
  borderStrokeWidth: number; // SVG units (default 75)
  borderColor: string;
  borderOpacity: number; // 0.0 - 1.0
  bgFillColor: string;
  bgFillOpacity: number; // 0.0 - 1.0
  pitchLineColor: string;
  pitchLineOpacity: number;

  // Boost Resources
  padRadius: number; // SVG units (default 90)
  padColor: string;
  padOpacity: number;
  pillRadiusScale: number; // 1.0 - 10.0 (100% to 1000% of small pad radius, default 2.8)
  pillColor: string;
  pillOpacity: number;

  // Ball Hit Indicator Center Dot
  dotRadius: number; // px (default 5)
  myTeamDotColor: string;
  myTeamDotOpacity: number;
  oppTeamDotColor: string;
  oppTeamDotOpacity: number;

  // Outer Speed Ring
  ringMaxPercent: number; // 1 - 100% of pitch short side (default 100)
  ringBorderColor: string;
  ringBorderWidth: number; // px (default 2)
  ringBorderOpacity: number; // 0.0 - 1.0
  ringFillColor: string;
  ringFillOpacity: number; // 0.0 - 1.0
  ringPreviewActive: boolean;
  ringPreviewSpeed: number; // 0 - 110 KPH

  // Animation Controls
  animHoldDuration: number; // default 0.5s
  animFadeDuration: number; // default 1.0s
  animEasingType: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'custom';
  animCustomEasing: string; // e.g. cubic-bezier(0.4, 0, 0.2, 1)

  // Minimap Container Layout & Transform
  leftVw: number;
  topVw: number;
  widthVw: number;
  heightVw: number;
  followAspectRatio: boolean;
}

export const DEFAULT_BALL_HIT_SVG_CONFIG: BallHitSvgConfig = {
  borderStrokeWidth: 75,
  borderColor: '#00f0ff',
  borderOpacity: 0.85,
  bgFillColor: '#0a0f19',
  bgFillOpacity: 0.7,
  pitchLineColor: '#ffffff',
  pitchLineOpacity: 0.22,

  padRadius: 90,
  padColor: '#fbbf24',
  padOpacity: 0.8,
  pillRadiusScale: 2.8,
  pillColor: '#f59e0b',
  pillOpacity: 0.9,

  dotRadius: 5,
  myTeamDotColor: '#00ff88',
  myTeamDotOpacity: 1.0,
  oppTeamDotColor: '#ff3366',
  oppTeamDotOpacity: 1.0,

  ringMaxPercent: 100,
  ringBorderColor: '#00f0ff',
  ringBorderWidth: 2,
  ringBorderOpacity: 0.8,
  ringFillColor: '#00f0ff',
  ringFillOpacity: 0.15,
  ringPreviewActive: false,
  ringPreviewSpeed: 110,

  animHoldDuration: 0.5,
  animFadeDuration: 1.0,
  animEasingType: 'ease-out',
  animCustomEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',

  leftVw: 38,
  topVw: 18,
  widthVw: 24,
  heightVw: 32, // 24 / 0.75
  followAspectRatio: true
};

const STORAGE_KEY = 'saved_ball_hit_svg_config';

export function loadSavedBallHitSvgConfig(): BallHitSvgConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_BALL_HIT_SVG_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_BALL_HIT_SVG_CONFIG };
}

export function saveBallHitSvgConfig(cfg: BallHitSvgConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

// Runtime State
let currentConfig: BallHitSvgConfig = loadSavedBallHitSvgConfig();
let currentTargetTeam = 0; // 0: Blue, 1: Orange (flips 180°)
let currentAnim: Animation | null = null;
let isInitialized = false;

// Dragger State
let isSelected = false;
let isDragging = false;
let dragMode: 'move' | 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | null = null;
let startPointerX = 0;
let startPointerY = 0;
let startLeftVw = 0;
let startTopVw = 0;
let startWidthVw = 0;
let startHeightVw = 0;

/**
 * Updates runtime config and refreshes SVG DOM styles
 */
export function updateBallHitSvgConfig(newCfg: Partial<BallHitSvgConfig>): void {
  currentConfig = { ...currentConfig, ...newCfg };
  saveBallHitSvgConfig(currentConfig);
  applyBallHitSvgStyles();
  if (currentConfig.ringPreviewActive) {
    simulateBallHitSvg(0, 0, currentConfig.ringPreviewSpeed, true);
  }
}

export function getBallHitSvgConfig(): BallHitSvgConfig {
  return currentConfig;
}

/**
 * Sets target team (0 or 1) and flips minimap 180° if Team 1
 */
export function setBallHitSvgTargetTeam(team: number): void {
  if (currentTargetTeam !== team) {
    currentTargetTeam = team;
    applyTeamOrientation();
  }
}

function applyTeamOrientation(): void {
  const stage = document.getElementById('mini-map-stage');
  if (!stage) return;
  if (currentTargetTeam === 1) {
    stage.style.transform = 'rotate(180deg)';
  } else {
    stage.style.transform = 'none';
  }
}

/**
 * Builds SVG boost circles inside #pitch-boosts-layer
 */
export function renderSvgBoostPads(): void {
  const boostLayer = document.getElementById('pitch-boosts-layer');
  if (!boostLayer) return;

  const padR = currentConfig.padRadius;
  const pillR = padR * currentConfig.pillRadiusScale;

  boostLayer.innerHTML = STANDARD_BOOST_LOCATIONS.map((bp, idx) => {
    const isPill = bp.boostType === 'BoostType_Pill';
    const r = isPill ? pillR : padR;
    const cls = isPill ? 'boost-pill' : 'boost-pad';
    const fill = isPill ? currentConfig.pillColor : currentConfig.padColor;
    const op = isPill ? currentConfig.pillOpacity : currentConfig.padOpacity;

    return `<circle id="boost-item-${idx}" cx="${bp.x}" cy="${-bp.y}" r="${r}" class="${cls}" fill="${fill}" opacity="${op}" />`;
  }).join('');
}

/**
 * Applies all configuration styles to the Mini Map SVG and DOM layer
 */
export function applyBallHitSvgStyles(): void {
  const container = document.getElementById('mini-map-container');
  if (container) {
    container.style.left = `${currentConfig.leftVw}vw`;
    container.style.top = `${currentConfig.topVw}vw`;
    container.style.width = `${currentConfig.widthVw}vw`;
    container.style.height = `${currentConfig.heightVw}vw`;
  }

  // Pitch boundary polygon
  const poly = document.getElementById('pitch-boundary-polygon') as SVGPolygonElement | null;
  if (poly) {
    poly.style.stroke = currentConfig.borderColor;
    poly.style.strokeWidth = `${currentConfig.borderStrokeWidth}`;
    poly.style.strokeOpacity = currentConfig.borderOpacity.toString();
    poly.style.fill = 'none';
  }

  // Pitch background field
  const bg = document.getElementById('pitch-field-bg') as SVGPolygonElement | null;
  if (bg) {
    bg.style.fill = currentConfig.bgFillColor;
    bg.style.fillOpacity = currentConfig.bgFillOpacity.toString();
  }

  // Markings
  const cl = document.getElementById('pitch-centerline') as SVGLineElement | null;
  const ml = document.getElementById('pitch-midline') as SVGLineElement | null;
  const cc = document.getElementById('pitch-center-circle') as SVGCircleElement | null;

  [cl, ml, cc].forEach((el) => {
    if (el) {
      el.style.stroke = currentConfig.pitchLineColor;
      el.style.strokeOpacity = currentConfig.pitchLineOpacity.toString();
    }
  });

  // Re-render Boost pads with configured radii and colors
  renderSvgBoostPads();
  applyTeamOrientation();
}

/**
 * Resolves CSS easing curve
 */
function resolveEasingString(type: string, customBezier: string): string {
  switch (type) {
    case 'linear':
      return 'linear';
    case 'ease-in':
      return 'ease-in';
    case 'ease-out':
      return 'ease-out';
    case 'ease-in-out':
      return 'ease-in-out';
    case 'custom':
      return customBezier || 'cubic-bezier(0.4, 0, 0.2, 1)';
    default:
      return 'ease-out';
  }
}

/**
 * Triggers GPU-accelerated Ball Hit Indicator Animation (0 Reflow, Instant Interruption)
 */
export function triggerBallHitIndicator(
  worldX: number,
  worldY: number,
  speedKph: number,
  isMyTeam: boolean
): void {
  const container = document.getElementById('mini-map-container');
  const indicator = document.getElementById('mini-map-hit-indicator');
  const dot = document.getElementById('hit-center-dot');
  const ring = document.getElementById('hit-outer-ring');

  if (!container || !indicator || !dot || !ring) return;

  // 1. Instantly cancel any ongoing animation and reset state
  if (currentAnim) {
    currentAnim.cancel();
    currentAnim = null;
  }

  // 2. Compute Pitch Percentage Coordinates
  // Pitch is X: [-4500, 4500], Y: [-6000, 6000]
  // SVG / Canvas: Left = -4500 (0%), Top = +6000 (0%), Bottom = -6000 (100%)
  const clampedX = Math.max(-4500, Math.min(4500, worldX));
  const clampedY = Math.max(-6000, Math.min(6000, worldY));

  const normX = (clampedX - (-4500)) / 9000;
  const normY = (6000 - clampedY) / 12000;

  const containerW = container.clientWidth || 240;
  const containerH = container.clientHeight || 320;

  const pixelX = normX * containerW;
  const pixelY = normY * containerH;

  // 3. Position Indicator with GPU transform
  indicator.style.display = 'flex';
  indicator.style.transform = `translate3d(${pixelX}px, ${pixelY}px, 0) translate(-50%, -50%)`;

  // 4. Center Dot Styles (Unified radius, separated colors & opacities)
  const dotColor = isMyTeam ? currentConfig.myTeamDotColor : currentConfig.oppTeamDotColor;
  const dotOpacity = isMyTeam ? currentConfig.myTeamDotOpacity : currentConfig.oppTeamDotOpacity;
  const dotD = currentConfig.dotRadius * 2;

  dot.style.width = `${dotD}px`;
  dot.style.height = `${dotD}px`;
  dot.style.backgroundColor = dotColor;
  dot.style.boxShadow = `0 0 8px ${dotColor}`;

  // 5. Outer Speed Ring
  // Diameter based on postHitSpeed relative to 100% of pitch short side (container width)
  const speed = currentConfig.ringPreviewActive ? currentConfig.ringPreviewSpeed : speedKph;
  const speedFraction = Math.max(0, Math.min(1.0, speed / 110));
  const maxRingDiameter = containerW * (currentConfig.ringMaxPercent / 100);
  const ringDiameter = Math.max(0, maxRingDiameter * speedFraction);

  ring.style.width = `${ringDiameter}px`;
  ring.style.height = `${ringDiameter}px`;
  ring.style.border = `${currentConfig.ringBorderWidth}px solid ${currentConfig.ringBorderColor}`;
  ring.style.borderColor = currentConfig.ringBorderColor;
  ring.style.opacity = currentConfig.ringBorderOpacity.toString();
  ring.style.backgroundColor = currentConfig.ringFillColor;
  ring.style.borderRadius = '50%';

  // Set initial opacity before animation
  indicator.style.opacity = dotOpacity.toString();

  // 6. Web Animations API Execution (Composited on GPU thread)
  const holdSec = Math.max(0, currentConfig.animHoldDuration);
  const fadeSec = Math.max(0.01, currentConfig.animFadeDuration);
  const totalSec = holdSec + fadeSec;
  const totalMs = totalSec * 1000;
  const holdFraction = totalSec > 0 ? holdSec / totalSec : 0;

  const easingCurve = resolveEasingString(currentConfig.animEasingType, currentConfig.animCustomEasing);

  const keyframes = [
    { opacity: dotOpacity, offset: 0 },
    { opacity: dotOpacity, offset: holdFraction, easing: easingCurve },
    { opacity: 0, offset: 1.0 }
  ];

  try {
    currentAnim = indicator.animate(keyframes, {
      duration: totalMs,
      fill: 'forwards'
    });

    currentAnim.onfinish = () => {
      indicator.style.opacity = '0';
      indicator.style.display = 'none';
      currentAnim = null;
    };
  } catch (err) {
    // Fallback if WAAPI has edge case
    indicator.style.opacity = dotOpacity.toString();
    setTimeout(() => {
      indicator.style.transition = `opacity ${fadeSec}s ${easingCurve}`;
      indicator.style.opacity = '0';
    }, holdSec * 1000);
  }
}

/**
 * Directly processes incoming WebSocket BallHit packet without blocking
 */
export function processBallHitSvgPacket(packet: any): void {
  if (!packet) return;

  let hitX = 0;
  let hitY = 0;
  let speed = 60;
  let teamNum: number | undefined;

  const d = packet.Data || packet;
  if (d.Location) {
    hitX = Number(d.Location.X ?? d.Location.x ?? 0);
    hitY = Number(d.Location.Y ?? d.Location.y ?? 0);
  } else if (d.Ball?.Location) {
    hitX = Number(d.Ball.Location.X ?? d.Ball.Location.x ?? 0);
    hitY = Number(d.Ball.Location.Y ?? d.Ball.Location.y ?? 0);
  }

  if (d.Ball?.Speed !== undefined) {
    const rawSpd = Number(d.Ball.Speed);
    speed = rawSpd > 150 ? rawSpd * 0.036 : rawSpd;
  } else if (d.postHitSpeed !== undefined) {
    const rawSpd = Number(d.postHitSpeed);
    speed = rawSpd > 150 ? rawSpd * 0.036 : rawSpd;
  }

  if (d.Player?.TeamNum !== undefined) {
    teamNum = Number(d.Player.TeamNum);
  } else if (d.TeamNum !== undefined) {
    teamNum = Number(d.TeamNum);
  }

  const isMyTeam = teamNum === undefined || teamNum === currentTargetTeam;
  triggerBallHitIndicator(hitX, hitY, speed, isMyTeam);
}

/**
 * Simulates a ball hit at given coordinates or center for previewing animation
 */
export function simulateBallHitSvg(
  x: number = 0,
  y: number = 0,
  speedKph: number = 85,
  isMyTeam: boolean = true
): void {
  triggerBallHitIndicator(x, y, speedKph, isMyTeam);
}

/**
 * Initializes the Mini Map Container Interactive 8-Point Dragger & Resizer
 */
export function initBallHitSvgScene(): void {
  if (isInitialized) {
    applyBallHitSvgStyles();
    return;
  }
  isInitialized = true;

  applyBallHitSvgStyles();

  const container = document.getElementById('mini-map-container');
  const dragger = document.getElementById('mini-map-dragger');

  if (!container || !dragger) return;

  function updateDraggerUI() {
    if (isSelected) {
      container?.classList.add('selected');
      if (dragger) dragger.style.display = 'block';
    } else {
      container?.classList.remove('selected');
      if (dragger) dragger.style.display = 'none';
    }
  }

  container.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    const handleEl = target.closest('[data-handle]') as HTMLElement | null;

    isSelected = true;
    updateDraggerUI();

    e.stopPropagation();

    const handle = handleEl ? (handleEl.getAttribute('data-handle') as any) : 'move';
    isDragging = true;
    dragMode = handle;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startLeftVw = currentConfig.leftVw;
    startTopVw = currentConfig.topVw;
    startWidthVw = currentConfig.widthVw;
    startHeightVw = currentConfig.heightVw;
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging || !dragMode || !container) return;

    const vwPx = window.innerWidth / 100;
    const deltaXvw = (e.clientX - startPointerX) / vwPx;
    const deltaYvw = (e.clientY - startPointerY) / vwPx;

    const minW = 6;
    const minH = 8;
    const aspectRatio = 3 / 4; // Width / Height = 0.75

    let curLeft = startLeftVw;
    let curTop = startTopVw;
    let curWidth = startWidthVw;
    let curHeight = startHeightVw;

    if (dragMode === 'move') {
      curLeft += deltaXvw;
      curTop += deltaYvw;
    } else {
      if (dragMode.includes('e')) {
        curWidth = Math.max(minW, startWidthVw + deltaXvw);
      }
      if (dragMode.includes('w')) {
        const newW = Math.max(minW, startWidthVw - deltaXvw);
        curLeft = startLeftVw + (startWidthVw - newW);
        curWidth = newW;
      }
      if (dragMode.includes('s')) {
        curHeight = Math.max(minH, startHeightVw + deltaYvw);
      }
      if (dragMode.includes('n')) {
        const newH = Math.max(minH, startHeightVw - deltaYvw);
        curTop = startTopVw + (startHeightVw - newH);
        curHeight = newH;
      }

      // Follow / Enforce Aspect Ratio (3:4)
      if (currentConfig.followAspectRatio) {
        if (dragMode.includes('e') || dragMode.includes('w')) {
          const adjH = curWidth / aspectRatio;
          if (dragMode.includes('n')) {
            curTop = startTopVw + (startHeightVw - adjH);
          }
          curHeight = adjH;
        } else if (dragMode.includes('s') || dragMode.includes('n')) {
          const adjW = curHeight * aspectRatio;
          if (dragMode.includes('w')) {
            curLeft = startLeftVw + (startWidthVw - adjW);
          }
          curWidth = adjW;
        }
      }
    }

    curWidth = parseFloat(curWidth.toFixed(2));
    curHeight = parseFloat(curHeight.toFixed(2));
    curLeft = parseFloat(curLeft.toFixed(2));
    curTop = parseFloat(curTop.toFixed(2));

    currentConfig.leftVw = curLeft;
    currentConfig.topVw = curTop;
    currentConfig.widthVw = curWidth;
    currentConfig.heightVw = curHeight;

    container.style.left = `${curLeft}vw`;
    container.style.top = `${curTop}vw`;
    container.style.width = `${curWidth}vw`;
    container.style.height = `${curHeight}vw`;
  });

  window.addEventListener('pointerup', () => {
    if (isDragging) {
      isDragging = false;
      dragMode = null;
      saveBallHitSvgConfig(currentConfig);
    }
  });

  // Clicking background deselects
  window.addEventListener('pointerdown', (e) => {
    const clickedInContainer = (e.target as HTMLElement).closest('#mini-map-container');
    if (!clickedInContainer) {
      isSelected = false;
      updateDraggerUI();
    }
  });
}
