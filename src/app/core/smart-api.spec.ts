import { Observable } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SmartApi } from './smart-api';
import { RUNTIME_CONFIG } from './runtime-config';
import { AlertRule, AlertRuleWrite, Floor, ZoneLayout } from './smart-models';
import { ReportFilter } from './models';

describe('PR #1 wire contracts', () => {
  let api: SmartApi, http: HttpTestingController;
  const root = 'https://analytics.example/api/v1';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: root } },
      ],
    });
    api = TestBed.inject(SmartApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses source-time bounds and loop 0 without sending live dates to every smart report family', () => {
    const filter: ReportFilter = {
      siteId: 'site',
      sourceType: 'video_file',
      sessionId: 'session',
      videoLoop: 0,
      fromSourceTimeMs: 0,
      toSourceTimeMs: 90000,
      from: 'ignored',
      to: 'ignored',
    };
    const operations: (() => Observable<unknown>)[] = [
      () => api.flow(filter),
      () => api.congestion(filter),
      () => api.congestionHistory(filter, 2),
      () => api.dwell(filter),
      () => api.dwell(filter, true),
      () => api.quality(filter),
      () => api.insights(filter),
      () => api.visualization('trafficBalance', filter),
      () => api.heatmap('floor', 'arrivals', filter),
    ];
    const paths = [
      'traffic/flow-rate',
      'congestion',
      'congestion/history',
      'dwell/distribution',
      'dwell/long-stay',
      'quality',
      'insights',
      'visualizations/trafficBalance',
      'heatmap',
    ];
    operations.forEach((operation, i) => {
      operation().subscribe();
      const r = http.expectOne((req) => req.url === `${root}/analytics/${paths[i]}`);
      expect(r.request.method).toBe('GET');
      expect(r.request.params.get('videoLoop')).toBe('0');
      expect(r.request.params.get('fromSourceTimeMs')).toBe('0');
      expect(r.request.params.has('from')).toBe(false);
      expect(r.request.params.has('to')).toBe(false);
      r.flush({});
    });
  });
  it('preserves the unmarked loop and returns alert-rule PATCH data while floor PATCH accepts 204', () => {
    api
      .visualization('activeDwell', {
        sourceType: 'video_file',
        sessionId: 'session',
        videoLoop: 'unmarked',
      })
      .subscribe();
    const chart = http.expectOne((req) => req.url.endsWith('/visualizations/activeDwell'));
    expect(chart.request.params.get('videoLoop')).toBe('unmarked');
    chart.flush({});
    const rule = { id: 'rule', isActive: true, rowVersion: 'AQIDBA==' } as AlertRule;
    let updated: AlertRule | undefined;
    api.ruleStatus(rule).subscribe((value) => (updated = value));
    const r = http.expectOne(`${root}/alert-rules/rule/status`);
    expect(r.request.method).toBe('PATCH');
    expect(r.request.body).toEqual({ isActive: false, rowVersion: rule.rowVersion });
    r.flush({ ...rule, isActive: false });
    expect(updated?.isActive).toBe(false);
    api.floorStatus({ id: 'floor', isActive: false, rowVersion: 'AQI=' } as Floor).subscribe();
    const f = http.expectOne(`${root}/floors/floor/status`);
    expect(f.request.body).toEqual({ isActive: true, rowVersion: 'AQI=' });
    f.flush(null, { status: 204, statusText: 'No Content' });
  });
  it('sends the saved layout version on edit and DELETE query, never an unversioned overwrite', () => {
    const layout = { zoneId: 'zone', rowVersion: 'AQI+/=' } as ZoneLayout;
    api
      .saveLayout(
        'floor',
        'zone',
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        layout.rowVersion,
      )
      .subscribe();
    const save = http.expectOne(`${root}/floors/floor/zones/zone/layout`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body.rowVersion).toBe('AQI+/=');
    save.flush({});
    api.deleteLayout('floor', layout).subscribe();
    const remove = http.expectOne((req) => req.url.endsWith('/layout'));
    expect(remove.request.method).toBe('DELETE');
    expect(remove.request.params.get('rowVersion')).toBe('AQI+/=');
    remove.flush(null, { status: 204, statusText: 'No Content' });
  });
  it('maps floor and alert reads and writes to the verified controller routes', () => {
    const body = {
      siteId: 'site',
      cameraId: 'camera',
      zoneId: 'zone',
      name: 'Capacity',
      kind: 'Congestion',
      severity: 'Warning',
      threshold: 80,
      rowVersion: 'AQI=',
    } as AlertRuleWrite;
    const calls: { call: () => Observable<unknown>; method: string; path: string }[] = [
      {
        call: () => api.alerts('site', { status: 'Active', page: 2 }),
        method: 'GET',
        path: 'alerts',
      },
      { call: () => api.alert('alert'), method: 'GET', path: 'alerts/alert' },
      {
        call: () => api.alertAction('alert', 'acknowledge'),
        method: 'POST',
        path: 'alerts/alert/acknowledge',
      },
      {
        call: () => api.alertAction('alert', 'resolve'),
        method: 'POST',
        path: 'alerts/alert/resolve',
      },
      { call: () => api.rules('site'), method: 'GET', path: 'alert-rules' },
      { call: () => api.rule('rule'), method: 'GET', path: 'alert-rules/rule' },
      { call: () => api.saveRule(null, body), method: 'POST', path: 'alert-rules' },
      { call: () => api.saveRule('rule', body), method: 'PUT', path: 'alert-rules/rule' },
      { call: () => api.floors('site'), method: 'GET', path: 'sites/site/floors' },
      { call: () => api.floor('floor'), method: 'GET', path: 'floors/floor' },
      {
        call: () =>
          api.saveFloor('site', null, { name: 'Floor', description: null, displayOrder: 0 }),
        method: 'POST',
        path: 'sites/site/floors',
      },
      {
        call: () =>
          api.saveFloor('site', 'floor', {
            name: 'Floor',
            description: null,
            displayOrder: 0,
            rowVersion: 'AQI=',
          }),
        method: 'PUT',
        path: 'floors/floor',
      },
      { call: () => api.layouts('floor', 'camera'), method: 'GET', path: 'floors/floor/layouts' },
    ];
    for (const item of calls) {
      item.call().subscribe();
      const r = http.expectOne((req) => req.url === `${root}/${item.path}`);
      expect(r.request.method).toBe(item.method);
      if (item.path === 'alerts') {
        expect(r.request.params.get('siteId')).toBe('site');
        expect(r.request.params.get('status')).toBe('Active');
      }
      if (item.path === 'alert-rules/rule' && item.method === 'PUT')
        expect(r.request.body).toEqual(body);
      r.flush({});
    }
  });
});
