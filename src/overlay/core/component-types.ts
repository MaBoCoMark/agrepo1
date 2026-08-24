import { ColorSource, TeamColors } from './team-colors';
export * from './team-colors';

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

export type TargetPlayer = 'p1' | 'p2' | 'p3';
export type SpeedUnit = 'kph' | 'uu/s';
export type ComponentTier = 'element' | 'widget' | 'panel';
export type TextAlignment = 'left' | 'center' | 'right';

export interface TelemetryBuffer {
  // Global Parameters
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

  // Player 1 (10 Parameters)
  p1Name: string;
  p1Speed: number;
  p1Boost: number;
  p1HasCar: boolean;
  p1Boosting: boolean;
  p1OnGround: boolean;
  p1OnWall: boolean;
  p1Powersliding: boolean;
  p1Demolished: boolean;
  p1Supersonic: boolean;

  // Player 2 (10 Parameters)
  p2Name: string;
  p2Speed: number;
  p2Boost: number;
  p2HasCar: boolean;
  p2Boosting: boolean;
  p2OnGround: boolean;
  p2OnWall: boolean;
  p2Powersliding: boolean;
  p2Demolished: boolean;
  p2Supersonic: boolean;

  // Player 3 (10 Parameters)
  p3Name: string;
  p3Speed: number;
  p3Boost: number;
  p3HasCar: boolean;
  p3Boosting: boolean;
  p3OnGround: boolean;
  p3OnWall: boolean;
  p3Powersliding: boolean;
  p3Demolished: boolean;
  p3Supersonic: boolean;
}

export interface CustomPropertyDef {
  key: string;
  label: string;
  type: 'number' | 'color' | 'string' | 'boolean' | 'select';
  options?: string[];
  unit?: string;
  default: any;
  min?: number;
  max?: number;
  step?: number;
}

export interface ComponentBindingDef {
  target: string;
  type?: 'speed' | 'time' | 'score-diff' | 'boolean' | 'progress-bar' | 'curved-gauge' | 'color-box' | 'text';
}

export interface ComponentMeta {
  id: string;
  displayName: string;
  tier: ComponentTier;
  category: 'global' | 'player';
  isProportional: boolean; // default aspect ratio behaviour
  supportsSpeedUnit?: boolean;
  supportsAlignment?: boolean;
  supportsGlobalStyle?: boolean;
  defaultWidthVw: number;
  defaultHeightVw: number;
  minWidthVw: number;
  minHeightVw: number;
  baseWidthPx: number;
  baseHeightPx: number;
  binding?: ComponentBindingDef;
  supportedBindings?: string[];
  defaultBinding?: string;
  customProperties?: CustomPropertyDef[];
}

export interface GlobalLayoutSettings {
  opacity: number; // 0.0 - 1.0
  textColor: string;
  strokeWidth: number;
  strokeColor: string;
  bgColor: string;
  bgRadius: number;
  autoHideNonExistingPlayers?: boolean;
  cardBgColor?: string;
  cardBorderRadius?: number;
  teamColors?: TeamColors;
}

export interface ComponentInstanceCustomProps {
  invertBool?: boolean;
  textColorMode?: ColorSource;
  textColor?: string;
  bgColorMode?: ColorSource;
  bgColor?: string;
  activeColorMode?: ColorSource;
  activeColor?: string;
  inactiveColor?: string;
  boxColorMode?: ColorSource;
  bgRadius?: number;
  borderRadius?: number;
  strokeWidth?: number;
  strokeColor?: string;
  customText?: string;
  staticText?: string;
  boolVar?: string;
  enabledOpacity?: number;
  disabledOpacity?: number;
  enableBlink?: boolean;
  threshold?: number;
  alertColor?: string;
  basicColor?: string;
  borderWidth?: number;
  showFill?: boolean;
  thickness?: number;
  gap?: number;
  orientation?: number;
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
  anchor: AnchorType;
  widthVw: number;
  heightVw: number;
  offsetXvw: number;
  offsetYvw: number;
  customProps?: ComponentInstanceCustomProps;
}
