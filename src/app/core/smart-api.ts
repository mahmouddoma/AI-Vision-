import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import { Page, Query, ReportFilter } from './models';
import {
  AlertRule,
  AlertRuleWrite,
  AnalyticsAlert,
  CongestionHistory,
  CongestionReport,
  DwellDistributionReport,
  Floor,
  FloorWrite,
  FlowReport,
  HeatmapVisualization,
  InsightsReport,
  QualityReport,
  Vertex,
  Visualization,
  ZoneLayout,
} from './smart-models';

@Injectable({ providedIn: 'root' })
export class SmartApi {
  private readonly api = inject(Api);
  flow(filter: ReportFilter) {
    return this.api.report<FlowReport>('traffic/flow-rate', filter);
  }
  congestion(filter: ReportFilter) {
    return this.api.report<CongestionReport>('congestion', filter);
  }
  congestionHistory(filter: ReportFilter, page = 1) {
    return this.api.report<CongestionHistory>('congestion/history', filter, { page, pageSize: 20 });
  }
  dwell(filter: ReportFilter, longStay = false) {
    return this.api.report<DwellDistributionReport>(
      longStay ? 'dwell/long-stay' : 'dwell/distribution',
      filter,
    );
  }
  quality(filter: ReportFilter) {
    return this.api.report<QualityReport>('quality', filter);
  }
  insights(filter: ReportFilter) {
    return this.api.report<InsightsReport>('insights', filter);
  }
  visualization(metric: string, filter: ReportFilter, visualizationType?: string) {
    return this.api.report<Visualization>(`visualizations/${encodeURIComponent(metric)}`, filter, {
      visualizationType,
    });
  }
  alerts(siteId: string, query: Query = {}) {
    return this.api.get<Page<AnalyticsAlert>>('alerts', { ...query, siteId });
  }
  alert(id: string) {
    return this.api.get<AnalyticsAlert>(`alerts/${encodeURIComponent(id)}`);
  }
  alertAction(id: string, action: 'acknowledge' | 'resolve') {
    return this.api.post<AnalyticsAlert>(`alerts/${encodeURIComponent(id)}/${action}`, null);
  }
  rules(siteId: string, query: Query = {}) {
    return this.api.get<Page<AlertRule>>('alert-rules', { ...query, siteId });
  }
  rule(id: string) {
    return this.api.get<AlertRule>(`alert-rules/${encodeURIComponent(id)}`);
  }
  saveRule(id: string | null, body: AlertRuleWrite) {
    return id
      ? this.api.put<AlertRule>(`alert-rules/${encodeURIComponent(id)}`, body)
      : this.api.post<AlertRule>('alert-rules', body);
  }
  ruleStatus(rule: AlertRule) {
    return this.api.patch<AlertRule>(`alert-rules/${encodeURIComponent(rule.id)}/status`, {
      isActive: !rule.isActive,
      rowVersion: rule.rowVersion,
    });
  }
  floors(siteId: string, query: Query = {}) {
    return this.api.get<Page<Floor>>(`sites/${encodeURIComponent(siteId)}/floors`, query);
  }
  floor(id: string) {
    return this.api.get<Floor>(`floors/${encodeURIComponent(id)}`);
  }
  saveFloor(siteId: string, id: string | null, body: FloorWrite) {
    return id
      ? this.api.put<Floor>(`floors/${encodeURIComponent(id)}`, body)
      : this.api.post<Floor>(`sites/${encodeURIComponent(siteId)}/floors`, body);
  }
  floorStatus(floor: Floor) {
    return this.api.status(
      `floors/${encodeURIComponent(floor.id)}`,
      !floor.isActive,
      floor.rowVersion,
    );
  }
  layouts(id: string, cameraId?: string) {
    return this.api.get<ZoneLayout[]>(`floors/${encodeURIComponent(id)}/layouts`, { cameraId });
  }
  saveLayout(id: string, zoneId: string, vertices: Vertex[], rowVersion?: string) {
    return this.api.put<ZoneLayout>(
      `floors/${encodeURIComponent(id)}/zones/${encodeURIComponent(zoneId)}/layout`,
      { vertices, ...(rowVersion ? { rowVersion } : {}) },
    );
  }
  deleteLayout(id: string, layout: ZoneLayout) {
    return this.api.delete(
      `floors/${encodeURIComponent(id)}/zones/${encodeURIComponent(layout.zoneId)}/layout`,
      { rowVersion: layout.rowVersion },
    );
  }
  heatmap(floorId: string, metricKey: string, filter: ReportFilter) {
    return this.api.report<HeatmapVisualization>('heatmap', filter, { floorId, metricKey });
  }
}
