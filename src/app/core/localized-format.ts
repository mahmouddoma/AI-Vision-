import { Injectable, inject } from '@angular/core';
import { I18nService } from './i18n';
import { duration, number, sourceTime, timestamp } from './format';
import { ReportPeriod, StaffPoint, ZonePeriod } from './models';
import { staffPoints, zonePoints } from './report-presenter';

@Injectable({ providedIn: 'root' })
export class LocalizedFormat {
  private readonly i18n = inject(I18nService);
  readonly number = (value: number | null | undefined, digits = 0) =>
    this.i18n.t(number(value, digits));
  readonly duration = (value: number | null | undefined) => this.i18n.t(duration(value));
  readonly sourceTime = (value: number | null | undefined) => this.i18n.t(sourceTime(value));
  readonly timestamp = (value: string | null | undefined, timeZone = 'UTC') =>
    this.i18n.t(timestamp(value, timeZone, this.i18n.currentLang()));
  readonly zonePoints = (series: ZonePeriod[], period: ReportPeriod, metric = 'occupancy') =>
    zonePoints(series, period, metric, this.i18n.currentLang());
  readonly staffPoints = (series: StaffPoint[], period: ReportPeriod) =>
    staffPoints(series, period, this.i18n.currentLang());
}
