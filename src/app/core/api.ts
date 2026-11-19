import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, reduce, timeout } from 'rxjs';
import { RUNTIME_CONFIG } from './runtime-config';
import { ApiProblem, Page, Query, ReportFilter } from './models';

export function queryParams(query: Query): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '')
      params = params.set(key, String(value));
  }
  return params;
}

export function reportQuery(filter: ReportFilter): Query {
  const { from, to, fromSourceTimeMs, toSourceTimeMs, sessionId, videoLoop, ...rest } = filter;
  if (filter.sourceType === 'video_file') {
    if (!sessionId) throw new Error('Select a video session before requesting a report.');
    return {
      ...rest,
      sessionId,
      fromSourceTimeMs,
      toSourceTimeMs,
      ...(videoLoop !== undefined ? { videoLoop } : {}),
    };
  }
  return { ...rest, sessionId, from, to };
}

export interface UiError {
  status?: number;
  title: string;
  message: string;
  traceId?: string;
  code?: string;
  conflict: boolean;
  fields: Record<string, string[]>;
}
export const API_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  0: 'The analytics server could not be reached. Check that it is running and allows this app through CORS, then retry.',
  400: 'Check the highlighted fields or adjust the report filters.',
  401: 'Your session has expired. Sign in again to continue.',
  403: 'You do not have permission to access this site or perform this action.',
  404: 'This record is no longer available. Refresh the list to continue.',
  409: 'This record changed or its identifier is already in use. Reload the latest record before trying again.',
  503: 'The backend is not ready. Check its database and MQTT services, then retry.',
};
export function apiError(error: unknown): UiError {
  const http = error instanceof HttpErrorResponse ? error : null;
  const problem: ApiProblem = http?.error && typeof http.error === 'object' ? http.error : {};
  const status = http?.status;
  return {
    status,
    title:
      status === 409
        ? 'Update needs your attention'
        : status === 404
          ? 'Record not found'
          : 'Unable to load data',
    message:
      status && status < 500 && problem.detail
        ? problem.detail
        : (API_ERROR_MESSAGES[status ?? 0] ?? 'Something went wrong on the server. Please retry.'),
    traceId: problem.traceId,
    code: problem.code,
    conflict: status === 409,
    fields: problem.errors ?? {},
  };
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  readonly config = inject(RUNTIME_CONFIG);
  get<T>(path: string, query: Query = {}): Observable<T> {
    return this.http
      .get<T>(`${this.config.apiBaseUrl}/${path}`, { params: queryParams(query) })
      .pipe(timeout(15000));
  }
  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.config.apiBaseUrl}/${path}`, body).pipe(timeout(15000));
  }
  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.config.apiBaseUrl}/${path}`, body).pipe(timeout(15000));
  }
  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.config.apiBaseUrl}/${path}`, body).pipe(timeout(15000));
  }
  delete(path: string, query: Query): Observable<void> {
    return this.http
      .delete<void>(`${this.config.apiBaseUrl}/${path}`, { params: queryParams(query) })
      .pipe(timeout(15000));
  }
  status(path: string, isActive: boolean, rowVersion: string): Observable<void> {
    return this.http
      .patch<void>(`${this.config.apiBaseUrl}/${path}/status`, { isActive, rowVersion })
      .pipe(timeout(15000));
  }
  all<T>(path: string, query: Query = {}): Observable<T[]> {
    return this.get<Page<T>>(path, { ...query, page: 1, pageSize: 100 }).pipe(
      expand((page) =>
        page.page < page.totalPages
          ? this.get<Page<T>>(path, { ...query, page: page.page + 1, pageSize: 100 })
          : EMPTY,
      ),
      reduce((items, page) => [...items, ...page.items], [] as T[]),
    );
  }
  report<T>(path: string, filter: ReportFilter, extra: Query = {}): Observable<T> {
    return this.get<T>(`analytics/${path}`, { ...reportQuery(filter), ...extra });
  }
}
