import { ComponentInstance, GlobalLayoutSettings, TelemetryBuffer } from './component-types';
import { COMPONENT_METAS, createComponentInnerHtml } from './component-registry';
import { getScreenHeightVw, calculateElementTopLeft, loadGlobalLayoutSettings } from './layout-store';
import { DraggerController } from './dragger';
import { resolveEffectiveColor } from './team-colors';
import { BoostTierState, createInitialBoostTierState } from './boost-meter';

/**
 * ============================================================================
 * 🚀 High-Performance DOM Caching Engine
 * ============================================================================
 *
 * Strictly eliminates runtime `querySelector` and DOM traversal inside the RAF loop.
 * Maintains pre-queried element references and pre-computed styles.
 * Dynamically maintained when components are added/removed/reordered.
 * ============================================================================
 */

export interface DevDashboardDomNodes {
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

  p1BoostState: BoostTierState;
  p2BoostState: BoostTierState;
  p3BoostState: BoostTierState;
}

export interface CachedComponentInstance {
  instanceId: string;
  inst: ComponentInstance;
  container: HTMLElement;

  // Cached primary child elements
  valEl: HTMLElement | null;
  subValEl: HTMLElement | null;
  labelEl: HTMLElement | null;
  badgeEl: HTMLElement | null;
  boxEl: HTMLElement | null;
  fillEl: HTMLElement | null;
  bgEl: SVGCircleElement | null;
  dotEl: HTMLElement | null;

  // Cached lists for text styling
  textElements: HTMLElement[];
  boxElements: HTMLElement[];

  // Composite widget cached targets
  p1Name: HTMLElement | null;
  p1Val: HTMLElement | null;
  p1Fill: HTMLElement | null;
  p2Name: HTMLElement | null;
  p2Val: HTMLElement | null;
  p2Fill: HTMLElement | null;
  p3Name: HTMLElement | null;
  p3Val: HTMLElement | null;
  p3Fill: HTMLElement | null;
  diffVal: HTMLElement | null;
  scoreText: HTMLElement | null;
  timeVal: HTMLElement | null;
  otVal: HTMLElement | null;
  ballVal: HTMLElement | null;
  usColor: HTMLElement | null;
  oppColor: HTMLElement | null;

  // Boolean indicator targets (for telemetry panel)
  dotCar: HTMLElement | null;
  dotBoost: HTMLElement | null;
  dotGround: HTMLElement | null;
  dotWall: HTMLElement | null;
  dotSlide: HTMLElement | null;
  dotDemo: HTMLElement | null;
  dotSuper: HTMLElement | null;

  // Team colors widget targets
  myPrimary: HTMLElement | null;
  mySecondary: HTMLElement | null;
  oppPrimary: HTMLElement | null;
  oppSecondary: HTMLElement | null;

  // Performance state cache for zero-redundant DOM mutation
  boostTierState: BoostTierState;
  lastTextContent: string;
  lastSpeedDisplay: string;
  lastScoreDiff: number;
  lastScoreText: string;
  lastTimeSeconds: number;
  lastBallTeam: number;
  lastBoolState: boolean;
  lastOpacity: string;
  lastDisplay: string;
  lastColor: string;
  lastGlow: boolean;
  lastCurvedDash: string;
}

let devDomCache: DevDashboardDomNodes | null = null;
let competitiveCachedInstances: CachedComponentInstance[] = [];

/**
 * Cache all Dev Dashboard DOM handles.
 */
export function cacheDevDashboardNodes(): DevDashboardDomNodes {
  devDomCache = {
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
    p3Supersonic: document.getElementById('p3-supersonic-ind'),

    p1BoostState: createInitialBoostTierState(),
    p2BoostState: createInitialBoostTierState(),
    p3BoostState: createInitialBoostTierState()
  };
  return devDomCache;
}

export function getDevDashboardCache(): DevDashboardDomNodes | null {
  return devDomCache;
}

/**
 * Pre-computes and applies text & container styles during initialization/cache-building
 * to prevent doing querySelectorAll and style calculations on every frame.
 */
export function applyStaticComponentStyles(
  cached: CachedComponentInstance,
  globalSettings: GlobalLayoutSettings,
  telemetry?: TelemetryBuffer
): void {
  const inst = cached.inst;
  const meta = COMPONENT_METAS[inst.componentType];
  const supportsGlobal = meta?.supportsGlobalStyle !== false;
  const followGlobal = supportsGlobal && (inst.followGlobal !== false);

  // 1. Text color & stroke
  const effectiveTextColor = resolveEffectiveColor(
    inst.customProps?.textColorMode,
    inst.customProps?.textColor,
    followGlobal ? globalSettings.textColor : undefined,
    followGlobal,
    telemetry,
    undefined
  );

  const strokeWidth = !followGlobal && inst.customProps?.strokeWidth !== undefined
    ? Number(inst.customProps.strokeWidth)
    : (followGlobal ? (globalSettings.strokeWidth ?? 0) : 0);
  const strokeColor = !followGlobal && inst.customProps?.strokeColor
    ? inst.customProps.strokeColor
    : (followGlobal ? (globalSettings.strokeColor || '#000000') : '#000000');

  cached.textElements.forEach((valEl) => {
    if (effectiveTextColor) {
      valEl.style.color = effectiveTextColor;
    } else {
      valEl.style.color = '';
    }

    if (strokeWidth > 0 && strokeColor) {
      valEl.style.setProperty('-webkit-text-stroke', `${strokeWidth}px ${strokeColor}`);
      valEl.style.setProperty('paint-order', 'stroke fill');
    } else {
      valEl.style.setProperty('-webkit-text-stroke', '0px transparent');
      valEl.style.setProperty('paint-order', 'normal');
    }
  });

  // 2. Background color & radius
  const globalBgColor = globalSettings.bgColor || globalSettings.cardBgColor;
  const effectiveBg = resolveEffectiveColor(
    inst.customProps?.bgColorMode,
    inst.customProps?.bgColor,
    followGlobal ? globalBgColor : undefined,
    followGlobal,
    telemetry,
    undefined
  );

  const globalBgRadius = globalSettings.bgRadius ?? globalSettings.cardBorderRadius ?? 0;
  const radius = !followGlobal && inst.customProps?.bgRadius !== undefined
    ? Number(inst.customProps.bgRadius)
    : (!followGlobal && inst.customProps?.borderRadius !== undefined
      ? Number(inst.customProps.borderRadius)
      : (followGlobal ? globalBgRadius : 0));

  cached.boxElements.forEach((box) => {
    if (effectiveBg) {
      box.style.backgroundColor = effectiveBg;
    } else {
      box.style.backgroundColor = '';
    }
    box.style.borderRadius = `${radius}px`;
  });

  // 3. Text alignment
  if (inst.textAlign) {
    cached.boxElements.forEach((t) => {
      t.style.textAlign = inst.textAlign!;
      if (inst.textAlign === 'left') {
        t.style.justifyContent = 'flex-start';
      } else if (inst.textAlign === 'center') {
        t.style.justifyContent = 'center';
      } else if (inst.textAlign === 'right') {
        t.style.justifyContent = 'flex-end';
      }
    });
  }

  // 4. Boost alert bar static styling
  if (inst.componentType === 'element-boost-alert-bar' && cached.boxEl) {
    const alertRadius = Number(inst.customProps?.borderRadius ?? inst.customProps?.bgRadius ?? 4);
    const alertBorderWidth = Number(inst.customProps?.borderWidth ?? 2);
    cached.boxEl.style.borderRadius = `${alertRadius}px`;
    cached.boxEl.style.borderWidth = `${alertBorderWidth}px`;
  }

  // 5. Curved Gauges SVG Static Setup (thickness, gap, orientation, trackColor)
  if (inst.componentType === 'element-curved-boost-bar' || inst.componentType === 'element-curved-speedometer') {
    const thick = Number(inst.customProps?.thickness ?? 8);
    const gap = Number(inst.customProps?.gap ?? 90);
    const orient = Number(inst.customProps?.orientation ?? 90);
    const trackColor = inst.customProps?.trackColor || 'rgba(255, 255, 255, 0.15)';
    const radius = 50 - (thick / 2);
    const perimeter = 2 * Math.PI * radius;
    const activeAngle = 360 - gap;
    const totalDash = perimeter * (activeAngle / 360);
    const rotate = orient + (gap / 2);

    if (cached.bgEl) {
      cached.bgEl.setAttribute('r', radius.toString());
      cached.bgEl.setAttribute('stroke-width', thick.toString());
      cached.bgEl.setAttribute('stroke', trackColor);
      cached.bgEl.setAttribute('stroke-dasharray', `${totalDash} ${perimeter}`);
      cached.bgEl.style.transform = `rotate(${rotate}deg)`;
      cached.bgEl.style.transformOrigin = '50px 50px';
    }

    if (cached.fillEl) {
      cached.fillEl.setAttribute('r', radius.toString());
      cached.fillEl.setAttribute('stroke-width', thick.toString());
      cached.fillEl.style.transform = `rotate(${rotate}deg)`;
      cached.fillEl.style.transformOrigin = '50px 50px';
    }
  }
}

/**
 * Builds the complete DOM tree for Competitive Scene and populates the cache.
 * Must be invoked when components are added, removed, or updated.
 */
export function buildCompetitiveDomCache(
  instances: ComponentInstance[],
  root: HTMLElement,
  dragger: DraggerController | null,
  isLayoutEditing: boolean
): CachedComponentInstance[] {
  root.innerHTML = '';
  const screenH = getScreenHeightVw();
  const globalSettings = loadGlobalLayoutSettings();
  const newCache: CachedComponentInstance[] = [];

  instances.forEach((inst, index) => {
    const container = document.createElement('div');
    container.className = 'comp-container';
    container.setAttribute('data-instance-id', inst.instanceId);

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
      <div class="comp-inner ${isProportional ? 'comp-proportional' : 'comp-flexible'}">
        ${createComponentInnerHtml(inst)}
      </div>
    `;

    // Dragger selection interaction
    container.addEventListener('pointerdown', (e) => {
      if (!isLayoutEditing) return;
      e.stopPropagation();
      dragger?.selectInstance(inst.instanceId);
    });

    root.appendChild(container);

    if (dragger && isProportional) {
      dragger.updateProportionalScale(container, inst);
    }

    // Query and cache all internal node references ONCE
    const textElements = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.dyn-val, .hud-val, .score-diff-val, .dyn-score-text, .dyn-time-val, .dyn-ball-val, .dyn-speed-val, .dyn-boost-val, .dyn-name, .dyn-p1-name, .dyn-p2-name, .dyn-p3-name, .dyn-p1-val, .dyn-p2-val, .dyn-p3-val, .hud-label, .dyn-label, .dyn-sub-val, .widget-boost-val, .hud-player-name, .hud-bool-text, .panel-sub-label, .panel-sub-val, .dyn-ot-val, .roster-name, .roster-boost-val, .metric-label, .metric-val, .dyn-diff-val, .hud-val-countdown, .dyn-player-label, .dyn-ball-team-val, .team-score-p1, .team-score-p2, .time-clock, .dyn-p-name, .dyn-p-speed, .dyn-p-boost-val, .roster-p1-name, .roster-p2-name, .roster-p3-name, .roster-p1-boost, .roster-p2-boost, .roster-p3-boost'
      )
    );

    const boxElements = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.dyn-text-box, .el-custom-text-box, .hud-card, .el-system-time-box, .widget-boost-combo-card, .panel-match-header-container, .player-telemetry-panel, .panel-team-roster-container, .panel-sub-card, .el-global-text-indicator-box, .el-ball-speed-box, .el-ball-team-box, .el-boost-alert-box, .el-boost-text-fixed-box, .el-boost-text-box, .el-match-score-box, .el-num-box, .el-name-text-box, .el-score-diff-box, .el-speed-text-box, .el-static-box, .el-time-text-box, .time-hud-card, .status-hud-card, .el-boost-bar-box, .dyn-boost-box, .hud-boost-bar-container, .el-v-boost-bar-box, .dyn-v-boost-box, .el-speed-bar-box, .dyn-speed-box, .el-v-speed-bar-box, .dyn-v-speed-box, .curved-boost-container, .dyn-curved-container, .curved-speed-container, .dyn-curved-speed-container, .el-color-box, .dyn-color-box'
      )
    );

    const cachedInstance: CachedComponentInstance = {
      instanceId: inst.instanceId,
      inst,
      container,
      valEl: container.querySelector<HTMLElement>('.dyn-val, .score-diff-val, .dyn-time-val, .dyn-ball-val, .dyn-speed-val, .dyn-boost-val, .hud-val, .dyn-badge'),
      subValEl: container.querySelector<HTMLElement>('.dyn-sub-val'),
      labelEl: container.querySelector<HTMLElement>('.dyn-label, .hud-label, .dyn-player-label, .widget-tag'),
      badgeEl: container.querySelector<HTMLElement>('.dyn-badge, .hud-player-badge'),
      boxEl: container.querySelector<HTMLElement>('.dyn-text-box, .el-custom-text-box, .hud-card, .el-system-time-box, .el-boost-alert-box, .el-boost-bar-box, .dyn-boost-box, .hud-boost-bar-container, .el-v-boost-bar-box, .dyn-v-boost-box, .el-speed-bar-box, .dyn-speed-box, .el-v-speed-bar-box, .dyn-v-speed-box, .curved-boost-container, .dyn-curved-container, .curved-speed-container, .dyn-curved-speed-container, .el-color-box, .dyn-color-box'),
      fillEl: container.querySelector<HTMLElement>('.dyn-boost-fill, .el-boost-bar-fill, .hud-boost-bar-fill, .dyn-speed-fill, .el-speed-bar-fill, .dyn-v-boost-fill, .el-v-boost-bar-fill, .dyn-v-speed-fill, .el-v-speed-bar-fill, .widget-bar-fill, .dyn-curved-fill, .curved-progress-bar'),
      bgEl: container.querySelector<SVGCircleElement>('.dyn-curved-bg, .curved-bg-track'),
      dotEl: container.querySelector<HTMLElement>('.dyn-dot, .status-dot, .el-pure-dot'),
      textElements,
      boxElements,

      // Multi-element widgets
      p1Name: container.querySelector<HTMLElement>('.dyn-p1-name, .roster-p1-name, .dyn-p-name'),
      p1Val: container.querySelector<HTMLElement>('.dyn-p1-val, .roster-p1-boost, .dyn-p-boost-val'),
      p1Fill: container.querySelector<HTMLElement>('.dyn-p1-fill, .dyn-p-boost-fill'),
      p2Name: container.querySelector<HTMLElement>('.dyn-p2-name, .roster-p2-name'),
      p2Val: container.querySelector<HTMLElement>('.dyn-p2-val, .roster-p2-boost'),
      p2Fill: container.querySelector<HTMLElement>('.dyn-p2-fill'),
      p3Name: container.querySelector<HTMLElement>('.dyn-p3-name, .roster-p3-name'),
      p3Val: container.querySelector<HTMLElement>('.dyn-p3-val, .roster-p3-boost'),
      p3Fill: container.querySelector<HTMLElement>('.dyn-p3-fill'),
      diffVal: container.querySelector<HTMLElement>('.dyn-diff-val, .score-diff-val'),
      scoreText: container.querySelector<HTMLElement>('.dyn-score-text'),
      timeVal: container.querySelector<HTMLElement>('.dyn-time-val, .time-clock'),
      otVal: container.querySelector<HTMLElement>('.dyn-ot-val'),
      ballVal: container.querySelector<HTMLElement>('.dyn-ball-val'),
      usColor: container.querySelector<HTMLElement>('.dyn-us-color'),
      oppColor: container.querySelector<HTMLElement>('.dyn-opp-color'),

      dotCar: container.querySelector<HTMLElement>('.dyn-hascar'),
      dotBoost: container.querySelector<HTMLElement>('.dyn-boosting'),
      dotGround: container.querySelector<HTMLElement>('.dyn-onground'),
      dotWall: container.querySelector<HTMLElement>('.dyn-onwall'),
      dotSlide: container.querySelector<HTMLElement>('.dyn-slide'),
      dotDemo: container.querySelector<HTMLElement>('.dyn-demo'),
      dotSuper: container.querySelector<HTMLElement>('.dyn-super'),

      myPrimary: container.querySelector<HTMLElement>('.dyn-my-primary, .my-color-block'),
      mySecondary: container.querySelector<HTMLElement>('.dyn-my-secondary'),
      oppPrimary: container.querySelector<HTMLElement>('.dyn-opp-primary, .opp-color-block'),
      oppSecondary: container.querySelector<HTMLElement>('.dyn-opp-secondary'),

      boostTierState: createInitialBoostTierState(),
      lastTextContent: '',
      lastSpeedDisplay: '',
      lastScoreDiff: -9999,
      lastScoreText: '',
      lastTimeSeconds: -1,
      lastBallTeam: -1,
      lastBoolState: false,
      lastOpacity: '',
      lastDisplay: '',
      lastColor: '',
      lastGlow: false,
      lastCurvedDash: ''
    };

    // Pre-apply static visual styles once on creation
    applyStaticComponentStyles(cachedInstance, globalSettings);

    newCache.push(cachedInstance);
  });

  if (dragger) {
    dragger.setInstances(instances);
  }

  competitiveCachedInstances = newCache;
  return newCache;
}

export function getCompetitiveDomCache(): CachedComponentInstance[] {
  return competitiveCachedInstances;
}
