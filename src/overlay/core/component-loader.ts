import {
  ComponentInstance,
  ComponentMeta,
  ComponentTier,
  SpeedUnit,
  TelemetryBuffer
} from "./component-types";
import { loadGlobalLayoutSettings, isTextComponent } from "./layout-store";
import { resolveEffectiveColor } from "./team-colors";
import { toRealUuSpeed, calcNonlinearSpeedProgress, calcSpeedColor } from "./speed-meter";

export interface ParsedComponent {
  manifest: ComponentMeta;
  templateHtml: string;
  css: string;
}

const componentFiles = import.meta.glob("../components/**/*.html", {
  query: "?raw",
  import: "default",
  eager: true
});

export const COMPONENT_METAS: Record<string, ComponentMeta> = {};
export const COMPONENT_TEMPLATES: Record<string, string> = {};

let isStylesInjected = false;

export function initComponentCatalog(): Record<string, ComponentMeta> {
  let combinedCss = "";

  for (const [path, raw] of Object.entries(componentFiles)) {
    try {
      const rawHtml = typeof raw === "string" ? raw : (raw && typeof (raw as any).default === "string" ? (raw as any).default : String(raw || ""));
      if (!rawHtml) continue;
      const parsed = parseComponentHtml(rawHtml, path);
      if (parsed && parsed.manifest && parsed.manifest.id) {
        COMPONENT_METAS[parsed.manifest.id] = parsed.manifest;
        COMPONENT_TEMPLATES[parsed.manifest.id] = parsed.templateHtml;
        combinedCss += "\n/* --- Component: " + parsed.manifest.id + " --- */\n" + parsed.css + "\n";
      }
    } catch (e) {
      console.error("Failed to parse component from " + path + ":", e);
    }
  }

  // Inject consolidated styles once
  if (!isStylesInjected && typeof document !== "undefined") {
    let styleEl = document.getElementById("imported-components-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "imported-components-styles";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = combinedCss;
    isStylesInjected = true;
  }

  return COMPONENT_METAS;
}

// Auto-initialize component catalog upon module load if in browser / webview
if (typeof window !== "undefined" || typeof document !== "undefined") {
  try {
    initComponentCatalog();
  } catch (e) {
    console.error("Auto initComponentCatalog error:", e);
  }
}

export function parseComponentHtml(rawInput: string | { default: string } | any, sourcePath: string = ""): ParsedComponent | null {
  if (typeof DOMParser === "undefined") return null;

  const rawHtml = typeof rawInput === "string"
    ? rawInput
    : (rawInput && typeof rawInput.default === "string" ? rawInput.default : String(rawInput || ""));

  if (!rawHtml) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");

  // 1. Extract Manifest JSON
  const manifestScript = doc.getElementById("component-manifest");
  if (!manifestScript || !manifestScript.textContent) {
    console.warn("No #component-manifest found in " + sourcePath);
    return null;
  }

  let manifest: ComponentMeta;
  try {
    manifest = JSON.parse(manifestScript.textContent.trim());
  } catch (err) {
    console.error("Invalid JSON in #component-manifest in " + sourcePath + ":", err);
    return null;
  }

  // 2. Extract Template HTML
  const template = doc.getElementById("component-template") as HTMLTemplateElement | null;
  const templateHtml = template ? template.innerHTML : "";

  // 3. Extract Styles, filtering out standalone preview debug styles
  const styleTags = doc.querySelectorAll("style");
  let cleanCss = "";
  styleTags.forEach((s) => {
    const rawStyle = s.textContent || "";
    const sanitized = rawStyle
      .replace(/body\.standalone-preview[^{]*\{[^}]*\}/g, "")
      .replace(/\.preview-stage[^{]*\{[^}]*\}/g, "")
      .replace(/#preview-viewport[^{]*\{[^}]*\}/g, "")
      .replace(/\.dragger-[^{]*\{[^}]*\}/g, "")
      .replace(/#debug-panel[^{]*\{[^}]*\}/g, "")
      .replace(/\.control-[^{]*\{[^}]*\}/g, "");
    cleanCss += sanitized + "\n";
  });

  return {
    manifest,
    templateHtml,
    css: cleanCss
  };
}

export function getComponentsByTier(tier: ComponentTier): ComponentMeta[] {
  if (Object.keys(COMPONENT_METAS).length === 0) {
    initComponentCatalog();
  }
  return Object.values(COMPONENT_METAS).filter((c) => c.tier === tier);
}

export function getAllComponentMetas(): ComponentMeta[] {
  if (Object.keys(COMPONENT_METAS).length === 0) {
    initComponentCatalog();
  }
  return Object.values(COMPONENT_METAS);
}

export function formatMinutesSeconds(totalSeconds: number): string {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(Math.trunc(totalSeconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const formattedSecs = secs.toString().padStart(2, "0");
  return (isNegative ? "-" : "") + mins + ":" + formattedSecs;
}

export function toKph(rawSpeed: number): number {
  if (rawSpeed > 150) {
    return rawSpeed * 0.036;
  }
  return rawSpeed;
}

export function toUu(rawSpeed: number): number {
  if (rawSpeed > 150) {
    return rawSpeed;
  }
  return rawSpeed / 0.036;
}

export function formatSpeed(rawSpeed: number, speedUnit: SpeedUnit = "kph"): string {
  if (speedUnit === "uu/s") {
    return Math.round(toUu(rawSpeed)).toString();
  }
  return Math.round(toKph(rawSpeed)).toString();
}

export function formatScoreDiff(diff: number): string {
  if (diff === 0) return "0";
  if (diff > 0) return "+" + diff;
  return "" + diff;
}

export function createComponentInnerHtml(inst: ComponentInstance): string {
  if (Object.keys(COMPONENT_TEMPLATES).length === 0) {
    initComponentCatalog();
  }
  const template = COMPONENT_TEMPLATES[inst.componentType];
  if (template) {
    return template;
  }

  // Fallback card structure if not preloaded
  return "<div class=\"hud-card\"><span class=\"hud-label\">" + inst.componentType + "</span></div>";
}

function applyBoolIndicatorState(
  dot: HTMLElement | null,
  rawVal: boolean,
  inst: ComponentInstance,
  telemetry: TelemetryBuffer | undefined,
  defaultActiveColor: string,
  defaultInactiveColor: string = "rgba(51, 65, 85, 0.5)"
) {
  if (!dot) return;
  const isFiltered = inst.customProps?.invertBool ? !rawVal : Boolean(rawVal);
  dot.className = "el-pure-dot dyn-dot " + (isFiltered ? "bool-on" : "bool-off");

  const activeColor = resolveEffectiveColor(
    inst.customProps?.activeColorMode,
    inst.customProps?.activeColor,
    undefined,
    false,
    telemetry,
    defaultActiveColor
  );
  const inactiveColor = inst.customProps?.inactiveColor || defaultInactiveColor;
  const color = isFiltered ? activeColor : inactiveColor;

  dot.style.backgroundColor = color;
  if (isFiltered && color !== "transparent" && !color.startsWith("rgba(0, 0, 0, 0)")) {
    dot.style.boxShadow = "0 0 10px " + color;
  } else {
    dot.style.boxShadow = "none";
  }
}

export function applyTextStyles(
  container: HTMLElement,
  inst: ComponentInstance,
  telemetry?: TelemetryBuffer,
  fallbackTextColor?: string
) {
  const textElements = container.querySelectorAll<HTMLElement>(
    ".dyn-val, .hud-val, .score-diff-val, .dyn-score-text, .dyn-time-val, .dyn-ball-val, .dyn-speed-val, .dyn-boost-val, .dyn-name, .dyn-p1-name, .dyn-p2-name, .dyn-p3-name, .dyn-p1-val, .dyn-p2-val, .dyn-p3-val, .hud-label, .dyn-label, .dyn-sub-val, .widget-boost-val, .hud-player-name, .hud-bool-text, .panel-sub-label, .panel-sub-val, .dyn-ot-val, .roster-name, .roster-boost-val, .metric-label, .metric-val, .dyn-diff-val, .hud-val-countdown, .dyn-player-label, .dyn-ball-team-val, .team-score-p1, .team-score-p2, .time-clock, .dyn-p-name, .dyn-p-speed, .dyn-p-boost-val, .roster-p1-name, .roster-p2-name, .roster-p3-name, .roster-p1-boost, .roster-p2-boost, .roster-p3-boost"
  );
  const boxElements = container.querySelectorAll<HTMLElement>(
    ".dyn-text-box, .el-custom-text-box, .hud-card, .el-system-time-box, .widget-boost-combo-card, .panel-match-header-container, .player-telemetry-panel, .panel-team-roster-container, .panel-sub-card, .el-global-text-indicator-box, .el-ball-speed-box, .el-ball-team-box, .el-boost-alert-box, .el-boost-text-fixed-box, .el-boost-text-box, .el-match-score-box, .el-num-box, .el-name-text-box, .el-score-diff-box, .el-speed-text-box, .el-static-box, .el-time-text-box, .time-hud-card, .status-hud-card"
  );

  const globalSettings = loadGlobalLayoutSettings();
  const meta = COMPONENT_METAS[inst.componentType];
  const supportsGlobal = meta?.supportsGlobalStyle !== false;
  const followGlobal = supportsGlobal && (inst.followGlobal !== false);

  // 1. Resolve and apply Text Color
  const effectiveTextColor = resolveEffectiveColor(
    inst.customProps?.textColorMode,
    inst.customProps?.textColor,
    followGlobal ? globalSettings.textColor : undefined,
    followGlobal,
    telemetry,
    fallbackTextColor
  );

  // 2. Stroke Width & Stroke Color
  const strokeWidth = !followGlobal && inst.customProps?.strokeWidth !== undefined
    ? Number(inst.customProps.strokeWidth)
    : (followGlobal ? (globalSettings.strokeWidth ?? 0) : 0);
  const strokeColor = !followGlobal && inst.customProps?.strokeColor
    ? inst.customProps.strokeColor
    : (followGlobal ? (globalSettings.strokeColor || "#000000") : "#000000");

  textElements.forEach((valEl) => {
    if (effectiveTextColor) {
      valEl.style.color = effectiveTextColor;
    } else if (fallbackTextColor) {
      valEl.style.color = fallbackTextColor;
    } else {
      valEl.style.color = "";
    }

    if (strokeWidth > 0 && strokeColor) {
      valEl.style.setProperty("-webkit-text-stroke", strokeWidth + "px " + strokeColor);
      valEl.style.setProperty("paint-order", "stroke fill");
    } else {
      valEl.style.setProperty("-webkit-text-stroke", "0px transparent");
      valEl.style.setProperty("paint-order", "normal");
    }
  });

  // 3. Background Color & Radius for inner text boxes
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

  boxElements.forEach((box) => {
    if (effectiveBg) {
      box.style.backgroundColor = effectiveBg;
    } else {
      box.style.backgroundColor = "";
    }
    box.style.borderRadius = radius + "px";
  });
}

export function updateComponentInstanceDom(
  container: HTMLElement,
  inst: ComponentInstance,
  telemetry: TelemetryBuffer
) {
  if (Object.keys(COMPONENT_METAS).length === 0) {
    initComponentCatalog();
  }

  const globalSettings = loadGlobalLayoutSettings();
  const autoHide = globalSettings.autoHideNonExistingPlayers !== false;

  const p = inst.targetPlayer || "p1";
  const name = p === "p1" ? telemetry.p1Name : p === "p2" ? telemetry.p2Name : telemetry.p3Name;
  const speed = p === "p1" ? telemetry.p1Speed : p === "p2" ? telemetry.p2Speed : telemetry.p3Speed;
  const boost = p === "p1" ? telemetry.p1Boost : p === "p2" ? telemetry.p2Boost : telemetry.p3Boost;
  const hasCar = p === "p1" ? telemetry.p1HasCar : p === "p2" ? telemetry.p2HasCar : telemetry.p3HasCar;
  const isBoosting = p === "p1" ? telemetry.p1Boosting : p === "p2" ? telemetry.p2Boosting : telemetry.p3Boosting;
  const onGround = p === "p1" ? telemetry.p1OnGround : p === "p2" ? telemetry.p2OnGround : telemetry.p3OnGround;
  const onWall = p === "p1" ? telemetry.p1OnWall : p === "p2" ? telemetry.p2OnWall : telemetry.p3OnWall;
  const powersliding = p === "p1" ? telemetry.p1Powersliding : p === "p2" ? telemetry.p2Powersliding : telemetry.p3Powersliding;
  const demolished = p === "p1" ? telemetry.p1Demolished : p === "p2" ? telemetry.p2Demolished : telemetry.p3Demolished;
  const supersonic = p === "p1" ? telemetry.p1Supersonic : p === "p2" ? telemetry.p2Supersonic : telemetry.p3Supersonic;

  // 0. Auto-hide component if related player's hasCar is false
  if (autoHide && (inst.category === "player" || inst.targetPlayer)) {
    if (!hasCar) {
      container.style.display = "none";
      return; // Stop processing to save rendering cost
    } else {
      if (container.style.display === "none") {
        container.style.display = "";
      }
    }
  } else {
    if (container.style.display === "none") {
      container.style.display = "";
    }
  }

  // Set Container Opacity respecting Global Opacity if followGlobal !== false
  const effectiveOpacity = (inst.followGlobal !== false)
    ? (globalSettings.opacity ?? 1.0)
    : (inst.opacity !== undefined ? inst.opacity : 1.0);
  container.style.opacity = effectiveOpacity.toString();

  const myTeamColor = telemetry.myPrimaryColor || "#1873FF";
  const oppTeamColor = telemetry.oppPrimaryColor || "#C26418";

  // 1. Text alignment
  if (inst.textAlign) {
    const alignTargets = container.querySelectorAll<HTMLElement>(
      ".dyn-text-box, .el-custom-text-box, .dyn-val, .hud-card, .el-num-box, .el-name-text-box, .el-score-diff-box, .el-speed-text-box, .el-static-box, .el-time-text-box, .el-ball-speed-box, .el-ball-team-box, .el-boost-text-box, .el-boost-text-fixed-box, .el-system-time-box, .el-global-text-indicator-box"
    );
    alignTargets.forEach((t) => {
      t.style.textAlign = inst.textAlign!;
      if (inst.textAlign === "left") {
        t.style.justifyContent = "flex-start";
      } else if (inst.textAlign === "center") {
        t.style.justifyContent = "center";
      } else if (inst.textAlign === "right") {
        t.style.justifyContent = "flex-end";
      }
    });
  }

  // 2. Dispatch component-specific DOM updates
  switch (inst.componentType) {
    case "element-boost-text":
    case "element-boost-text-fixed": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = boost.toString();
        let fallbackColor = inst.customProps?.colorHigh || "#10b981"; // green
        let blink = false;
        if (boost < 12) {
          fallbackColor = inst.customProps?.colorLow || "#ef4444"; // red with alert blink
          blink = inst.customProps?.enableBlink !== false && inst.componentType !== "element-boost-text-fixed";
        } else if (boost < 30) {
          fallbackColor = inst.customProps?.colorLow || "#ef4444"; // red, no blink
          blink = false;
        } else if (boost < 60) {
          fallbackColor = inst.customProps?.colorMid || "#f59e0b"; // yellow
          blink = false;
        } else {
          fallbackColor = inst.customProps?.colorHigh || "#10b981"; // green
          blink = false;
        }
        valEl.classList.toggle("danger-blink", blink);
        applyTextStyles(container, inst, telemetry, fallbackColor);
      }
      break;
    }

    case "element-speed-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = formatSpeed(speed, inst.speedUnit);
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-player-name-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = name;
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-time-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = formatMinutesSeconds(telemetry.timeSeconds);
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-system-time": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        const now = new Date();
        const hrs = now.getHours().toString().padStart(2, "0");
        const mins = now.getMinutes().toString().padStart(2, "0");
        const secs = now.getSeconds().toString().padStart(2, "0");
        valEl.textContent = `${hrs}:${mins}:${secs}`;
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-ball-speed-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = formatSpeed(telemetry.ballSpeed, inst.speedUnit);
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-ball-team-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = telemetry.ballTeamNum === 0 ? "BLUE" : "ORANGE";
        valEl.style.color = telemetry.ballTeamNum === 0 ? myTeamColor : oppTeamColor;
        applyTextStyles(container, inst, telemetry, telemetry.ballTeamNum === 0 ? myTeamColor : oppTeamColor);
      }
      break;
    }

    case "element-score-diff-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = formatScoreDiff(telemetry.scoreDiff);
        valEl.classList.toggle("score-pos", telemetry.scoreDiff > 0);
        valEl.classList.toggle("score-neg", telemetry.scoreDiff < 0);
        valEl.classList.toggle("score-tie", telemetry.scoreDiff === 0);
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-match-score-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = `${telemetry.myScore} - ${telemetry.oppScore}`;
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-my-score-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = telemetry.myScore.toString();
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-opp-score-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = telemetry.oppScore.toString();
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-static-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = inst.customProps?.staticText || "LABEL";
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-custom-text":
    case "custom-text": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = inst.customProps?.customText || "SUPERSONIC";
        const boolVar = inst.customProps?.boolVar || "supersonic";
        let stateVal = false;
        if (boolVar === "supersonic") stateVal = supersonic;
        else if (boolVar === "boosting") stateVal = isBoosting;
        else if (boolVar === "hascar") stateVal = hasCar;
        else if (boolVar === "onground") stateVal = onGround;
        else if (boolVar === "onwall") stateVal = onWall;
        else if (boolVar === "powersliding") stateVal = powersliding;
        else if (boolVar === "demolished") stateVal = demolished;
        else if (boolVar === "overtime") stateVal = telemetry.bOvertime;

        const isFiltered = inst.customProps?.invertBool ? !stateVal : Boolean(stateVal);
        const enOp = inst.customProps?.enabledOpacity ?? 1.0;
        const disOp = inst.customProps?.disabledOpacity ?? 0.2;
        container.style.opacity = (effectiveOpacity * (isFiltered ? enOp : disOp)).toString();

        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
    }

    case "element-global-text-indicator": {
      const valEl = container.querySelector<HTMLElement>(".dyn-val");
      if (valEl) {
        valEl.textContent = telemetry.bOvertime ? "OVERTIME" : "REGULAR TIME";
        applyTextStyles(container, inst, telemetry, telemetry.bOvertime ? "#ff3b30" : "#30d158");
      }
      break;
    }

    case "element-team-color-box": {
      const box = container.querySelector<HTMLElement>(".el-color-box, .dyn-color-box");
      if (box) {
        const boxColor = resolveEffectiveColor(
          inst.customProps?.boxColorMode || inst.customProps?.bgColorMode,
          inst.customProps?.bgColor,
          undefined,
          false,
          telemetry,
          myTeamColor
        );
        box.style.backgroundColor = boxColor || myTeamColor;
        const radius = inst.customProps?.borderRadius ?? inst.customProps?.bgRadius ?? 4;
        box.style.borderRadius = `${radius}px`;
      }
      break;
    }

    // Boolean Pure Indicators
    case "element-hascar-indicator":
      applyBoolIndicatorState(container.querySelector<HTMLElement>(".dyn-dot"), hasCar, inst, telemetry, "#30d158");
      break;
    case "element-boosting-indicator":
      applyBoolIndicatorState(container.querySelector<HTMLElement>(".dyn-dot"), isBoosting, inst, telemetry, "#ff9500");
      break;
    case "element-onground-indicator":
      applyBoolIndicatorState(container.querySelector<HTMLElement>(".dyn-dot"), onGround, inst, telemetry, "#0a84ff");
      break;
    case "element-onwall-indicator":
      applyBoolIndicatorState(container.querySelector<HTMLElement>(".dyn-dot"), onWall, inst, telemetry, "#bf5af2");
      break;
    case "element-powersliding-indicator":
      applyBoolIndicatorState(container.querySelector<HTMLElement>(".dyn-dot"), powersliding, inst, telemetry, "#ffd60a");
      break;
    case "element-demolished-indicator":
      applyBoolIndicatorState(container.querySelector<HTMLElement>(".dyn-dot"), demolished, inst, telemetry, "#ff453a");
      break;
    case "element-supersonic-indicator":
      applyBoolIndicatorState(container.querySelector<HTMLElement>(".dyn-dot"), supersonic, inst, telemetry, "#bf5af2");
      break;
    case "element-overtime-indicator":
      applyBoolIndicatorState(container.querySelector<HTMLElement>(".dyn-dot"), telemetry.bOvertime, inst, telemetry, "#ff453a");
      break;

    // Boost Progress Bars (Horizontal)
    case "element-boost-bar":
    case "element-boost-bar-no-blink": {
      const box = container.querySelector<HTMLElement>(".el-boost-bar-box, .dyn-boost-box, .hud-boost-bar-container");
      const fill = container.querySelector<HTMLElement>(".dyn-boost-fill, .el-boost-bar-fill");
      if (box) {
        const effectiveBg = resolveEffectiveColor(
          inst.customProps?.bgColorMode,
          inst.customProps?.bgColor,
          inst.followGlobal !== false ? (globalSettings.bgColor || globalSettings.cardBgColor) : undefined,
          inst.followGlobal !== false,
          telemetry,
          "rgba(0, 0, 0, 0.65)"
        );
        if (effectiveBg) box.style.backgroundColor = effectiveBg;
        const radius = inst.customProps?.borderRadius ?? inst.customProps?.bgRadius ?? 4;
        box.style.borderRadius = `${radius}px`;
      }
      if (fill) {
        fill.style.width = boost + "%";
        let color = inst.customProps?.colorHigh || "#10b981";
        let blink = false;
        if (boost < 12) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = inst.customProps?.enableBlink !== false && inst.componentType !== "element-boost-bar-no-blink";
        } else if (boost < 30) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = false;
        } else if (boost < 60) {
          color = inst.customProps?.colorMid || "#f59e0b";
          blink = false;
        } else {
          color = inst.customProps?.colorHigh || "#10b981";
          blink = false;
        }
        fill.style.backgroundColor = color;
        fill.classList.toggle("danger-blink", blink);
      }
      break;
    }

    // Boost Progress Bar (Vertical)
    case "element-vertical-boost-bar": {
      const box = container.querySelector<HTMLElement>(".el-v-boost-bar-box, .dyn-v-boost-box");
      const fill = container.querySelector<HTMLElement>(".dyn-v-boost-fill, .el-v-boost-bar-fill");
      if (box) {
        const effectiveBg = resolveEffectiveColor(
          inst.customProps?.bgColorMode,
          inst.customProps?.bgColor,
          inst.followGlobal !== false ? (globalSettings.bgColor || globalSettings.cardBgColor) : undefined,
          inst.followGlobal !== false,
          telemetry,
          "rgba(0, 0, 0, 0.65)"
        );
        if (effectiveBg) box.style.backgroundColor = effectiveBg;
        const radius = inst.customProps?.borderRadius ?? inst.customProps?.bgRadius ?? 4;
        box.style.borderRadius = `${radius}px`;
      }
      if (fill) {
        fill.style.height = boost + "%";
        let color = inst.customProps?.colorHigh || "#10b981";
        let blink = false;
        if (boost < 12) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = inst.customProps?.enableBlink !== false;
        } else if (boost < 30) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = false;
        } else if (boost < 60) {
          color = inst.customProps?.colorMid || "#f59e0b";
          blink = false;
        } else {
          color = inst.customProps?.colorHigh || "#10b981";
          blink = false;
        }
        fill.style.backgroundColor = color;
        fill.classList.toggle("danger-blink", blink);
      }
      break;
    }

    // Boost Alert Bar
    case "element-boost-alert-bar": {
      const box = container.querySelector<HTMLElement>(".el-boost-alert-box, .dyn-boost-alert-box");
      const threshold = Number(inst.customProps?.threshold ?? 12);
      const alertColor = inst.customProps?.alertColor || inst.customProps?.basicColor || "#ef4444";
      const radius = Number(inst.customProps?.borderRadius ?? inst.customProps?.bgRadius ?? 4);
      const borderWidth = Number(inst.customProps?.borderWidth ?? 2);
      const enableBlink = inst.customProps?.enableBlink !== false;

      if (box) {
        box.style.backgroundColor = "transparent";
        box.style.borderRadius = `${radius}px`;
        box.style.borderWidth = `${borderWidth}px`;
        box.style.setProperty("--alert-color", alertColor);

        const isAlert = boost <= threshold;
        if (isAlert) {
          box.style.borderStyle = "solid";
          if (enableBlink) {
            box.classList.add("alert-active");
            box.style.borderColor = alertColor;
            box.style.boxShadow = "";
          } else {
            box.classList.remove("alert-active");
            box.style.borderColor = alertColor;
            box.style.boxShadow = `0 0 16px ${alertColor}, inset 0 0 10px ${alertColor}`;
          }
        } else {
          box.classList.remove("alert-active");
          box.style.borderStyle = "solid";
          box.style.borderColor = "transparent";
          box.style.boxShadow = "none";
        }
      }
      break;
    }

    // Speed Progress Bar (Horizontal)
    case "element-speed-bar": {
      const box = container.querySelector<HTMLElement>(".el-speed-bar-box, .dyn-speed-box");
      const fill = container.querySelector<HTMLElement>(".dyn-speed-fill, .el-speed-bar-fill");
      if (box) {
        const effectiveBg = resolveEffectiveColor(
          inst.customProps?.bgColorMode,
          inst.customProps?.bgColor,
          inst.followGlobal !== false ? (globalSettings.bgColor || globalSettings.cardBgColor) : undefined,
          inst.followGlobal !== false,
          telemetry,
          "rgba(0, 0, 0, 0.65)"
        );
        if (effectiveBg) box.style.backgroundColor = effectiveBg;
        const radius = inst.customProps?.borderRadius ?? inst.customProps?.bgRadius ?? 4;
        box.style.borderRadius = `${radius}px`;
      }
      if (fill) {
        const uuSpeed = toRealUuSpeed(speed);
        const split1410Pos = Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40);
        const pct = calcNonlinearSpeedProgress(uuSpeed, split1410Pos);
        fill.style.transform = `scaleX(${pct / 100})`;
        const { color, isSupersonic } = calcSpeedColor(
          uuSpeed,
          inst.customProps?.colorLow || "#d4af37",
          inst.customProps?.colorMidStart || "#77ca7a",
          inst.customProps?.colorMidEnd || "#59f168"
        );
        fill.style.backgroundColor = color;
        fill.classList.toggle("supersonic-glow", isSupersonic);
        if (inst.customProps?.borderRadius !== undefined) {
          fill.style.borderRadius = inst.customProps.borderRadius + "px";
        }
      }
      break;
    }

    // Speed Progress Bar (Vertical)
    case "element-vertical-speed-bar": {
      const box = container.querySelector<HTMLElement>(".el-v-speed-bar-box, .dyn-v-speed-box");
      const fill = container.querySelector<HTMLElement>(".dyn-v-speed-fill, .el-v-speed-bar-fill");
      if (box) {
        const effectiveBg = resolveEffectiveColor(
          inst.customProps?.bgColorMode,
          inst.customProps?.bgColor,
          inst.followGlobal !== false ? (globalSettings.bgColor || globalSettings.cardBgColor) : undefined,
          inst.followGlobal !== false,
          telemetry,
          "rgba(0, 0, 0, 0.65)"
        );
        if (effectiveBg) box.style.backgroundColor = effectiveBg;
        const radius = inst.customProps?.borderRadius ?? inst.customProps?.bgRadius ?? 4;
        box.style.borderRadius = `${radius}px`;
      }
      if (fill) {
        const uuSpeed = toRealUuSpeed(speed);
        const split1410Pos = Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40);
        const pct = calcNonlinearSpeedProgress(uuSpeed, split1410Pos);
        fill.style.transform = `scaleY(${pct / 100})`;
        const { color, isSupersonic } = calcSpeedColor(
          uuSpeed,
          inst.customProps?.colorLow || "#d4af37",
          inst.customProps?.colorMidStart || "#77ca7a",
          inst.customProps?.colorMidEnd || "#59f168"
        );
        fill.style.backgroundColor = color;
        fill.classList.toggle("supersonic-glow", isSupersonic);
        if (inst.customProps?.borderRadius !== undefined) {
          fill.style.borderRadius = inst.customProps.borderRadius + "px";
        }
      }
      break;
    }

    // Curved SVG Gauges
    case "element-curved-boost-bar": {
      const box = container.querySelector<HTMLElement>(".curved-boost-container, .dyn-curved-container");
      if (box && inst.customProps?.bgColor) {
        box.style.backgroundColor = inst.customProps.bgColor;
      }
      const fill = container.querySelector<SVGCircleElement>(".dyn-curved-fill, .curved-progress-bar");
      const bg = container.querySelector<SVGCircleElement>(".dyn-curved-bg, .curved-bg-track");
      if (fill && bg) {
        const thick = Number(inst.customProps?.thickness ?? inst.customProps?.arcThickness ?? 8);
        const gap = Number(inst.customProps?.gap ?? (inst.customProps?.sweepAngle ? 360 - inst.customProps.sweepAngle : 90));
        const orient = Number(inst.customProps?.orientation ?? inst.customProps?.startAngle ?? 90);
        const trackColor = inst.customProps?.trackColor || "rgba(255, 255, 255, 0.15)";
        const radius = 50 - (thick / 2);
        const perimeter = 2 * Math.PI * radius;
        const activeAngle = 360 - gap;
        const totalDash = perimeter * (activeAngle / 360);
        const pct = Math.max(0, Math.min(1, boost / 100));
        const progressDash = totalDash * pct;
        const rotate = orient + (gap / 2);

        [bg, fill].forEach((el) => {
          el.setAttribute("r", radius.toString());
          el.setAttribute("stroke-width", thick.toString());
          el.style.transform = "rotate(" + rotate + "deg)";
          el.style.transformOrigin = "center";
        });

        bg.setAttribute("stroke", trackColor);
        bg.setAttribute("stroke-dasharray", totalDash + " " + perimeter);

        let color = inst.customProps?.colorHigh || "#10b981";
        let blink = false;
        if (boost < 12) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = inst.customProps?.enableBlink !== false;
        } else if (boost < 30) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = false;
        } else if (boost < 60) {
          color = inst.customProps?.colorMid || "#f59e0b";
          blink = false;
        } else {
          color = inst.customProps?.colorHigh || "#10b981";
          blink = false;
        }

        fill.setAttribute("stroke", color);
        fill.setAttribute("stroke-dasharray", progressDash + " " + perimeter);
        fill.classList.toggle("danger-blink", blink);
      }
      break;
    }

    case "element-curved-speedometer": {
      const box = container.querySelector<HTMLElement>(".curved-speed-container, .dyn-curved-speed-container");
      if (box && inst.customProps?.bgColor) {
        box.style.backgroundColor = inst.customProps.bgColor;
      }
      const fill = container.querySelector<SVGCircleElement>(".dyn-curved-fill, .curved-progress-bar");
      const bg = container.querySelector<SVGCircleElement>(".dyn-curved-bg, .curved-bg-track");
      if (fill && bg) {
        const thick = Number(inst.customProps?.thickness ?? inst.customProps?.arcThickness ?? 8);
        const gap = Number(inst.customProps?.gap ?? (inst.customProps?.sweepAngle ? 360 - inst.customProps.sweepAngle : 90));
        const orient = Number(inst.customProps?.orientation ?? inst.customProps?.startAngle ?? 90);
        const trackColor = inst.customProps?.trackColor || "rgba(255, 255, 255, 0.15)";
        const radius = 50 - (thick / 2);
        const perimeter = 2 * Math.PI * radius;
        const activeAngle = 360 - gap;
        const totalDash = perimeter * (activeAngle / 360);
        const uuSpeed = toRealUuSpeed(speed);
        const split1410Pos = Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40);
        const pct = calcNonlinearSpeedProgress(uuSpeed, split1410Pos);
        const progressDash = totalDash * (pct / 100);
        const rotate = orient + (gap / 2);

        [bg, fill].forEach((el) => {
          el.setAttribute("r", radius.toString());
          el.setAttribute("stroke-width", thick.toString());
          el.style.transform = "rotate(" + rotate + "deg)";
          el.style.transformOrigin = "center";
        });

        bg.setAttribute("stroke", trackColor);
        bg.setAttribute("stroke-dasharray", totalDash + " " + perimeter);

        const { color, isSupersonic } = calcSpeedColor(
          uuSpeed,
          inst.customProps?.colorLow || "#d4af37",
          inst.customProps?.colorMidStart || "#77ca7a",
          inst.customProps?.colorMidEnd || "#59f168"
        );

        fill.setAttribute("stroke", color);
        fill.setAttribute("stroke-dasharray", progressDash + " " + perimeter);
        fill.classList.toggle("curved-supersonic", isSupersonic);
      }
      break;
    }

    // Composite Widgets
    case "score-diff":
    case "widget-score-diff": {
      const valEl = container.querySelector<HTMLElement>(".score-diff-val, .dyn-val");
      if (valEl) {
        valEl.textContent = formatScoreDiff(telemetry.scoreDiff);
        valEl.classList.toggle("score-pos", telemetry.scoreDiff > 0);
        valEl.classList.toggle("score-neg", telemetry.scoreDiff < 0);
        valEl.classList.toggle("score-tie", telemetry.scoreDiff === 0);
      }
      const subVal = container.querySelector<HTMLElement>(".dyn-sub-val");
      if (subVal) subVal.textContent = `${telemetry.myScore}-${telemetry.oppScore}`;
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "time-remaining":
    case "widget-time-remaining": {
      const valEl = container.querySelector<HTMLElement>(".dyn-time-val, .dyn-val, .hud-val-countdown");
      if (valEl) valEl.textContent = formatMinutesSeconds(telemetry.timeSeconds);
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "overtime-status":
    case "widget-overtime-status": {
      const dot = container.querySelector<HTMLElement>(".dyn-dot, .status-dot");
      if (dot) {
        dot.className = "status-dot dyn-dot " + (telemetry.bOvertime ? "bool-on ot-active" : "bool-off ot-inactive");
      }
      const label = container.querySelector<HTMLElement>(".hud-bool-text, .dyn-label");
      if (label) {
        label.textContent = "OVERTIME";
      }
      applyTextStyles(container, inst, telemetry, telemetry.bOvertime ? "#f59e0b" : undefined);
      break;
    }

    case "ball-speed":
    case "widget-ball-speed": {
      const labelEl = container.querySelector<HTMLElement>(".dyn-label, .hud-label");
      const valEl = container.querySelector<HTMLElement>(".dyn-ball-val, .dyn-val");
      if (labelEl) {
        labelEl.textContent = `BALL SPEED (${inst.speedUnit === "uu/s" ? "UU/S" : "KM/H"})`;
      }
      if (valEl) valEl.textContent = formatSpeed(telemetry.ballSpeed, inst.speedUnit);
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "ball-team":
    case "widget-ball-team": {
      const valEl = container.querySelector<HTMLElement>(".dyn-ball-team-val, .dyn-val");
      if (valEl) {
        valEl.textContent = telemetry.ballTeamNum === 0 ? "BLUE" : "ORANGE";
        valEl.style.color = telemetry.ballTeamNum === 0 ? myTeamColor : oppTeamColor;
      }
      applyTextStyles(container, inst, telemetry, telemetry.ballTeamNum === 0 ? myTeamColor : oppTeamColor);
      break;
    }

    case "team-colors":
    case "widget-team-colors": {
      const myPrimary = container.querySelector<HTMLElement>(".dyn-my-primary, .my-color-block");
      const mySecondary = container.querySelector<HTMLElement>(".dyn-my-secondary");
      const oppPrimary = container.querySelector<HTMLElement>(".dyn-opp-primary, .opp-color-block");
      const oppSecondary = container.querySelector<HTMLElement>(".dyn-opp-secondary");

      if (myPrimary) myPrimary.style.backgroundColor = myTeamColor;
      if (mySecondary) mySecondary.style.backgroundColor = telemetry.mySecondaryColor || "#E5E5E5";
      if (oppPrimary) oppPrimary.style.backgroundColor = oppTeamColor;
      if (oppSecondary) oppSecondary.style.backgroundColor = telemetry.oppSecondaryColor || "#E5E5E5";
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "player-name":
    case "widget-player-name": {
      const badge = container.querySelector<HTMLElement>(".dyn-badge, .hud-player-badge");
      if (badge) badge.textContent = (inst.targetPlayer || "p1").toUpperCase();
      const nameEl = container.querySelector<HTMLElement>(".dyn-name, .dyn-val, .hud-player-name");
      if (nameEl) nameEl.textContent = name;
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "player-speed":
    case "widget-player-speed": {
      const labelEl = container.querySelector<HTMLElement>(".dyn-label, .hud-label");
      const valEl = container.querySelector<HTMLElement>(".dyn-speed-val, .dyn-val");
      if (labelEl) {
        labelEl.textContent = `${(inst.targetPlayer || "p1").toUpperCase()} SPEED (${inst.speedUnit === "uu/s" ? "UU/S" : "KM/H"})`;
      }
      if (valEl) valEl.textContent = formatSpeed(speed, inst.speedUnit);
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "boost-val":
    case "player-boost-val":
    case "widget-boost-val": {
      const labelEl = container.querySelector<HTMLElement>(".dyn-label, .hud-label");
      if (labelEl) {
        labelEl.textContent = `${(inst.targetPlayer || "p1").toUpperCase()} BOOST`;
      }
      const valEl = container.querySelector<HTMLElement>(".dyn-boost-val, .dyn-val, .hud-boost-val");
      if (valEl) valEl.textContent = boost.toString();
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "boost-bar":
    case "player-boost-bar":
    case "widget-boost-bar": {
      const fill = container.querySelector<HTMLElement>(".dyn-boost-fill, .hud-boost-bar-fill");
      if (fill) {
        fill.style.width = boost + "%";
        let color = inst.customProps?.colorHigh || "#10b981";
        let blink = false;
        if (boost < 12) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = inst.customProps?.enableBlink !== false;
        } else if (boost < 30) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = false;
        } else if (boost < 60) {
          color = inst.customProps?.colorMid || "#f59e0b";
          blink = false;
        } else {
          color = inst.customProps?.colorHigh || "#10b981";
          blink = false;
        }
        fill.style.backgroundColor = color;
        fill.classList.toggle("danger-blink", blink);
        fill.classList.toggle("glow-red", blink);
      }
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "boost-combo":
    case "widget-boost-combo": {
      const tagEl = container.querySelector<HTMLElement>(".dyn-player-label, .widget-tag");
      if (tagEl) {
        tagEl.textContent = `${(inst.targetPlayer || "p1").toUpperCase()} BOOST`;
      }
      const valEl = container.querySelector<HTMLElement>(".dyn-val, .dyn-boost-val, .widget-boost-val");
      const fill = container.querySelector<HTMLElement>(".dyn-boost-fill, .widget-bar-fill");
      if (valEl) valEl.textContent = boost.toString();
      if (fill) {
        fill.style.width = boost + "%";
        let color = inst.customProps?.colorHigh || "#10b981";
        let blink = false;
        if (boost < 12) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = inst.customProps?.enableBlink !== false;
        } else if (boost < 30) {
          color = inst.customProps?.colorLow || "#ef4444";
          blink = false;
        } else if (boost < 60) {
          color = inst.customProps?.colorMid || "#f59e0b";
          blink = false;
        } else {
          color = inst.customProps?.colorHigh || "#10b981";
          blink = false;
        }
        fill.style.backgroundColor = color;
        fill.classList.toggle("danger-blink", blink);
        fill.classList.toggle("glow-red", blink);
      }
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "player-status":
    case "widget-player-status": {
      const dot = container.querySelector<HTMLElement>(".dyn-dot, .status-dot");
      const label = container.querySelector<HTMLElement>(".dyn-label, .hud-bool-text");
      const boolVar = inst.customProps?.boolVar || "supersonic";
      let stateVal = false;
      if (boolVar === "supersonic") stateVal = supersonic;
      else if (boolVar === "boosting") stateVal = isBoosting;
      else if (boolVar === "hascar") stateVal = hasCar;
      else if (boolVar === "onground") stateVal = onGround;
      else if (boolVar === "onwall") stateVal = onWall;
      else if (boolVar === "powersliding") stateVal = powersliding;
      else if (boolVar === "demolished") stateVal = demolished;

      const isFiltered = inst.customProps?.invertBool ? !stateVal : Boolean(stateVal);
      if (dot) {
        dot.className = "status-dot dyn-dot " + (isFiltered ? "bool-on active" : "bool-off");
      }
      if (label) {
        label.textContent = inst.customProps?.customText || `${(inst.targetPlayer || "p1").toUpperCase()} SUPERSONIC`;
      }
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    // Panels
    case "panel-match-header": {
      const diffVal = container.querySelector<HTMLElement>(".dyn-diff-val, .score-diff-val");
      if (diffVal) {
        diffVal.textContent = formatScoreDiff(telemetry.scoreDiff);
        diffVal.classList.toggle("score-pos", telemetry.scoreDiff > 0);
        diffVal.classList.toggle("score-neg", telemetry.scoreDiff < 0);
        diffVal.classList.toggle("score-tie", telemetry.scoreDiff === 0);
      }
      const scoreText = container.querySelector<HTMLElement>(".dyn-score-text");
      if (scoreText) {
        scoreText.textContent = `${telemetry.myScore} - ${telemetry.oppScore}`;
      }
      const timeVal = container.querySelector<HTMLElement>(".dyn-time-val, .time-clock");
      if (timeVal) {
        timeVal.textContent = formatMinutesSeconds(telemetry.timeSeconds);
      }
      const otVal = container.querySelector<HTMLElement>(".dyn-ot-val");
      if (otVal) {
        otVal.textContent = telemetry.bOvertime ? "OVERTIME" : "REGULAR";
        otVal.style.color = telemetry.bOvertime ? "#f59e0b" : "#64748b";
      }
      const ballVal = container.querySelector<HTMLElement>(".dyn-ball-val");
      if (ballVal) {
        ballVal.textContent = `${formatSpeed(telemetry.ballSpeed, inst.speedUnit)} ${inst.speedUnit === "uu/s" ? "uu/s" : "km/h"}`;
      }
      const usColor = container.querySelector<HTMLElement>(".dyn-us-color");
      if (usColor) {
        usColor.style.backgroundColor = myTeamColor;
      }
      const oppColor = container.querySelector<HTMLElement>(".dyn-opp-color");
      if (oppColor) {
        oppColor.style.backgroundColor = oppTeamColor;
      }
      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "panel-player-telemetry": {
      const tagEl = container.querySelector<HTMLElement>(".dyn-tag, .player-tag");
      if (tagEl) {
        tagEl.textContent = `${p.toUpperCase()} ${p === "p1" ? "(TARGET)" : ""}`;
      }
      const nameEl = container.querySelector<HTMLElement>(".dyn-name, .dyn-p-name, .player-name-val");
      if (nameEl) nameEl.textContent = name;

      const spdEl = container.querySelector<HTMLElement>(".dyn-speed-val, .dyn-p-speed");
      if (spdEl) spdEl.textContent = formatSpeed(speed, inst.speedUnit);

      const bVal = container.querySelector<HTMLElement>(".dyn-boost-val, .dyn-p-boost-val");
      if (bVal) bVal.textContent = boost.toString();

      const bFill = container.querySelector<HTMLElement>(".dyn-boost-bar, .dyn-p-boost-fill, .boost-bar-fill");
      if (bFill) {
        bFill.style.width = boost + "%";
        let color = inst.customProps?.colorHigh || "#10b981";
        if (boost < 30) {
          color = inst.customProps?.colorLow || "#ef4444";
        } else if (boost < 60) {
          color = inst.customProps?.colorMid || "#f59e0b";
        }
        bFill.style.backgroundColor = color;
      }

      // Boolean indicators in grid
      const dotCar = container.querySelector<HTMLElement>(".dyn-hascar");
      const dotBoost = container.querySelector<HTMLElement>(".dyn-boosting");
      const dotGround = container.querySelector<HTMLElement>(".dyn-onground");
      const dotWall = container.querySelector<HTMLElement>(".dyn-onwall");
      const dotSlide = container.querySelector<HTMLElement>(".dyn-slide");
      const dotDemo = container.querySelector<HTMLElement>(".dyn-demo");
      const dotSuper = container.querySelector<HTMLElement>(".dyn-super");

      if (dotCar) dotCar.className = "status-dot dyn-hascar " + (hasCar ? "bool-on" : "bool-off");
      if (dotBoost) dotBoost.className = "status-dot dyn-boosting " + (isBoosting ? "bool-on" : "bool-off");
      if (dotGround) dotGround.className = "status-dot dyn-onground " + (onGround ? "bool-on" : "bool-off");
      if (dotWall) dotWall.className = "status-dot dyn-onwall " + (onWall ? "bool-on" : "bool-off");
      if (dotSlide) dotSlide.className = "status-dot dyn-slide " + (powersliding ? "bool-on" : "bool-off");
      if (dotDemo) dotDemo.className = "status-dot dyn-demo " + (demolished ? "bool-on" : "bool-off");
      if (dotSuper) dotSuper.className = "status-dot dyn-super " + (supersonic ? "bool-on" : "bool-off");

      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    case "panel-team-roster": {
      const p1Name = container.querySelector<HTMLElement>(".dyn-p1-name, .roster-p1-name");
      const p1BVal = container.querySelector<HTMLElement>(".dyn-p1-val, .roster-p1-boost");
      const p1Fill = container.querySelector<HTMLElement>(".dyn-p1-fill");

      const p2Name = container.querySelector<HTMLElement>(".dyn-p2-name, .roster-p2-name");
      const p2BVal = container.querySelector<HTMLElement>(".dyn-p2-val, .roster-p2-boost");
      const p2Fill = container.querySelector<HTMLElement>(".dyn-p2-fill");

      const p3Name = container.querySelector<HTMLElement>(".dyn-p3-name, .roster-p3-name");
      const p3BVal = container.querySelector<HTMLElement>(".dyn-p3-val, .roster-p3-boost");
      const p3Fill = container.querySelector<HTMLElement>(".dyn-p3-fill");

      if (p1Name) p1Name.textContent = telemetry.p1Name;
      if (p1BVal) p1BVal.textContent = telemetry.p1Boost.toString();
      if (p1Fill) {
        p1Fill.style.width = telemetry.p1Boost + "%";
        p1Fill.style.backgroundColor = telemetry.p1Boost < 30 ? "#ef4444" : (telemetry.p1Boost < 60 ? "#f59e0b" : "#10b981");
      }

      if (p2Name) p2Name.textContent = telemetry.p2Name;
      if (p2BVal) p2BVal.textContent = telemetry.p2Boost.toString();
      if (p2Fill) {
        p2Fill.style.width = telemetry.p2Boost + "%";
        p2Fill.style.backgroundColor = telemetry.p2Boost < 30 ? "#ef4444" : (telemetry.p2Boost < 60 ? "#f59e0b" : "#10b981");
      }

      if (p3Name) p3Name.textContent = telemetry.p3Name;
      if (p3BVal) p3BVal.textContent = telemetry.p3Boost.toString();
      if (p3Fill) {
        p3Fill.style.width = telemetry.p3Boost + "%";
        p3Fill.style.backgroundColor = telemetry.p3Boost < 30 ? "#ef4444" : (telemetry.p3Boost < 60 ? "#f59e0b" : "#10b981");
      }

      applyTextStyles(container, inst, telemetry, undefined);
      break;
    }

    default:
      if (isTextComponent(inst.componentType)) {
        applyTextStyles(container, inst, telemetry, undefined);
      }
      break;
  }
}
