import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { AppContext } from './core/context';
import { Realtime } from './core/realtime';
describe('App shell', () => {
  it('renders semantic navigation, site context and skip link', () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AppContext,
          useValue: {
            sites: signal([]),
            sitesLoading: signal(false),
            sitesError: signal(null),
            selectedSiteId: signal(''),
            site: signal(null),
            monitoring: signal(null),
            monitoringError: signal(null),
            monitoringLoading: signal(false),
          },
        },
        { provide: Realtime, useValue: { mode: signal('Polling') } },
      ],
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('nav[aria-label="Main navigation"]')).toBeTruthy();
    expect(root.querySelector('a[href="#main-content"]')).toBeTruthy();
    expect(root.querySelector('#workspace-site')).toBeTruthy();
    expect(root.querySelector('main')).toBeTruthy();
  });
});
