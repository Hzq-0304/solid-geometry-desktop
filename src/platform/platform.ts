declare global {
  interface Window {
    readonly __TAURI__?: unknown;
    readonly __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauriEnvironment = (): boolean =>
  typeof window !== "undefined" &&
  (Boolean(window.__TAURI__) || Boolean(window.__TAURI_INTERNALS__));

