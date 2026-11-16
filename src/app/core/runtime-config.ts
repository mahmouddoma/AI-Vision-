import { InjectionToken } from '@angular/core';

export interface RuntimeConfig {
  apiBaseUrl: string;
  hubPath: string;
  signalREnabled: boolean;
  refreshIntervalSeconds: number;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('runtime configuration');

export function parseConfig(value: unknown): RuntimeConfig {
  const config = value as Partial<RuntimeConfig> | null;
  if (
    !config ||
    typeof config.apiBaseUrl !== 'string' ||
    typeof config.hubPath !== 'string' ||
    typeof config.signalREnabled !== 'boolean' ||
    !Number.isFinite(config.refreshIntervalSeconds) ||
    config.refreshIntervalSeconds! < 5 ||
    config.refreshIntervalSeconds! > 3600
  ) {
    throw new Error(
      'Configuration requires API URL, hub path, SignalR flag and refresh interval (5–3600 seconds).',
    );
  }
  const api = new URL(config.apiBaseUrl, window.location.origin);
  const hub = new URL(config.hubPath, api.origin);
  for (const url of [api, hub]) {
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'API and hub URLs must be HTTP(S) URLs without credentials, queries or fragments.',
      );
    }
  }
  return { ...config, apiBaseUrl: api.href.replace(/\/$/, ''), hubPath: hub.href } as RuntimeConfig;
}

export async function loadConfig(): Promise<RuntimeConfig> {
  const response = await fetch(new URL('config.json', document.baseURI), {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Runtime configuration could not be loaded.');
  return parseConfig(await response.json());
}
