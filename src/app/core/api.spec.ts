import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Api, apiError, queryParams, reportQuery } from './api';
import { RUNTIME_CONFIG } from './runtime-config';
export const testConfig = {
  apiBaseUrl: 'http://localhost:5080/api/v1',
  hubPath: 'http://localhost:5080/hubs/analytics',
  signalREnabled: false,
  refreshIntervalSeconds: 30,
};
describe('API contract', () => {
  let api: Api;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: testConfig },
      ],
    });
    api = TestBed.inject(Api);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('omits blank identifiers while preserving zero and false', () => {
    expect(
      queryParams({ siteId: '', cameraId: undefined, sourceTime: 0, active: false }).toString(),
    ).toBe('sourceTime=0&active=false');
  });
  it('uses video session and source offsets without wall-clock dates', () => {
    expect(
      reportQuery({
        sourceType: 'video_file',
        sessionId: 'session-id',
        from: 'ignored',
        to: 'ignored',
        fromSourceTimeMs: 0,
        toSourceTimeMs: 4000,
      }),
    ).toEqual({
      sourceType: 'video_file',
      sessionId: 'session-id',
      fromSourceTimeMs: 0,
      toSourceTimeMs: 4000,
    });
    expect(() => reportQuery({ sourceType: 'video_file' })).toThrow();
  });
  it('removes source positions from live reports', () => {
    const query = reportQuery({ sourceType: 'live', from: 'from', to: 'to', fromSourceTimeMs: 1 });
    expect(query['from']).toBe('from');
    expect(query['fromSourceTimeMs']).toBeUndefined();
  });
  it('maps path, pagination and case-sensitive external IDs without coercion', () => {
    api.get('cameras', { page: 2, pageSize: 20, search: 'cam1' }).subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/cameras'));
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('search')).toBe('cam1');
    request.flush({});
  });
  it('loads all lookup pages instead of silently truncating at 100', () => {
    let items: string[] = [];
    api.all<string>('sites').subscribe((value) => (items = value));
    http
      .expectOne((req) => req.params.get('page') === '1')
      .flush({ items: ['first'], page: 1, totalPages: 2 });
    http
      .expectOne((req) => req.params.get('page') === '2')
      .flush({ items: ['second'], page: 2, totalPages: 2 });
    expect(items).toEqual(['first', 'second']);
  });
  it('sends the current rowVersion on status patch and accepts 204', () => {
    api.status('sites/internal-guid', false, 'AQIDBAUGBwg=').subscribe();
    const request = http.expectOne(testConfig.apiBaseUrl + '/sites/internal-guid/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ isActive: false, rowVersion: 'AQIDBAUGBwg=' });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
  it('retains conflict details and support reference, but hides 500 internals', () => {
    const conflict = apiError(
      new HttpErrorResponse({
        status: 409,
        error: { detail: 'Reload latest version.', traceId: 'trace-1' },
      }),
    );
    expect(conflict.conflict).toBe(true);
    expect(conflict.traceId).toBe('trace-1');
    expect(conflict.message).toContain('Reload');
    expect(
      apiError(new HttpErrorResponse({ status: 500, error: { detail: 'secret db password' } }))
        .message,
    ).not.toContain('secret');
  });
});
