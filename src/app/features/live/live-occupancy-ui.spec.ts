import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { Live } from './live';
import { Overview } from '../overview/overview';
import { AppContext } from '../../core/context';
import { FeedState, Realtime } from '../../core/realtime';
import { Api } from '../../core/api';
import { I18nService } from '../../core/i18n';
import { LiveCamera, LiveZone, Site } from '../../core/models';
import { RUNTIME_CONFIG } from '../../core/runtime-config';

const siteA: Site = {
  id: 'site-a',
  name: 'Site A',
  code: 'A',
  description: null,
  timeZoneId: 'UTC',
  isActive: true,
  createdAtUtc: '2026-11-19T00:00:00Z',
  updatedAtUtc: '2026-11-19T00:00:00Z',
  rowVersion: 'AQ==',
};

const siteB: Site = { ...siteA, id: 'site-b', name: 'Site B', code: 'B' };

function makeZone(overrides: Partial<LiveZone> = {}): LiveZone {
  return {
    zoneId: 'z1',
    cameraId: 'c1',
    externalZoneId: 'z1',
    zoneName: 'Zone 1',
    isActive: true,
    sessionId: 'sess-1',
    sequence: 1,
    stateVersion: 1,
    previousSession: false,
    dataFreshness: 'Fresh',
    occupancy: 15,
    zoneArrivals: 15,
    zoneDepartures: 0,
    entry: 15,
    exit: 0,
    wrongWayIn: 0,
    wrongWayOut: 0,
    reportedAverageDwellSeconds: 30,
    longestActiveDwellSeconds: 60,
    activeVisitorsCount: 15,
    capacity: 100,
    warningThresholdPercent: 80,
    criticalThresholdPercent: 100,
    utilizationPercent: 15,
    capacityStatus: 'WithinCapacity',
    lastUpdatedAtUtc: '2026-11-19T10:00:00Z',
    ...overrides,
  };
}

function makeCamera(overrides: Partial<LiveCamera> = {}): LiveCamera {
  const cameraId = overrides.cameraId ?? 'c1';
  const sessionId = overrides.sessionId === undefined ? 'sess-1' : overrides.sessionId;
  return {
    cameraId,
    siteId: 'site-a',
    externalCameraId: cameraId,
    cameraName: `Camera ${cameraId}`,
    isActive: true,
    sessionId,
    lastSequence: 1,
    sourceType: 'live',
    analyticsStatus: 'running',
    dataFreshness: 'Fresh',
    processingFps: 25,
    staffCount: 1,
    lastReceivedAtUtc: '2026-11-19T10:00:00Z',
    stateVersion: 1,
    zones: [makeZone({ cameraId, sessionId })],
    ...overrides,
  };
}

describe('Live and Overview occupancy presentation', () => {
  const config = {
    apiBaseUrl: 'http://localhost:5080/api/v1',
    hubPath: 'http://localhost:5080/hubs/analytics',
    signalREnabled: false,
    refreshIntervalSeconds: 30,
  };

  function setup(initialState: FeedState) {
    const selectedSiteId = signal('site-a');
    const siteFeeds = new Map<string, BehaviorSubject<FeedState>>([
      ['site-a', new BehaviorSubject<FeedState>(initialState)],
      [
        'site-b',
        new BehaviorSubject<FeedState>({
          cameras: [],
          loading: false,
          error: null,
          refreshedAt: '2026-11-19T10:01:00Z',
        }),
      ],
    ]);

    TestBed.configureTestingModule({
      imports: [Live, Overview],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: config },
        {
          provide: Api,
          useValue: {
            config,
            get: () => of(null),
            allPages: () => of([]),
            report: () => of(null),
          },
        },
        {
          provide: AppContext,
          useValue: {
            api: { config },
            auth: { administrator: signal(false) },
            sites: signal([siteA, siteB]),
            siteOptions: signal([siteA, siteB]),
            sitesLoading: signal(false),
            sitesError: signal(null),
            selectedSiteId,
            site: signal(siteA),
            monitoring: signal({ registeredCameras: 3 }),
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
            watch: (_scope: 'site' | 'camera', id: string) => siteFeeds.get(id)!.asObservable(),
          },
        },
      ],
    });

    const i18n = TestBed.inject(I18nService);
    i18n.setLang('en');

    const liveFixture = TestBed.createComponent(Live);
    const overviewFixture = TestBed.createComponent(Overview);
    liveFixture.detectChanges();
    overviewFixture.detectChanges();

    return {
      i18n,
      selectedSiteId,
      siteFeeds,
      liveFixture,
      overviewFixture,
      detectBoth: () => {
        liveFixture.detectChanges();
        overviewFixture.detectChanges();
      },
    };
  }

  it('displays identical partial occupancy and warnings across Live and Overview', () => {
    const cameras = [
      makeCamera({
        cameraId: 'cam-a',
        dataFreshness: 'Fresh',
        zones: [makeZone({ zoneId: 'za', cameraId: 'cam-a', occupancy: 15, dataFreshness: 'Fresh' })],
      }),
      makeCamera({
        cameraId: 'cam-b',
        dataFreshness: 'Stale',
        zones: [makeZone({ zoneId: 'zb', cameraId: 'cam-b', occupancy: 20, dataFreshness: 'Stale' })],
      }),
      makeCamera({
        cameraId: 'cam-c',
        dataFreshness: 'NoRecentData',
        zones: [
          makeZone({
            zoneId: 'zc',
            cameraId: 'cam-c',
            occupancy: 10,
            dataFreshness: 'NoRecentData',
          }),
        ],
      }),
    ];

    const { liveFixture, overviewFixture, i18n, detectBoth } = setup({
      cameras,
      loading: false,
      error: null,
      refreshedAt: '2026-11-19T10:00:00Z',
    });

    const liveCard = (liveFixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="live-occupancy-kpi"]',
    )!;
    const overviewCard = (overviewFixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="overview-live-occupancy"]',
    )!;

    expect(liveCard.querySelector('.kpi-num')?.textContent?.trim()).toBe('15');
    expect(overviewCard.querySelector('.ov-kpi-val')?.textContent?.trim()).toBe('15');
    expect(liveCard.textContent).toContain('Partial data');
    expect(overviewCard.textContent).toContain('Partial data');
    expect(liveCard.textContent).toContain('1/3');
    expect(overviewCard.textContent).toContain('1/3');
    expect(liveFixture.componentInstance.occupancySummary()).toEqual(
      overviewFixture.componentInstance.occupancySummary(),
    );

    // Arabic localization check
    i18n.setLang('ar');
    detectBoth();
    expect(liveCard.textContent).toContain('بيانات جزئية');
    expect(overviewCard.textContent).toContain('بيانات جزئية');
  });

  it('distinguishes valid zero occupancy from unavailable and disconnected states', () => {
    const zeroCam = makeCamera({ zones: [makeZone({ occupancy: 0 })] });
    const { liveFixture, overviewFixture, siteFeeds, detectBoth } = setup({
      cameras: [zeroCam],
      loading: false,
      error: null,
      refreshedAt: '2026-11-19T10:00:00Z',
    });

    const liveCard = (liveFixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="live-occupancy-kpi"]',
    )!;
    const overviewCard = (overviewFixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="overview-live-occupancy"]',
    )!;

    expect(liveCard.querySelector('.kpi-num')?.textContent?.trim()).toBe('0');
    expect(overviewCard.querySelector('.ov-kpi-val')?.textContent?.trim()).toBe('0');

    // Unavailable when all cameras are stale
    siteFeeds.get('site-a')!.next({
      cameras: [makeCamera({ dataFreshness: 'Stale' })],
      loading: false,
      error: null,
      refreshedAt: '2026-11-19T10:01:00Z',
    });
    detectBoth();

    expect(liveCard.querySelector('.kpi-num')?.textContent?.trim()).toBe('N/A');
    expect(overviewCard.querySelector('.ov-kpi-val')?.textContent?.trim()).toBe('N/A');
    expect(liveCard.textContent).toContain('No reliable live data');
    expect(overviewCard.textContent).toContain('No reliable live data');

    // Disconnected state must not display cached fresh occupancy as verified current activity
    siteFeeds.get('site-a')!.next({
      cameras: [makeCamera({ zones: [makeZone({ occupancy: 25 })] })],
      loading: false,
      error: {
        title: 'Offline',
        message: 'Connection lost',
        status: 0,
        conflict: false,
        fields: {},
      },
      refreshedAt: '2026-11-19T10:00:00Z',
    });
    detectBoth();

    expect(liveCard.querySelector('.kpi-num')?.textContent?.trim()).toBe('N/A');
    expect(overviewCard.querySelector('.ov-kpi-val')?.textContent?.trim()).toBe('N/A');
    expect(liveCard.textContent).toContain('Last known snapshot');
    expect(overviewCard.textContent).toContain('Last known snapshot');
  });

  it('does not retain previous site occupancy after switching sites', () => {
    const { liveFixture, overviewFixture, selectedSiteId, detectBoth } = setup({
      cameras: [makeCamera({ zones: [makeZone({ occupancy: 42 })] })],
      loading: false,
      error: null,
      refreshedAt: '2026-11-19T10:00:00Z',
    });

    expect(liveFixture.componentInstance.occupancy()).toBe(42);
    expect(overviewFixture.componentInstance.occupancy()).toBe(42);

    selectedSiteId.set('site-b');
    detectBoth();

    expect(liveFixture.componentInstance.occupancy()).toBeNull();
    expect(overviewFixture.componentInstance.occupancy()).toBeNull();
  });
});
