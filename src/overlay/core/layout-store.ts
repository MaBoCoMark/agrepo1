import { ComponentInstance, AnchorType, TargetPlayer, SpeedUnit, TextAlignment, ComponentTier, ComponentInstanceCustomProps, GlobalLayoutSettings } from "./component-types";
import { COMPONENT_METAS } from "./component-registry";

const STORAGE_KEY = "rl_competitive_layout_v2";
const GLOBAL_SETTINGS_KEY = "rl_global_layout_settings_v1";

export const DEFAULT_GLOBAL_SETTINGS: GlobalLayoutSettings = {
  opacity: 1.0,
  textColor: "",
  strokeWidth: 0,
  strokeColor: "#000000",
  bgColor: "",
  bgRadius: 0,
  cardBgColor: "",
  cardBorderRadius: 0,
  autoHideNonExistingPlayers: true
};

export function loadGlobalLayoutSettings(): GlobalLayoutSettings {
  try {
    const raw = localStorage.getItem(GLOBAL_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const bg = typeof parsed.bgColor === "string" ? parsed.bgColor : (typeof parsed.cardBgColor === "string" ? parsed.cardBgColor : DEFAULT_GLOBAL_SETTINGS.bgColor);
      const rad = typeof parsed.bgRadius === "number" ? parsed.bgRadius : (typeof parsed.cardBorderRadius === "number" ? parsed.cardBorderRadius : DEFAULT_GLOBAL_SETTINGS.bgRadius);
      return {
        opacity: typeof parsed.opacity === "number" ? parsed.opacity : DEFAULT_GLOBAL_SETTINGS.opacity,
        textColor: typeof parsed.textColor === "string" ? parsed.textColor : DEFAULT_GLOBAL_SETTINGS.textColor,
        strokeWidth: typeof parsed.strokeWidth === "number" ? parsed.strokeWidth : DEFAULT_GLOBAL_SETTINGS.strokeWidth,
        strokeColor: typeof parsed.strokeColor === "string" ? parsed.strokeColor : DEFAULT_GLOBAL_SETTINGS.strokeColor,
        bgColor: bg,
        bgRadius: rad,
        cardBgColor: bg,
        cardBorderRadius: rad,
        autoHideNonExistingPlayers: typeof parsed.autoHideNonExistingPlayers === "boolean" ? parsed.autoHideNonExistingPlayers : DEFAULT_GLOBAL_SETTINGS.autoHideNonExistingPlayers
      };
    }
  } catch (e) {
    console.warn("Failed to load global layout settings", e);
  }
  return { ...DEFAULT_GLOBAL_SETTINGS };
}

export function saveGlobalLayoutSettings(settings: GlobalLayoutSettings): void {
  try {
    if (settings.cardBgColor && !settings.bgColor) settings.bgColor = settings.cardBgColor;
    if (settings.bgColor && !settings.cardBgColor) settings.cardBgColor = settings.bgColor;
    if (settings.cardBorderRadius !== undefined && settings.bgRadius === undefined) settings.bgRadius = settings.cardBorderRadius;
    if (settings.bgRadius !== undefined && settings.cardBorderRadius === undefined) settings.cardBorderRadius = settings.bgRadius;
    localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save global layout settings", e);
  }
}

export function getScreenHeightVw(): number {
  if (typeof window === "undefined" || !window.innerWidth) return 56.25; // 16:9 fallback
  return (window.innerHeight / window.innerWidth) * 100;
}

export function isTextComponent(type: string): boolean {
  return [
    "element-boost-text",
    "element-boost-text-fixed",
    "element-speed-text",
    "element-player-name-text",
    "element-time-text",
    "element-system-time",
    "element-global-text-indicator",
    "element-ball-speed-text",
    "element-ball-team-text",
    "element-score-diff-text",
    "element-match-score-text",
    "element-my-score-text",
    "element-opp-score-text",
    "element-static-text",
    "element-custom-text",
    "custom-text",
    "score-diff",
    "widget-score-diff",
    "time-remaining",
    "widget-time-remaining",
    "overtime-status",
    "widget-overtime-status",
    "ball-speed",
    "widget-ball-speed",
    "ball-team",
    "widget-ball-team",
    "player-name",
    "widget-player-name",
    "player-speed",
    "widget-player-speed",
    "boost-val",
    "player-boost-val",
    "widget-boost-val",
    "boost-combo",
    "widget-boost-combo",
    "player-status",
    "widget-player-status",
    "panel-match-header",
    "panel-player-telemetry",
    "panel-team-roster"
  ].includes(type);
}

export function getAnchorCoordinates(anchor: AnchorType, screenHeightVw: number): { x: number; y: number } {
  switch (anchor) {
    case "top-left":
      return { x: 0, y: 0 };
    case "top-center":
      return { x: 50, y: 0 };
    case "top-right":
      return { x: 100, y: 0 };
    case "center-left":
      return { x: 0, y: screenHeightVw / 2 };
    case "center":
      return { x: 50, y: screenHeightVw / 2 };
    case "center-right":
      return { x: 100, y: screenHeightVw / 2 };
    case "bottom-left":
      return { x: 0, y: screenHeightVw };
    case "bottom-center":
      return { x: 50, y: screenHeightVw };
    case "bottom-right":
      return { x: 100, y: screenHeightVw };
  }
}

export function getDefaultOffsetForAnchor(anchor: AnchorType): { offsetXvw: number; offsetYvw: number } {
  switch (anchor) {
    case "top-left":
      return { offsetXvw: 5, offsetYvw: 5 };
    case "top-center":
      return { offsetXvw: 0, offsetYvw: 5 };
    case "top-right":
      return { offsetXvw: -5, offsetYvw: 5 };
    case "center-left":
      return { offsetXvw: 5, offsetYvw: 0 };
    case "center":
      return { offsetXvw: 0, offsetYvw: 0 };
    case "center-right":
      return { offsetXvw: -5, offsetYvw: 0 };
    case "bottom-left":
      return { offsetXvw: 5, offsetYvw: -5 };
    case "bottom-center":
      return { offsetXvw: 0, offsetYvw: -5 };
    case "bottom-right":
      return { offsetXvw: -5, offsetYvw: -5 };
  }
}

export function calculateElementTopLeft(
  inst: ComponentInstance,
  screenHeightVw: number
): { leftVw: number; topVw: number } {
  const anchorPos = getAnchorCoordinates(inst.anchor, screenHeightVw);
  return {
    leftVw: anchorPos.x + inst.offsetXvw - inst.widthVw / 2,
    topVw: anchorPos.y + inst.offsetYvw - inst.heightVw / 2
  };
}

export function calculateOffsetFromTopLeft(
  anchor: AnchorType,
  leftVw: number,
  topVw: number,
  widthVw: number,
  heightVw: number,
  screenHeightVw: number
): { offsetXvw: number; offsetYvw: number } {
  const anchorPos = getAnchorCoordinates(anchor, screenHeightVw);
  const centerX = leftVw + widthVw / 2;
  const centerY = topVw + heightVw / 2;
  return {
    offsetXvw: parseFloat((centerX - anchorPos.x).toFixed(2)),
    offsetYvw: parseFloat((centerY - anchorPos.y).toFixed(2))
  };
}

export function getDefaultCompetitiveLayout(): ComponentInstance[] {
  return [
    // Top-Center: Score Diff, Time, Overtime, Ball Speed
    {
      instanceId: "comp_score_diff",
      componentType: "score-diff",
      tier: "widget",
      category: "global",
      opacity: 1.0,
      anchor: "top-center",
      widthVw: 12,
      heightVw: 4.5,
      offsetXvw: -14,
      offsetYvw: 4.0,
      followAspectRatio: true,
      followGlobal: true
    },
    {
      instanceId: "comp_time",
      componentType: "time-remaining",
      tier: "widget",
      category: "global",
      opacity: 1.0,
      anchor: "top-center",
      widthVw: 10,
      heightVw: 4.5,
      offsetXvw: 0,
      offsetYvw: 4.0,
      followAspectRatio: true,
      followGlobal: true
    },
    {
      instanceId: "comp_overtime",
      componentType: "overtime-status",
      tier: "widget",
      category: "global",
      opacity: 1.0,
      anchor: "top-center",
      widthVw: 9,
      heightVw: 4.5,
      offsetXvw: 11,
      offsetYvw: 4.0,
      followAspectRatio: true,
      followGlobal: true
    },
    {
      instanceId: "comp_ball_speed",
      componentType: "ball-speed",
      tier: "widget",
      category: "global",
      speedUnit: "kph",
      opacity: 1.0,
      anchor: "top-center",
      widthVw: 10,
      heightVw: 4.5,
      offsetXvw: 22,
      offsetYvw: 4.0,
      followAspectRatio: true,
      followGlobal: true
    },
    {
      instanceId: "comp_team_colors",
      componentType: "team-colors",
      tier: "widget",
      category: "global",
      opacity: 1.0,
      anchor: "top-right",
      widthVw: 11,
      heightVw: 4.5,
      offsetXvw: -8,
      offsetYvw: 4.0,
      followAspectRatio: true,
      followGlobal: true
    },

    // Bottom-Right: P1 Boost Bar, Boost Number, P1 Speed
    {
      instanceId: "comp_p1_boost_bar",
      componentType: "element-boost-bar",
      tier: "element",
      category: "player",
      targetPlayer: "p1",
      opacity: 1.0,
      anchor: "bottom-right",
      widthVw: 18,
      heightVw: 1.8,
      offsetXvw: -11,
      offsetYvw: -4.5,
      followAspectRatio: false,
      followGlobal: false,
      customProps: {
        enableBlink: true,
        bgColor: "rgba(0, 0, 0, 0.65)",
        borderRadius: 4
      }
    },
    {
      instanceId: "comp_p1_boost_text",
      componentType: "element-boost-text",
      tier: "element",
      category: "player",
      targetPlayer: "p1",
      textAlign: "right",
      opacity: 1.0,
      anchor: "bottom-right",
      widthVw: 6,
      heightVw: 3.5,
      offsetXvw: -5,
      offsetYvw: -8.5,
      followAspectRatio: true,
      followGlobal: false,
      customProps: {
        enableBlink: true
      }
    },
    {
      instanceId: "comp_p1_speed_text",
      componentType: "element-speed-text",
      tier: "element",
      category: "player",
      targetPlayer: "p1",
      speedUnit: "kph",
      textAlign: "right",
      opacity: 1.0,
      anchor: "bottom-right",
      widthVw: 7,
      heightVw: 3.5,
      offsetXvw: -13,
      offsetYvw: -8.5,
      followAspectRatio: true,
      followGlobal: true
    },
    {
      instanceId: "comp_p1_supersonic",
      componentType: "element-supersonic-indicator",
      tier: "element",
      category: "player",
      targetPlayer: "p1",
      opacity: 1.0,
      anchor: "bottom-right",
      widthVw: 2.5,
      heightVw: 2.5,
      offsetXvw: -19,
      offsetYvw: -8.5,
      followAspectRatio: true,
      followGlobal: false
    },

    // Bottom-Left: P2 & P3 Teammate Boost Bars & Names
    {
      instanceId: "comp_p2_name",
      componentType: "element-player-name-text",
      tier: "element",
      category: "player",
      targetPlayer: "p2",
      textAlign: "left",
      opacity: 0.9,
      anchor: "bottom-left",
      widthVw: 11,
      heightVw: 2.8,
      offsetXvw: 7.5,
      offsetYvw: -10.0,
      followAspectRatio: false,
      followGlobal: true
    },
    {
      instanceId: "comp_p2_boost_bar",
      componentType: "element-boost-bar",
      tier: "element",
      category: "player",
      targetPlayer: "p2",
      opacity: 0.9,
      anchor: "bottom-left",
      widthVw: 11,
      heightVw: 1.2,
      offsetXvw: 7.5,
      offsetYvw: -7.5,
      followAspectRatio: false,
      followGlobal: false,
      customProps: {
        enableBlink: false,
        bgColor: "rgba(0, 0, 0, 0.65)",
        borderRadius: 4
      }
    },
    {
      instanceId: "comp_p3_name",
      componentType: "element-player-name-text",
      tier: "element",
      category: "player",
      targetPlayer: "p3",
      textAlign: "left",
      opacity: 0.9,
      anchor: "bottom-left",
      widthVw: 11,
      heightVw: 2.8,
      offsetXvw: 7.5,
      offsetYvw: -4.8,
      followAspectRatio: false,
      followGlobal: true
    },
    {
      instanceId: "comp_p3_boost_bar",
      componentType: "element-boost-bar",
      tier: "element",
      category: "player",
      targetPlayer: "p3",
      opacity: 0.9,
      anchor: "bottom-left",
      widthVw: 11,
      heightVw: 1.2,
      offsetXvw: 7.5,
      offsetYvw: -2.3,
      followAspectRatio: false,
      followGlobal: false,
      customProps: {
        enableBlink: false,
        bgColor: "rgba(0, 0, 0, 0.65)",
        borderRadius: 4
      }
    }
  ];
}

export function loadCompetitiveLayout(): ComponentInstance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.every((inst) => inst && inst.instanceId && inst.componentType);
        if (valid) {
          // Normalize any legacy components
          return parsed.map((inst) => {
            if (inst.componentType === "element-boost-bar-no-blink") {
              inst.componentType = "element-boost-bar";
              inst.customProps = { ...inst.customProps, enableBlink: false };
            } else if (inst.componentType === "element-boost-text-fixed") {
              inst.componentType = "element-boost-text";
            }
            return inst;
          });
        }
      }
    }
  } catch (e) {
    console.warn("Fallback to default competitive layout:", e);
  }
  return getDefaultCompetitiveLayout();
}

export function saveCompetitiveLayout(layout: ComponentInstance[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.error("Failed to save competitive layout to localStorage", e);
  }
}

export function createNewComponentInstance(
  componentType: string,
  targetPlayer: TargetPlayer = "p1",
  speedUnit: SpeedUnit = "kph",
  textAlign: TextAlignment = "right",
  followAspect?: boolean,
  anchor: AnchorType = "center"
): ComponentInstance {
  const meta = COMPONENT_METAS[componentType] || {
    id: componentType,
    displayName: componentType,
    tier: "element" as ComponentTier,
    category: "global",
    isProportional: true,
    defaultWidthVw: 8,
    defaultHeightVw: 4.0,
    minWidthVw: 2,
    minHeightVw: 1
  };

  const customProps: ComponentInstanceCustomProps = {};

  if (componentType === "element-boost-alert-bar") {
    customProps.threshold = 12;
    customProps.borderRadius = 4;
    customProps.alertColor = "#ef4444";
    customProps.borderWidth = 2;
    customProps.enableBlink = true;
  } else if (componentType === "element-boost-bar" || componentType === "player-boost-bar" || componentType === "element-vertical-boost-bar" || componentType === "element-boost-text" || componentType === "widget-boost-bar" || componentType === "widget-boost-combo" || componentType === "boost-bar" || componentType === "boost-combo") {
    customProps.enableBlink = true;
    customProps.bgColor = "rgba(0, 0, 0, 0.65)";
    customProps.borderRadius = 4;
    customProps.colorHigh = "#10b981";
    customProps.colorMid = "#f59e0b";
    customProps.colorLow = "#ef4444";
  } else if (componentType === "element-curved-boost-bar") {
    customProps.thickness = 8;
    customProps.gap = 90;
    customProps.orientation = 90;
    customProps.trackColor = "rgba(255, 255, 255, 0.15)";
    customProps.enableBlink = true;
    customProps.bgColor = "transparent";
    customProps.colorHigh = "#10b981";
    customProps.colorMid = "#f59e0b";
    customProps.colorLow = "#ef4444";
  } else if (componentType === "element-speed-bar" || componentType === "element-vertical-speed-bar") {
    customProps.split1410Pos = 40;
    customProps.colorLow = "#d4af37";
    customProps.colorMidStart = "#77ca7a";
    customProps.colorMidEnd = "#59f168";
    customProps.borderRadius = 4;
    customProps.bgColor = "rgba(0, 0, 0, 0.65)";
  } else if (componentType === "element-curved-speedometer") {
    customProps.thickness = 8;
    customProps.gap = 90;
    customProps.orientation = 90;
    customProps.trackColor = "rgba(255, 255, 255, 0.15)";
    customProps.split1410Pos = 40;
    customProps.colorLow = "#d4af37";
    customProps.colorMidStart = "#77ca7a";
    customProps.colorMidEnd = "#59f168";
    customProps.bgColor = "transparent";
  } else if (componentType === "element-system-time") {
    customProps.textColorMode = "default";
    customProps.textColor = "#f8fafc";
    customProps.bgColor = "rgba(10, 14, 23, 0.85)";
    customProps.strokeWidth = 0;
    customProps.strokeColor = "#000000";
    customProps.bgRadius = 4;
  } else if (componentType === "element-global-text-indicator") {
    customProps.previewDemoText = false;
    customProps.textColorMode = "default";
    customProps.textColor = "#ffffff";
    customProps.strokeWidth = 0;
    customProps.strokeColor = "#000000";
    customProps.bgColor = "transparent";
    customProps.bgRadius = 0;
  } else if (componentType === "element-team-color-box") {
    customProps.boxColorMode = "my-primary";
    customProps.borderRadius = 4;
  } else if (componentType === "element-custom-text") {
    customProps.customText = "SUPERSONIC";
    customProps.boolVar = "supersonic";
    customProps.invertBool = false;
    customProps.enabledOpacity = 1.0;
    customProps.disabledOpacity = 0.2;
    customProps.textColorMode = "default";
    customProps.textColor = "#38bdf8";
    customProps.strokeWidth = 0;
    customProps.strokeColor = "#000000";
    customProps.bgColor = "rgba(10, 14, 23, 0.85)";
    customProps.bgRadius = 4;
  } else if (componentType === "element-static-text") {
    customProps.staticText = "LABEL";
    customProps.textColorMode = "default";
    customProps.textColor = "#ffffff";
    customProps.strokeWidth = 0;
    customProps.strokeColor = "#000000";
    customProps.bgColor = "rgba(0, 0, 0, 0)";
    customProps.bgRadius = 0;
  } else if (isTextComponent(componentType)) {
    customProps.textColorMode = "default";
    customProps.textColor = "";
    customProps.strokeWidth = 0;
    customProps.strokeColor = "#000000";
    customProps.bgColor = "rgba(0, 0, 0, 0)";
    customProps.bgRadius = 0;
  } else if (componentType.includes("indicator")) {
    customProps.invertBool = false;
    customProps.activeColorMode = "default";
  }

  const defaultOffset = getDefaultOffsetForAnchor(anchor);
  const id = "inst_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

  const hasBuiltInStyle = meta.supportsGlobalStyle === false ||
    componentType.includes("boost-bar") ||
    componentType.includes("boost-alert") ||
    componentType.includes("speed-bar") ||
    componentType.includes("curved-") ||
    componentType.includes("indicator") ||
    componentType === "element-boost-text";

  return {
    instanceId: id,
    componentType: meta.id,
    tier: meta.tier,
    category: meta.category,
    targetPlayer: meta.category === "player" ? targetPlayer : undefined,
    speedUnit: meta.supportsSpeedUnit ? speedUnit : undefined,
    textAlign: meta.supportsAlignment ? textAlign : undefined,
    followAspectRatio: followAspect !== undefined ? followAspect : meta.isProportional,
    followGlobal: !hasBuiltInStyle,
    opacity: 1.0,
    anchor: anchor,
    widthVw: meta.defaultWidthVw,
    heightVw: meta.defaultHeightVw,
    offsetXvw: defaultOffset.offsetXvw,
    offsetYvw: defaultOffset.offsetYvw,
    customProps
  };
}
