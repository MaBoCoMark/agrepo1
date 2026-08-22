/**
 * ============================================================================
 * 🎨 默认战队 / 队伍颜色配置 (Default Team Colors Configuration)
 * ============================================================================
 * 
 * 在对局没有任何 WebSocket 输入的前提下，系统默认采用以下 4 个队伍颜色：
 * 
 * 1. 我方 Primary (浅黄色 / Light Yellow):  #FACC15
 * 2. 我方 Secondary (深黄色 / Dark Yellow):  #CA8A04
 * 3. 对方 Primary (浅绿色 / Light Green):   #4ADE80
 * 4. 对方 Secondary (深绿色 / Dark Green):  #15803D
 * 
 * 👉 如果需要手动修改这四个默认颜色，直接修改下方 DEFAULT_TEAM_COLORS 中的 HEX 颜色值即可：
 */
export interface TeamColors {
  myPrimaryColor: string;
  mySecondaryColor: string;
  oppPrimaryColor: string;
  oppSecondaryColor: string;
}

export const DEFAULT_TEAM_COLORS: TeamColors = {
  myPrimaryColor: '#FACC15',    // 我方 primary (浅黄色 / Light Yellow)
  mySecondaryColor: '#CA8A04',  // 我方 secondary (深黄色 / Dark Yellow)
  oppPrimaryColor: '#4ADE80',   // 对方 primary (浅绿色 / Light Green)
  oppSecondaryColor: '#15803D', // 对方 secondary (深绿色 / Dark Green)
};

export type ColorSource =
  | 'default'       // 默认 (跟随全局设定 / Follow Global)
  | 'custom'        // 自定义颜色 (Custom Color)
  | 'my-primary'    // 我方 primary (动态绑定我方主色，默认浅黄)
  | 'my-secondary'  // 我方 secondary (动态绑定我方副色，默认深黄)
  | 'opp-primary'   // 对方 primary (动态绑定对方主色，默认浅绿)
  | 'opp-secondary';// 对方 secondary (动态绑定对方副色，默认深绿)

export const COLOR_SOURCE_OPTIONS: { label: string; value: ColorSource }[] = [
  { label: 'Default (Follow Global / 默认跟随全局)', value: 'default' },
  { label: 'Custom (自定义颜色)', value: 'custom' },
  { label: 'My Primary (我方主色 - 浅黄)', value: 'my-primary' },
  { label: 'My Secondary (我方副色 - 深黄)', value: 'my-secondary' },
  { label: 'Opponent Primary (对方主色 - 浅绿)', value: 'opp-primary' },
  { label: 'Opponent Secondary (对方副色 - 深绿)', value: 'opp-secondary' },
];

/**
 * 统一解析组件生效颜色函数 (Resolve Effective Color)
 * 优先级规则:
 * 1. 若显式指定队伍颜色模式 ('my-primary' | 'my-secondary' | 'opp-primary' | 'opp-secondary')，返回对应队伍颜色
 * 2. 若指定 'custom'，返回 customColor (若无则返回 fallbackColor)
 * 3. 若为 'default' 或未设置:
 *    - followGlobal 为 true: 若 globalColor 存在且非空则返回 globalColor，否则返回 fallbackColor
 *    - followGlobal 为 false: 若 customColor 存在且非空则返回 customColor，否则返回 fallbackColor
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
  // 1. 显式队伍颜色绑定
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

  // 2. 独立自定义颜色
  if (colorMode === 'custom') {
    if (customColor && customColor.trim().length > 0) {
      return customColor;
    }
    return fallbackColor || '#ffffff';
  }

  // 3. 默认 (跟随全局)
  if (followGlobal) {
    if (globalColor && globalColor.trim().length > 0) {
      return globalColor;
    }
    return fallbackColor || '#ffffff';
  } else {
    if (customColor && customColor.trim().length > 0) {
      return customColor;
    }
    return fallbackColor || '#ffffff';
  }
}
