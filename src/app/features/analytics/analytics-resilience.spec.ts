import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Analytics } from './analytics';
import { Overview } from '../overview/overview';
import { AppContext } from '../../core/context';
import { FeedState, Realtime } from '../../core/realtime';
import { I18nService } from '../../core/i18n';
import { RUNTIME_CONFIG } from '../../core/runtime-config';
import { DataQuality, ReportPeriod, Site } from '../../core/models';

const config = {
  apiBaseUrl: 'http://localhost:5080/api/v1',
  hubPath: 'http://localhost:5080/hubs/analytics',
  signalREnabled: false,
  refreshIntervalSeconds: 30,
};

const site: Site = {
  id: 'site-1',
  name: 'Main Mall',
  code: 'MAIN',
  description: null,
  timeZoneId: 'UTC',
  isActive: true,
  createdAtUtc: '2026-11-19T00:00:00Z',
  updatedAtUtc: '2026-11-19T00:00:00Z',
  rowVersion: 'AQ==',
};

const quality: DataQuality = {
  kind: 'Derived',
  sampleCount: 10,
  coveragePercent: 100,
  observationDurationSeconds: 600,
  counterResetCount: 0,
  baselineCount: 0,
  gapCount: 0,
};

const period: ReportPeriod = {
  sourceType: 'live',
  timeBasis: 'eventTime',
  interval: 'hour',
  timeZoneId: 'UTC',
  from: '2026-11-18T00:00:00Z',
  to: '2026-11-19T00:00:00Z',
  fromSourceTimeMs: null,
  toSourceTimeMs: null,
};

const occupancyPayload = {
  period,
  zones: [
    {
      zoneId: 'z1',
      zoneName: 'Entrance',
      averageOccupancy: 12,
      peakOccupancy: 20,
      peakAtUtc: '2026-11-19T10:00:00Z',
      peakAtSourceTimeMs: null,
      peakHour: null,
      capacity: 100,
      peakUtilizationPercent: 20,
      coveragePercent: 100,
      observationDurationSeconds: 600,
      dataQuality: quality,
      series: [],
    },
  ],
};

const peaksPayload = {
  period,
  zones: [
    {
      zoneId: 'z1',
      zoneName: 'Entrance',
      occupancy: null,
      arrivals: null,
      entries: null,
      departures: null,
      wrongWayEvents: null,
    },
  ],
};

const utilizationPayload = {
  period,
  zones: [
    {
      zoneId: 'z1',
      zoneName: 'Entrance',
      capacity: 100,
      averageUtilizationPercent: 12,
      peakUtilizationPercent: 20,
      dataQuality: quality,
    },
  ],
};

describe('Analytics & Overview partial failure resilience', () => {
  function setupProviders() {
    const feed$ = new BehaviorSubject<FeedState>({
      cameras: [],
      loading: false,
      error: null,
      refreshedAt: null,
    });
    TestBed.configureTestingModule({
      imports: [Analytics, Overview],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: config },
        {
          provide: AppContext,
          useValue: {
            api: { config },
            auth: { administrator: signal(false) },
            sites: signal([site]),
            siteOptions: signal([site]),
            sitesLoading: signal(false),
            sitesError: signal(null),
            selectedSiteId: signal('site-1'),
            site: signal(site),
            monitoring: signal({ registeredCameras: 1 }),
            monitoringError: signal(null),
            monitoringLoading: signal(false),
            refresh: vi.fn(),
            refreshSites: vi.fn(),
          },
        },
        {
          provide: Realtime,
          useValue: {
            mode: signal('Connected'),
            summaries: new Subject<void>(),
            watch: () => feed$.asObservable(),
          },
        },
      ],
    });
    TestBed.inject(I18nService).setLang('en');
    return { http: TestBed.inject(HttpTestingController) };
  }

  it('keeps Occupancy and Utilization visible when Peak Hours fails, and retries ONLY Peak Hours', () => {
    const { http } = setupProviders();
    const fixture = TestBed.createComponent(Analytics);
    const comp = fixture.componentInstance;
    comp.tab.set('occupancy');
    // ReportFilters emits the initial filter automatically on first change detection
    fixture.detectChanges();

    http.expectOne((r) => r.url.endsWith('/analytics/occupancy')).flush(occupancyPayload);
    http
      .expectOne((r) => r.url.endsWith('/analytics/peak-hours'))
      .flush({ detail: 'Peak error' }, { status: 500, statusText: 'Server Error' });
    http
      .expectOne((r) => r.url.endsWith('/analytics/occupancy/utilization'))
      .flush(utilizationPayload);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(comp.occupancySlice().status).toBe('success');
    expect(comp.utilizationSlice().status).toBe('success');
    expect(comp.peaksSlice().status).toBe('error');
    expect(root.querySelector('[data-testid="analytics-partial-banner"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="occupancy-charts"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="peaks-error"]')).toBeTruthy();

    // Retry ONLY Peak Hours — must not re-request occupancy or utilization
    comp.retryReport('peaks');
    fixture.detectChanges();
    http.expectNone((r) => r.url.endsWith('/analytics/occupancy'));
    http.expectNone((r) => r.url.endsWith('/analytics/occupancy/utilization'));
    http.expectOne((r) => r.url.endsWith('/analytics/peak-hours')).flush(peaksPayload);
    fixture.detectChanges();

    expect(comp.peaksSlice().status).toBe('success');
    expect(root.querySelector('[data-testid="peaks-error"]')).toBeNull();
    expect(root.querySelector('[data-testid="peaks-section"]')).toBeTruthy();
    http.verify();
  });

  it('cancels an in-flight single-report retry when filters change', () => {
    const { http } = setupProviders();
    const fixture = TestBed.createComponent(Analytics);
    const comp = fixture.componentInstance;
    comp.tab.set('occupancy');
    fixture.detectChanges();

    http.expectOne((r) => r.url.endsWith('/analytics/occupancy')).flush(occupancyPayload);
    http
      .expectOne((r) => r.url.endsWith('/analytics/peak-hours'))
      .flush({ detail: 'Peak error' }, { status: 500, statusText: 'Server Error' });
    http
      .expectOne((r) => r.url.endsWith('/analytics/occupancy/utilization'))
      .flush(utilizationPayload);
    fixture.detectChanges();

    // Start single-report retry for peaks
    comp.retryReport('peaks');
    const pendingRetry = http.expectOne((r) => r.url.endsWith('/analytics/peak-hours'));
    expect(pendingRetry.cancelled).toBe(false);

    // Change filter before retry finishes -> old retry must be cancelled
    comp.filter.set({
      siteId: 'site-1',
      sourceType: 'live',
      interval: 'day',
      from: period.from!,
      to: period.to!,
    });
    fixture.detectChanges();
    expect(pendingRetry.cancelled).toBe(true);

    // New scope loads cleanly
    http.expectOne((r) => r.url.endsWith('/analytics/occupancy')).flush(occupancyPayload);
    http.expectOne((r) => r.url.endsWith('/analytics/peak-hours')).flush(peaksPayload);
    http
      .expectOne((r) => r.url.endsWith('/analytics/occupancy/utilization'))
      .flush(utilizationPayload);
    fixture.detectChanges();

    expect(comp.peaksSlice().status).toBe('success');
    http.verify();
  });

  it('isolates Overview summary and historical Occupancy failures independently', () => {
    const { http } = setupProviders();
    const fixture = TestBed.createComponent(Overview);
    const comp = fixture.componentInstance;
    // ReportFilters emits the initial filter automatically on first change detection
    fixture.detectChanges();

    http.expectOne((r) => r.url.endsWith('/analytics/overview')).flush({
      period,
      peakOccupancy: { rank: 1, zoneId: 'z1', zoneName: 'Entrance', value: 33, dataQuality: quality },
      mostVisitedZone: null,
      topEntryZone: null,
      mostDepartedZone: null,
      topExitZone: null,
      mostCrowdedZone: null,
      longestActiveStay: null,
      estimatedHistoricalDwell: null,
      highestWrongWayZone: null,
      observedZoneAverageOccupancy: 12,
      traffic: {
        arrivals: 0,
        departures: 0,
        entries: 0,
        exits: 0,
        wrongWayIn: 0,
        wrongWayOut: 0,
        wrongWayEvents: 0,
      },
      dataQuality: quality,
    });
    http
      .expectOne((r) => r.url.endsWith('/analytics/occupancy'))
      .flush({ detail: 'Occ error' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(comp.overviewSlice().status).toBe('success');
    expect(comp.occupancySlice().status).toBe('error');
    expect(root.textContent).toContain('33');
    expect(root.querySelector('[data-testid="overview-occupancy-error"]')).toBeTruthy();

    // Retry ONLY Occupancy
    comp.retryOccupancy();
    http.expectNone((r) => r.url.endsWith('/analytics/overview'));
    http.expectOne((r) => r.url.endsWith('/analytics/occupancy')).flush(occupancyPayload);
    fixture.detectChanges();

    expect(comp.occupancySlice().status).toBe('success');
    expect(root.querySelector('[data-testid="overview-occupancy-error"]')).toBeNull();
    http.verify();
  });
});
