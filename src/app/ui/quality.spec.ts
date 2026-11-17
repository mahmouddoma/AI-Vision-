import { TestBed } from '@angular/core/testing';
import { Quality } from './quality';
import { Chart } from './chart';
import { I18nService } from '../core/i18n';
describe('quality and accessible chart', () => {
  beforeEach(() => TestBed.inject(I18nService).setLang('en'));
  it('labels estimates and partial coverage with metadata', () => {
    const fixture = TestBed.createComponent(Quality);
    fixture.componentRef.setInput('value', {
      kind: 'Estimated',
      coveragePercent: 40,
      sampleCount: 3,
      observationDurationSeconds: 20,
      counterResetCount: 1,
      baselineCount: 1,
      gapCount: 2,
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Estimated');
    expect(text).toContain('40% coverage');
    expect(text).toContain('Partially observed');
    expect(text).toContain('counter resets');
  });
  it('breaks a chart path at null instead of drawing to zero', () => {
    const fixture = TestBed.createComponent(Chart);
    fixture.componentRef.setInput('title', 'Occupancy');
    fixture.componentInstance.tableOpen.set(true);
    fixture.componentRef.setInput('points', [
      { label: 'A', value: 5 },
      { label: 'B', value: null },
      { label: 'C', value: 0 },
    ]);
    fixture.detectChanges();
    expect(fixture.componentInstance.path(false).match(/M/g)).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('table')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('N/A');
  });
});
