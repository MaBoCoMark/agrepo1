// src/declarations.d.ts
declare module '*.yaml' {
  const value: any;
  export default value;
}

declare module '*.html?raw' {
  const content: string;
  export default content;
}

declare module '*.html' {
  const content: string;
  export default content;
}

interface ImportMeta {
  glob: (pattern: string, options?: any) => Record<string, any>;
}

declare module '@tauri-apps/api/core' {
  export function invoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T>;
}

declare module '@tauri-apps/api/event' {
  export function emitTo<T = any>(target: string, event: string, payload?: T): Promise<void>;
  export function emit<T = any>(event: string, payload?: T): Promise<void>;
  export function listen<T = any>(event: string, handler: (event: { event: string; payload: T }) => void): Promise<() => void>;
  export function once<T = any>(event: string, handler: (event: { event: string; payload: T }) => void): Promise<() => void>;
}

declare module '@tauri-apps/api/window' {
  export function getCurrentWindow(): {
    setIgnoreCursorEvents(ignore: boolean): Promise<void>;
    [key: string]: any;
  };
}

declare module '@tauri-apps/api/webviewWindow' {
  export class WebviewWindow {
    static getByLabel(label: string): Promise<WebviewWindow | null>;
    static getCurrentWebviewWindow(): WebviewWindow;
    setIgnoreCursorEvents(ignore: boolean): Promise<void>;
    [key: string]: any;
  }
  export function getCurrentWebviewWindow(): WebviewWindow;
}
