import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { Catalog, topicSegment } from './catalog';
import { AppContext } from '../../core/context';
import { RUNTIME_CONFIG } from '../../core/runtime-config';
import { Site } from '../../core/models';
import { FormControl } from '@angular/forms';
const site: Site = {
  id: 'site-guid',
  name: 'Main Mall',
  code: 'MAIN',
  description: null,
  timeZoneId: 'Africa/Cairo',
  isActive: true,
  rowVersion: 'AQIDBAUGBwg=',
  createdAtUtc: '',
  updatedAtUtc: '',
};
describe('catalog forms and concurrency', () => {
  let component: Catalog;
  let http: HttpTestingController;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Catalog],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: RUNTIME_CONFIG,
          useValue: {
            apiBaseUrl: '/api/v1',
            signalREnabled: false,
            refreshIntervalSeconds: 30,
            hubPath: '/hubs/analytics',
          },
        },
        {
          provide: AppContext,
          useValue: {
            sites: signal([site]),
            selectedSiteId: signal(site.id),
            refreshSites: vi.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
              data: { kind: 'sites' },
              paramMap: convertToParamMap({}),
            },
            paramMap: of(convertToParamMap({})),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Catalog);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
    http
      .expectOne((req) => req.url === '/api/v1/sites')
      .flush({ items: [site], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 });
  });
  afterEach(() => http.verify());
  it('does not submit missing required fields or whitespace-only names', () => {
    component.editor();
    component.form.controls.name.setValue('  ');
    component.save();
    expect(component.form.invalid).toBe(true);
    http.expectNone((req) => req.method === 'POST');
  });
  it('submits rowVersion and exposes 409 without overwriting the record', () => {
    component.editor(site);
    component.form.controls.name.setValue('New name');
    component.save();
    const request = http.expectOne('/api/v1/sites/site-guid');
    expect(request.request.body.rowVersion).toBe(site.rowVersion);
    request.flush(
      { detail: 'Record changed.', traceId: 'test-ref' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(component.formError()?.conflict).toBe(true);
    expect(component.dialogMode()).toBe('editor');
    expect(component.current()?.rowVersion).toBe(site.rowVersion);
  });
  it('preserves external camera identifiers as valid strings', () => {
    expect(topicSegment(new FormControl('2'))).toBeNull();
    expect(topicSegment(new FormControl('cam1'))).toBeNull();
    expect(topicSegment(new FormControl('cam/1'))).not.toBeNull();
    expect(topicSegment(new FormControl('cam#'))).not.toBeNull();
  });
});
