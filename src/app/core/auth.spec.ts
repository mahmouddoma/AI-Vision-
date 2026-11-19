import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { User } from 'oidc-client-ts';
import { Auth, authorizationInterceptor } from './auth';
import { RUNTIME_CONFIG, parseConfig } from './runtime-config';
import { HttpClient } from '@angular/common/http';

describe('external identity and site capabilities', () => {
  const config = {
    apiBaseUrl: 'https://api.example/api/v1',
    hubPath: 'https://api.example/hubs/analytics',
    signalREnabled: true,
    refreshIntervalSeconds: 30,
    auth: {
      authority: 'https://identity.example',
      clientId: 'frontend',
      scope: 'openid analytics',
    },
  };
  function user(role: string, sites: string[] = []): User {
    return new User({
      access_token: 'header.' + btoa(JSON.stringify({ role, site_id: sites })) + '.signature',
      token_type: 'Bearer',
      profile: {
        sub: 'synthetic-test',
        iss: config.auth.authority,
        aud: 'frontend',
        exp: 9999999999,
        iat: 1,
      },
      expires_at: 9999999999,
    });
  }
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [{ provide: RUNTIME_CONFIG, useValue: config }] }),
  );
  it('limits readers and operators to their exact site claims and keeps administration distinct', () => {
    const auth = TestBed.inject(Auth);
    auth.user.set(user('AnalyticsReader', ['site-a']));
    expect(auth.canRead('site-a')).toBe(true);
    expect(auth.canWrite('site-a')).toBe(false);
    expect(auth.canRead('site-b')).toBe(false);
    expect(auth.administrator()).toBe(false);
    auth.user.set(user('AnalyticsOperator', ['site-a']));
    expect(auth.canWrite('site-a')).toBe(true);
    expect(auth.canWrite('site-b')).toBe(false);
    expect(auth.administrator()).toBe(false);
    auth.user.set(user('AnalyticsAdministrator'));
    expect(auth.canWrite('site-b')).toBe(true);
    auth.user.set(null);
    expect(auth.canRead('site-a')).toBe(false);
    expect(auth.canWrite('site-a')).toBe(false);
  });
  it('does not send the bearer token to unrelated origins or lookalike API prefixes', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authorizationInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: config },
        {
          provide: Auth,
          useValue: { enabled: true, token: async () => 'synthetic-short-lived-token' },
        },
      ],
    });
    const client = TestBed.inject(HttpClient),
      http = TestBed.inject(HttpTestingController);
    client.get(config.apiBaseUrl + '/alerts').subscribe();
    await Promise.resolve();
    const request = http.expectOne(config.apiBaseUrl + '/alerts');
    expect(request.request.headers.get('Authorization')).toBe('Bearer synthetic-short-lived-token');
    request.flush({});
    for (const url of ['https://other.example/api/v1/alerts', config.apiBaseUrl + '-evil/alerts']) {
      client.get(url).subscribe();
      const other = http.expectOne(url);
      expect(other.request.headers.has('Authorization')).toBe(false);
      other.flush({});
    }
    http.verify();
  });
  it('rejects insecure or incomplete provider configuration', () => {
    expect(() =>
      parseConfig({ ...config, auth: { ...config.auth, authority: 'http://identity.example' } }),
    ).toThrow();
    expect(() =>
      parseConfig({ ...config, auth: { ...config.auth, scope: 'analytics' } }),
    ).toThrow();
  });
});
