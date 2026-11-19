import { Observable, catchError, map, of } from 'rxjs';
import { UiError, apiError } from './api';

export type ReportStatus = 'idle' | 'loading' | 'refreshing' | 'success' | 'error';

export type SafeReportOutcome<T> =
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: UiError };

export interface ReportSlice<T> {
  status: ReportStatus;
  data: T | null;
  error: UiError | null;
  updatedAt: string | null;
  stale: boolean;
}

export function idleSlice<T>(): ReportSlice<T> {
  return {
    status: 'idle',
    data: null,
    error: null,
    updatedAt: null,
    stale: false,
  };
}

export function loadingSlice<T>(previous?: ReportSlice<T>, keepData = false): ReportSlice<T> {
  if (keepData && previous?.data != null) {
    return {
      ...previous,
      status: 'refreshing',
    };
  }
  return {
    status: 'loading',
    data: null,
    error: null,
    updatedAt: null,
    stale: false,
  };
}

export function resolveSlice<T>(
  outcome: SafeReportOutcome<T>,
  previous?: ReportSlice<T>,
  keepPreviousOnError = false,
): ReportSlice<T> {
  if (outcome.status === 'success') {
    return {
      status: 'success',
      data: outcome.data,
      error: null,
      updatedAt: new Date().toISOString(),
      stale: false,
    };
  }

  if (keepPreviousOnError && previous?.data != null) {
    return {
      status: 'error',
      data: previous.data,
      error: outcome.error,
      updatedAt: previous.updatedAt,
      stale: true,
    };
  }

  return {
    status: 'error',
    data: null,
    error: outcome.error,
    updatedAt: null,
    stale: false,
  };
}

export function safeReport<T>(request$: Observable<T>): Observable<SafeReportOutcome<T>> {
  return request$.pipe(
    map((data) => ({ status: 'success' as const, data, error: null })),
    catchError((error) => of({ status: 'error' as const, data: null, error: apiError(error) })),
  );
}

export function allSlicesFailed(slices: readonly ReportSlice<unknown>[]): boolean {
  return slices.length > 0 && slices.every((slice) => slice.status === 'error' && slice.data === null);
}

export function hasPartialFailure(slices: readonly ReportSlice<unknown>[]): boolean {
  const hasError = slices.some((slice) => slice.status === 'error');
  const hasSuccess = slices.some((slice) => slice.data !== null);
  return hasError && hasSuccess;
}
