/**
 * ============================================================================
 * 🎨 Team Color Palette & Dynamics Engine
 * ============================================================================
 */

export interface TeamColors {
  myPrimaryColor: string;
  mySecondaryColor: string;
  oppPrimaryColor: string;
  oppSecondaryColor: string;
}

export const DEFAULT_TEAM_COLORS: TeamColors = {
  myPrimaryColor: '#1873FF',
  mySecondaryColor: '#00D2FF',
  oppPrimaryColor: '#C26418',
  oppSecondaryColor: '#FFAA00'
};

export type ColorSource =
  | 'default'
  | 'my-primary'
  | 'my-secondary'
  | 'opp-primary'
  | 'opp-secondary'
  | 'custom';

export const COLOR_SOURCE_OPTIONS: { label: string; value: ColorSource }[] = [
  { label: 'Follow Global / Default', value: 'default' },
  { label: 'My Team Primary', value: 'my-primary' },
  { label: 'My Team Secondary', value: 'my-secondary' },
  { label: 'Opponent Primary', value: 'opp-primary' },
  { label: 'Opponent Secondary', value: 'opp-secondary' },
  { label: 'Custom Hex / RGBA', value: 'custom' }
];

/**
 * 转换 Hex/RGB 颜色为 RGBA 格式
 */
export function hexToRgba(color: string, opacity: number): string {
  if (!color) return `rgba(255, 255, 255, ${opacity})`;
  if (color.startsWith('rgba')) {
    return color.replace(/[\d\.]+\)$/g, `${opacity})`);
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
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

/**
 * 统一解析组件生效颜色函数 (Resolve Effective Color)
 * 优先级规则:
 * 1. 若 followGlobal 为 true: 严格跟随全局配置 (globalColor)，若 globalColor 存在且非空则返回 globalColor，否则返回 fallbackColor
 * 2. 若 followGlobal 为 false (独立自定义模式):
 *    - 显式队伍颜色绑定 ('my-primary' | 'my-secondary' | 'opp-primary' | 'opp-secondary')
 *    - 独立自定义颜色 ('custom' 或设置了 customColor)
 *    - 降级 fallbackColor
 */
export function resolveEffectiveColor(
  colorMode: ColorSource | undefined,
  customColor: string | undefined,
  globalColor: string | undefined,
  followGlobal: boolean,
  telemetry?: {
    myPrimaryColor?: string;
    mySecondaryColor?: string;
    oppPrimaryColor?: string;
    oppSecondaryColor?: string;
  },
  fallbackColor?: string
): string {
  // 1. Follow Global Style 优先执行
  if (followGlobal) {
    if (globalColor && globalColor.trim().length > 0) {
      return globalColor;
    }
    return fallbackColor || '#ffffff';
  }

  // 2. 独立自定义模式 - 显式队伍颜色绑定
  if (colorMode === 'my-primary') {
    return (telemetry?.myPrimaryColor && telemetry.myPrimaryColor.length > 0)
      ? telemetry.myPrimaryColor
      : DEFAULT_TEAM_COLORS.myPrimaryColor;
  }
  if (colorMode === 'my-secondary') {
    return (telemetry?.mySecondaryColor && telemetry.mySecondaryColor.length > 0)
      ? telemetry.mySecondaryColor
      : DEFAULT_TEAM_COLORS.mySecondaryColor;
  }
  if (colorMode === 'opp-primary') {
    return (telemetry?.oppPrimaryColor && telemetry.oppPrimaryColor.length > 0)
      ? telemetry.oppPrimaryColor
      : DEFAULT_TEAM_COLORS.oppPrimaryColor;
  }
  if (colorMode === 'opp-secondary') {
    return (telemetry?.oppSecondaryColor && telemetry.oppSecondaryColor.length > 0)
      ? telemetry.oppSecondaryColor
      : DEFAULT_TEAM_COLORS.oppSecondaryColor;
  }

  // 3. 独立自定义模式 - 自定义颜色
  if (colorMode === 'custom' || (customColor && customColor.trim().length > 0)) {
    if (customColor && customColor.trim().length > 0) {
      return customColor;
    }
    return fallbackColor || '#ffffff';
  }

  return fallbackColor || '#ffffff';
}
