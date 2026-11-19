import { TestBed } from '@angular/core/testing';
import { Chart } from './chart';
import { MetricQuality } from '../core/smart-models';

describe('visualization geometry and unavailable measurements', () => {
  it('keeps negative balances inside the chart and breaks lines at unavailable measurements', () => {
    const fixture = TestBed.createComponent(Chart);
    fixture.componentRef.setInput('title', 'Balance');
    fixture.componentRef.setInput('points', [
      { label: '1', value: -10 },
      { label: '2', value: null },
      { label: '3', value: 0 },
      { label: '4', value: 5, metricQuality: { provenance: 'InsufficientData' } as MetricQuality },
    ]);
    fixture.detectChanges();
    const chart = fixture.componentInstance;
    expect(chart.min()).toBe(-10);
    expect(chart.path(false).match(/M/g)?.length).toBe(2);
    expect(chart.bars()).not.toContain('NaN');
    expect(chart.bars()).not.toContain('Infinity');
    expect(chart.area().match(/Z/g)?.length).toBe(2);
  });

  it('automatically renders grouped bars for single-point line/area series instead of stretched dots', () => {
    const fixture = TestBed.createComponent(Chart);
    fixture.componentRef.setInput('kind', 'area');
    fixture.componentRef.setInput('palette', 'sky');
    fixture.componentRef.setInput('title', 'Single bucket');
    fixture.componentRef.setInput('primaryLabel', 'Average');
    fixture.componentRef.setInput('secondaryLabel', 'Peak');
    fixture.componentRef.setInput('points', [{ label: '0:00', value: 1.7, secondary: 3 }]);
    fixture.detectChanges();
    const chart = fixture.componentInstance;
    expect(chart.effectiveKind()).toBe('groupedBar');
    expect(chart.bars(false)).toContain('Q');
    expect(chart.bars(true)).toContain('Q');
    expect(chart.bars(false)).not.toContain('NaN');
  });
});
