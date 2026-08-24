import { STANDARD_BOOST_LOCATIONS } from './pitch-geometry';

/**
 * ============================================================================
 * 🏟️ Ball Hit SVG & Pitch MiniMap Engine (GPU-Accelerated Component Widget)
 * ============================================================================
 */

export interface BallHitSvgConfig {
  // Pitch Boundary & Field
  borderStrokeWidth: number; // SVG units (default 75)
  borderColor: string;
  borderOpacity: number; // 0.0 - 1.0
  bgFillColor: string;
  bgFillOpacity: number; // 0.0 - 1.0
  pitchLineColor: string;
  pitchLineOpacity: number;

  // Widget Container Overall Background
  containerBgColor: string;
  containerBgOpacity: number; // 0.0 - 1.0

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

  // Outer Speed Ring Common
  ringMaxPercent: number; // 1 - 100% of pitch short side (default 100)
  ringBorderWidth: number; // px (default 2)

  // Outer Speed Ring - My Team
  myTeamRingBorderColor: string;
  myTeamRingBorderOpacity: number;
  myTeamRingFillColor: string;
  myTeamRingFillOpacity: number;

  // Outer Speed Ring - Opponent Team
  oppTeamRingBorderColor: string;
  oppTeamRingBorderOpacity: number;
  oppTeamRingFillColor: string;
  oppTeamRingFillOpacity: number;

  // Live Ring Preview
  ringPreviewActive: boolean;
  ringPreviewSpeed: number; // 0 - 110 KPH
  ringPreviewTeam: 'my' | 'opp';

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

  // Legacy fallback fields
  ringBorderColor?: string;
  ringBorderOpacity?: number;
  ringFillColor?: string;
  ringFillOpacity?: number;
}

export const DEFAULT_BALL_HIT_SVG_CONFIG: BallHitSvgConfig = {
  borderStrokeWidth: 75,
  borderColor: '#00f0ff',
  borderOpacity: 0.85,
  bgFillColor: '#0a0f19',
  bgFillOpacity: 0.7,
  pitchLineColor: '#ffffff',
  pitchLineOpacity: 0.22,

  containerBgColor: '#04070e',
  containerBgOpacity: 0.85,

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
  ringBorderWidth: 2,
  myTeamRingBorderColor: '#00ff88',
  myTeamRingBorderOpacity: 0.85,
  myTeamRingFillColor: '#00ff88',
  myTeamRingFillOpacity: 0.15,

  oppTeamRingBorderColor: '#ff3366',
  oppTeamRingBorderOpacity: 0.85,
  oppTeamRingFillColor: '#ff3366',
  oppTeamRingFillOpacity: 0.15,

  ringPreviewActive: false,
  ringPreviewSpeed: 110,
  ringPreviewTeam: 'my',

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

/**
 * Converts Hex color string (#rrggbb or #rgb) and alpha (0..1) to rgba(...) CSS string
 */
export function hexToRgba(color: string, opacity: number = 1): string {
  if (!color) return `rgba(0, 240, 255, ${opacity})`;
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    return color;
  }
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const clampedAlpha = Math.max(0, Math.min(1, opacity));
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}

export function loadSavedBallHitSvgConfig(): BallHitSvgConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_BALL_HIT_SVG_CONFIG,
        ...parsed,
        // Backward compatibility migration for speed ring separate colors
        myTeamRingBorderColor: parsed.myTeamRingBorderColor || parsed.ringBorderColor || DEFAULT_BALL_HIT_SVG_CONFIG.myTeamRingBorderColor,
        myTeamRingBorderOpacity: parsed.myTeamRingBorderOpacity ?? parsed.ringBorderOpacity ?? DEFAULT_BALL_HIT_SVG_CONFIG.myTeamRingBorderOpacity,
        myTeamRingFillColor: parsed.myTeamRingFillColor || parsed.ringFillColor || DEFAULT_BALL_HIT_SVG_CONFIG.myTeamRingFillColor,
        myTeamRingFillOpacity: parsed.myTeamRingFillOpacity ?? parsed.ringFillOpacity ?? DEFAULT_BALL_HIT_SVG_CONFIG.myTeamRingFillOpacity,
        oppTeamRingBorderColor: parsed.oppTeamRingBorderColor || DEFAULT_BALL_HIT_SVG_CONFIG.oppTeamRingBorderColor,
        oppTeamRingBorderOpacity: parsed.oppTeamRingBorderOpacity ?? parsed.ringBorderOpacity ?? DEFAULT_BALL_HIT_SVG_CONFIG.oppTeamRingBorderOpacity,
        oppTeamRingFillColor: parsed.oppTeamRingFillColor || DEFAULT_BALL_HIT_SVG_CONFIG.oppTeamRingFillColor,
        oppTeamRingFillOpacity: parsed.oppTeamRingFillOpacity ?? parsed.ringFillOpacity ?? DEFAULT_BALL_HIT_SVG_CONFIG.oppTeamRingFillOpacity,
        containerBgColor: parsed.containerBgColor || DEFAULT_BALL_HIT_SVG_CONFIG.containerBgColor,
        containerBgOpacity: parsed.containerBgOpacity ?? DEFAULT_BALL_HIT_SVG_CONFIG.containerBgOpacity
      };
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
    const isMy = currentConfig.ringPreviewTeam !== 'opp';
    simulateBallHitSvg(0, 0, currentConfig.ringPreviewSpeed, isMy);
  }
}

export function getBallHitSvgConfig(): BallHitSvgConfig {
  return currentConfig;
}

/**
 * Sets target team (0 or 1) and flips minimap 180° if Team 1
 */
export function setBallHitSvgTargetTeam(team: number): void {
  const normalized = team === 1 || String(team) === '1' ? 1 : 0;
  if (currentTargetTeam !== normalized) {
    currentTargetTeam = normalized;
    applyTeamOrientation();
  }
}

export function getBallHitSvgTargetTeam(): number {
  return currentTargetTeam;
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
    // Apply Widget Overall Container Background Color & Opacity
    container.style.backgroundColor = hexToRgba(
      currentConfig.containerBgColor || '#04070e',
      currentConfig.containerBgOpacity ?? 0.85
    );
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
  // Pitch bounds: X: [-4500, 4500] (width 9000), Y: [-6000, 6000] (height 12000)
  // Rocket League: Y=+6000 is Orange goal (top), Y=-6000 is Blue goal (bottom).
  // SVG ViewBox (-4500, -6000, 9000, 12000):
  // X: -4500 (0%) -> +4500 (100%)
  // Y: -6000 (Top, 0%) -> +6000 (Bottom, 100%) (SVG Y = -worldY)
  const clampedX = Math.max(-4500, Math.min(4500, worldX));
  const clampedY = Math.max(-6000, Math.min(6000, worldY));

  const normX = (4500 - clampedX) / 9000;
  const normY = (6000 - clampedY) / 12000;

  const containerW = container.clientWidth || 240;

  // 3. Position Indicator with percentage coordinates + transform centering
  indicator.style.display = 'flex';
  indicator.style.left = `${normX * 100}%`;
  indicator.style.top = `${normY * 100}%`;
  indicator.style.transform = 'translate(-50%, -50%)';

  // 4. Center Dot Styles (Separate colors & opacities for My Team vs Opponent Team)
  const dotColor = isMyTeam ? currentConfig.myTeamDotColor : currentConfig.oppTeamDotColor;
  const dotOpacity = isMyTeam ? currentConfig.myTeamDotOpacity : currentConfig.oppTeamDotOpacity;
  const dotD = Math.max(2, currentConfig.dotRadius * 2);

  dot.style.width = `${dotD}px`;
  dot.style.height = `${dotD}px`;
  dot.style.backgroundColor = hexToRgba(dotColor, dotOpacity);
  dot.style.boxShadow = `0 0 8px ${hexToRgba(dotColor, dotOpacity)}`;

  // 5. Outer Speed Ring (Separate border and fill colors/opacities for My Team vs Opponent Team)
  const ringBorderColor = isMyTeam
    ? (currentConfig.myTeamRingBorderColor || currentConfig.ringBorderColor || '#00ff88')
    : (currentConfig.oppTeamRingBorderColor || '#ff3366');
  const ringBorderOpacity = isMyTeam
    ? (currentConfig.myTeamRingBorderOpacity ?? currentConfig.ringBorderOpacity ?? 0.85)
    : (currentConfig.oppTeamRingBorderOpacity ?? 0.85);

  const ringFillColor = isMyTeam
    ? (currentConfig.myTeamRingFillColor || currentConfig.ringFillColor || '#00ff88')
    : (currentConfig.oppTeamRingFillColor || '#ff3366');
  const ringFillOpacity = isMyTeam
    ? (currentConfig.myTeamRingFillOpacity ?? currentConfig.ringFillOpacity ?? 0.15)
    : (currentConfig.oppTeamRingFillOpacity ?? 0.15);

  // Diameter based on speed relative to pitch short side (container width)
  const speed = currentConfig.ringPreviewActive ? currentConfig.ringPreviewSpeed : speedKph;
  const speedFraction = Math.max(0, Math.min(1.0, speed / 110));
  const maxRingDiameter = containerW * (currentConfig.ringMaxPercent / 100);
  const ringDiameter = Math.max(0, maxRingDiameter * speedFraction);

  ring.style.width = `${ringDiameter}px`;
  ring.style.height = `${ringDiameter}px`;
  ring.style.border = `${currentConfig.ringBorderWidth}px solid ${hexToRgba(ringBorderColor, ringBorderOpacity)}`;
  ring.style.backgroundColor = hexToRgba(ringFillColor, ringFillOpacity);
  ring.style.boxShadow = `0 0 8px ${hexToRgba(ringBorderColor, ringBorderOpacity * 0.5)}`;
  ring.style.borderRadius = '50%';
  ring.style.opacity = '1';

  // 6. Web Animations API Execution (Composited on GPU thread)
  const holdSec = Math.max(0, currentConfig.animHoldDuration);
  const fadeSec = Math.max(0.01, currentConfig.animFadeDuration);
  const totalSec = holdSec + fadeSec;
  const totalMs = totalSec * 1000;
  const holdFraction = totalSec > 0 ? holdSec / totalSec : 0;

  const easingCurve = resolveEasingString(currentConfig.animEasingType, currentConfig.animCustomEasing);

  indicator.style.opacity = '1';

  const keyframes = [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: holdFraction, easing: easingCurve },
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
    // Fallback
    indicator.style.opacity = '1';
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

  let payloadData: any = packet;
  try {
    if (typeof packet === 'string') {
      payloadData = JSON.parse(packet);
    } else if (packet.Data !== undefined) {
      payloadData = typeof packet.Data === 'string' ? JSON.parse(packet.Data) : packet.Data;
    } else {
      payloadData = packet;
    }
  } catch (err) {
    console.error('Failed to parse BallHit SVG packet:', err);
    return;
  }

  if (!payloadData || typeof payloadData !== 'object') return;

  // Extract Ball Location
  const ball = payloadData.Ball || payloadData.ball;
  const loc = ball?.Location || ball?.location || payloadData.Location || payloadData.location;

  let hitX = 0;
  let hitY = 0;
  if (loc) {
    hitX = Number(loc.X ?? loc.x ?? 0);
    hitY = Number(loc.Y ?? loc.y ?? 0);
  }

  // Extract Ball Speed
  let speed = 60;
  const rawSpd =
    ball?.PostHitSpeed ??
    ball?.postHitSpeed ??
    ball?.Speed ??
    ball?.speed ??
    payloadData.postHitSpeed ??
    payloadData.PostHitSpeed;
  if (rawSpd !== undefined && rawSpd !== null) {
    const numSpd = Number(rawSpd);
    // If speed is in unreal units/sec (>150), convert to KPH (uu/s * 0.036 = kph)
    speed = numSpd > 150 ? numSpd * 0.036 : numSpd;
  }

  // Extract Player Team
  const players = payloadData.Players || payloadData.players || [];
  const primaryPlayer =
    (Array.isArray(players) && players.length > 0 ? players[0] : null) ||
    payloadData.Player ||
    payloadData.player;
  const hitTeamNum =
    primaryPlayer?.TeamNum ??
    primaryPlayer?.teamNum ??
    payloadData.TeamNum ??
    payloadData.teamNum;

  // Update target team if present in packet
  const targetTeamNum =
    payloadData.Game?.Target?.TeamNum ??
    payloadData.Target?.TeamNum ??
    payloadData.TargetTeam ??
    payloadData.targetTeam;
  if (targetTeamNum !== undefined && targetTeamNum !== null) {
    setBallHitSvgTargetTeam(Number(targetTeamNum));
  }

  // Determine if it was our team (Green) or opponent team (Red)
  let isMyTeam = true;
  if (hitTeamNum !== undefined && hitTeamNum !== null && hitTeamNum !== '-') {
    isMyTeam = (Number(hitTeamNum) === currentTargetTeam || String(hitTeamNum) === String(currentTargetTeam));
  } else {
    isMyTeam = currentTargetTeam === 0;
  }

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
