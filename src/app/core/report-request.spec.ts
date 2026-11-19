import { firstValueFrom, forkJoin, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  allSlicesFailed,
  hasPartialFailure,
  idleSlice,
  loadingSlice,
  resolveSlice,
  safeReport,
} from './report-request';

describe('report-request independent error handling', () => {
  it('wraps successful and failed observables independently without cancelling siblings', async () => {
    const result = await firstValueFrom(
      forkJoin({
        occupancy: safeReport(of({ zones: [{ id: 'z1' }] })),
        peaks: safeReport(
          throwError(
            () =>
              new HttpErrorResponse({
                status: 500,
                statusText: 'Internal Server Error',
                error: { detail: 'DB timeout' },
              }),
          ),
        ),
        utilization: safeReport(of({ zones: [] })),
      }),
    );

    expect(result.occupancy.status).toBe('success');
    expect(result.occupancy.data?.zones).toHaveLength(1);
    expect(result.peaks.status).toBe('error');
    expect(result.peaks.data).toBeNull();
    expect(result.peaks.error?.status).toBe(500);
    // Successful empty response remains distinct from error
    expect(result.utilization.status).toBe('success');
    expect(result.utilization.data?.zones).toEqual([]);
  });

  it('computes allSlicesFailed and hasPartialFailure accurately', () => {
    const ok = resolveSlice({ status: 'success', data: { count: 1 }, error: null });
    const err = resolveSlice({
      status: 'error',
      data: null,
      error: { title: 'Err', message: 'Failed', status: 500, conflict: false, fields: {} },
    });

    expect(allSlicesFailed([ok, ok])).toBe(false);
    expect(hasPartialFailure([ok, ok])).toBe(false);

    expect(allSlicesFailed([ok, err])).toBe(false);
    expect(hasPartialFailure([ok, err])).toBe(true);

    expect(allSlicesFailed([err, err])).toBe(true);
    expect(hasPartialFailure([err, err])).toBe(false);
  });

  it('marks previously loaded data as stale when a background refresh fails and clears stale on recovery', () => {
    const initial = resolveSlice({ status: 'success', data: { value: 42 }, error: null });
    expect(initial.stale).toBe(false);

    const refreshing = loadingSlice(initial, true);
    expect(refreshing.status).toBe('refreshing');
    expect(refreshing.data).toEqual({ value: 42 });

    const failedRefresh = resolveSlice(
      {
        status: 'error',
        data: null,
        error: { title: 'Err', message: 'Timeout', status: 504, conflict: false, fields: {} },
      },
      initial,
      true,
    );
    expect(failedRefresh.status).toBe('error');
    expect(failedRefresh.data).toEqual({ value: 42 });
    expect(failedRefresh.stale).toBe(true);

    const recovered = resolveSlice(
      { status: 'success', data: { value: 50 }, error: null },
      failedRefresh,
      true,
    );
    expect(recovered.status).toBe('success');
    expect(recovered.data).toEqual({ value: 50 });
    expect(recovered.stale).toBe(false);

    expect(idleSlice().status).toBe('idle');
  });
});
