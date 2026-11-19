import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { AppContext } from './core/context';
import { Realtime } from './core/realtime';
import { SystemHealthState, SystemHealthStore } from './core/system-health';
import { I18nService } from './core/i18n';
import { RUNTIME_CONFIG } from './core/runtime-config';
describe('App shell', () => {
  it('renders semantic navigation, site context, skip link, and accurate topbar health states', () => {
    const healthState = signal<SystemHealthState>({
      overallStatus: 'degraded',
      apiStatus: 'healthy',
      databaseStatus: 'healthy',
      mqttStatus: 'degraded',
      mqttDisabled: false,
      liveDataStatus: 'healthy',
      liveDataMessageKey: null,
      reasonKey: 'health.mqttDisconnected',
      errorMessage: null,
      lastCheckedAt: null,
      lastAttemptedAt: null,
      isOutdated: false,
    });
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: 'http://localhost:5080/api/v1' } },
        {
          provide: AppContext,
          useValue: {
            sites: signal([]),
            siteOptions: signal([]),
            sitesLoading: signal(false),
            sitesError: signal(null),
            selectedSiteId: signal(''),
            site: signal(null),
            monitoring: signal(null),
            monitoringError: signal(null),
            monitoringLoading: signal(false),
          },
        },
        { provide: SystemHealthStore, useValue: { state: healthState } },
        { provide: Realtime, useValue: { mode: signal('Polling') } },
      ],
    });
    TestBed.inject(I18nService).setLang('en');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('nav[aria-label="Main navigation"]')).toBeTruthy();
    expect(root.querySelector('a[href="#main-content"]')).toBeTruthy();
    expect(root.querySelector('#workspace-site')).toBeTruthy();
    expect(root.querySelector('main')).toBeTruthy();

    const btn = root.querySelector('[data-testid="topbar-health-btn"]') as HTMLButtonElement;
    expect(btn.getAttribute('data-health')).toBe('degraded');
    expect(btn.textContent).toContain('Degraded');

    healthState.update((s) => ({ ...s, overallStatus: 'healthy', reasonKey: null }));
    fixture.detectChanges();
    expect(btn.getAttribute('data-health')).toBe('healthy');
    expect(btn.textContent).toContain('Healthy');

    healthState.update((s) => ({ ...s, overallStatus: 'unhealthy' }));
    fixture.detectChanges();
    expect(btn.getAttribute('data-health')).toBe('unhealthy');
    expect(btn.textContent).toContain('Unhealthy');
  });
});
