import { loadConfig, parseConfig } from './runtime-config';
describe('runtime configuration', () => {
  const valid = {
    apiBaseUrl: 'http://localhost:5080/api/v1/',
    hubPath: '/hubs/analytics',
    signalREnabled: true,
    refreshIntervalSeconds: 30,
  };
  afterEach(() => vi.unstubAllGlobals());
  it('resolves hub against backend origin, not API prefix', () => {
    const result = parseConfig(valid);
    expect(result.apiBaseUrl).toBe('http://localhost:5080/api/v1');
    expect(result.hubPath).toBe('http://localhost:5080/hubs/analytics');
  });
  it('rejects missing settings, invalid intervals and embedded credentials', () => {
    for (const value of [
      null,
      {},
      { ...valid, refreshIntervalSeconds: 0 },
      { ...valid, signalREnabled: 'true' },
      { ...valid, apiBaseUrl: 'http://user:password@localhost/api' },
      { ...valid, hubPath: 'javascript:alert(1)' },
    ])
      expect(() => parseConfig(value)).toThrow();
  });
  it('loads uncached configuration before bootstrap and fails on missing file', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => valid });
    vi.stubGlobal('fetch', fetch);
    expect((await loadConfig()).refreshIntervalSeconds).toBe(30);
    expect(fetch.mock.calls[0][1].cache).toBe('no-store');
    fetch.mockResolvedValue({ ok: false });
    await expect(loadConfig()).rejects.toThrow();
  });
});
