import systemPreset from '../manifests/system-preset.yaml';
import userDefault from '../manifests/user-default.yaml';

export interface UserLayoutConfig {
  componentId: string;
  width: string;
  height: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
}

export function getMergedManifest() {
  // 直接返回系统预设，完全由 YAML 控制列表。不再通过 JS 强行 push 注入新场景
  return {
    references: [...systemPreset.references],
    scenes: [...systemPreset.scenes]
  };
}

// 🛡️ 纯净无污染加载器：彻底移除 LocalStorage，直接使用配置文件默认值
export function loadUserWorkspaceLayout(): UserLayoutConfig[] {
  // 无论后续是存文件还是存数据库，当前阶段一律每次都使用标准的出厂预设
  return userDefault.components.map((comp: any) => ({
    componentId: comp.id,
    width: comp.default_width,
    height: comp.default_height,
    position: {
      top: comp.default_top,
      bottom: comp.default_bottom,
      left: comp.default_left,
      right: comp.default_right
    }
  }));
}
