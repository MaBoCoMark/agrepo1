import type { ColorSource, TeamColors } from './team-colors';

export type { ColorSource, TeamColors };
export { DEFAULT_TEAM_COLORS } from "./team-colors";

export type ComponentTier = 'element' | 'widget' | 'panel';

export type TargetPlayer = 'p1' | 'p2' | 'p3';
export type SpeedUnit = 'kph' | 'uu/s';
export type TextAlignment = 'left' | 'center' | 'right';
export type AnchorType =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface GlobalLayoutSettings {
  opacity: number; // 0.1 - 1.0 (default 1.0)
  textColor: string; // Hex / RGBA (default #ffffff)
  strokeWidth: number; // 0 - 15 px (default 0)
  strokeColor: string; // Hex / RGBA (default #000000)
  cardBgColor: string; // Hex / RGBA (default #0a0e17)
  cardBorderRadius: number; // 0 - 25 px (default 0)
  bgColor?: string; // Backwards compatible alias
  bgRadius?: number; // Backwards compatible alias
  autoHideNonExistingPlayers?: boolean; // When true, hides P2/P3 HUD if hasCar is false
}

export interface CustomPropMeta {
  key: string;
  label: string;
  type: 'color' | 'number' | 'boolean' | 'string' | 'select';
  default: any;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface ComponentMeta {
  id: string;
  displayName: string;
  tier: ComponentTier;
  category: 'global' | 'player';
  isProportional?: boolean;
  supportsSpeedUnit?: boolean;
  supportsAlignment?: boolean;
  supportsGlobalStyle?: boolean; // When false, global styles don't force apply
  defaultWidthVw: number;
  defaultHeightVw: number;
  minWidthVw?: number;
  minHeightVw?: number;
  baseWidthPx?: number;
  baseHeightPx?: number;
  customProperties?: CustomPropMeta[];
}

export interface ComponentInstanceCustomProps {
  textColorMode?: ColorSource;
  textColor?: string;
  strokeWidth?: number;
  strokeColor?: string;
  bgColorMode?: ColorSource;
  bgColor?: string;
  bgRadius?: number;
  borderRadius?: number;
  boxColorMode?: ColorSource;
  activeColorMode?: ColorSource;
  activeColor?: string;
  inactiveColor?: string;
  invertBool?: boolean;
  customText?: string;
  staticText?: string;
  boolVar?: string;
  enabledOpacity?: number;
  disabledOpacity?: number;
  threshold?: number;
  borderWidth?: number;
  basicColor?: string;
  alertColor?: string;
  enableBlink?: boolean;
  thickness?: number;
  arcThickness?: number;
  gap?: number;
  sweepAngle?: number;
  orientation?: number;
  startAngle?: number;
  split1410Pos?: number;
  pos1410?: number;
  trackColor?: string;
  colorLow?: string;
  colorMidStart?: string;
  colorMidEnd?: string;
  colorMid?: string;
  colorHigh?: string;
  previewDemoText?: boolean;
  widthPx?: number;
  heightPx?: number;
  strokePx?: number;
  startAngleDeg?: number;
  endAngleDeg?: number;
  countdownColor?: string;
  roundStartColor?: string;
  fadeDuration?: number;
  showInitialFour?: boolean;
  [key: string]: any;
}

export interface ComponentInstance {
  instanceId: string;
  componentType: string;
  name?: string;
  tier?: ComponentTier;
  category: 'global' | 'player';
  targetPlayer?: TargetPlayer;
  speedUnit?: SpeedUnit;
  textAlign?: TextAlignment;
  followAspectRatio?: boolean; // when true, 8-point drag resizer keeps fixed ratio
  followGlobal?: boolean; // when true (default), inherits global styles (colors, stroke, opacity, bg)
  opacity: number; // 0.0 - 1.0
  anchor: AnchorType; // 9-grid anchor snap reference
  widthVw: number;
  heightVw: number;
  offsetXvw: number;
  offsetYvw: number;
  customProps?: ComponentInstanceCustomProps;
}

export interface TelemetryBuffer {
  // Global Match
  timeSeconds: number;
  bOvertime: boolean;
  ballSpeed: number;
  ballTeamNum: number;
  myTeamNum: number;
  myScore: number;
  oppScore: number;
  scoreDiff: number;
  myPrimaryColor: string;
  mySecondaryColor: string;
  oppPrimaryColor: string;
  oppSecondaryColor: string;

  // Target Player (P1)
  p1Speed: number;
  p1Boost: number;
  p1Name: string;
  p1HasCar: boolean;
  p1Boosting: boolean;
  p1OnGround: boolean;
  p1OnWall: boolean;
  p1Powersliding: boolean;
  p1Demolished: boolean;
  p1Supersonic: boolean;

  // Teammate 1 (P2)
  p2Speed: number;
  p2Boost: number;
  p2Name: string;
  p2HasCar: boolean;
  p2Boosting: boolean;
  p2OnGround: boolean;
  p2OnWall: boolean;
  p2Powersliding: boolean;
  p2Demolished: boolean;
  p2Supersonic: boolean;

  // Teammate 2 (P3)
  p3Speed: number;
  p3Boost: number;
  p3Name: string;
  p3HasCar: boolean;
  p3Boosting: boolean;
  p3OnGround: boolean;
  p3OnWall: boolean;
  p3Powersliding: boolean;
  p3Demolished: boolean;
  p3Supersonic: boolean;
}
