import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  faArrowRight,
  faArrowRotateRight,
  faArrowTrendUp,
  faBars,
  faBell,
  faBolt,
  faBuilding,
  faCalendarDays,
  faChartSimple,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircle,
  faCircleCheck,
  faCircleInfo,
  faClock,
  faDatabase,
  faDoorOpen,
  faEye,
  faFilm,
  faGaugeHigh,
  faGlobe,
  faLayerGroup,
  faLink,
  faLocationDot,
  faMagnifyingGlass,
  faPen,
  faPercent,
  faPlus,
  faSatelliteDish,
  faServer,
  faSignal,
  faSliders,
  faStopwatch,
  faTriangleExclamation,
  faUser,
  faUsers,
  faVideo,
  faWaveSquare,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

const icons = {
  arrow: faArrowRight,
  refresh: faArrowRotateRight,
  trendUp: faArrowTrendUp,
  chartLine: faArrowTrendUp,
  menu: faBars,
  bell: faBell,
  bolt: faBolt,
  building: faBuilding,
  calendar: faCalendarDays,
  chart: faChartSimple,
  check: faCheck,
  down: faChevronDown,
  left: faChevronLeft,
  right: faChevronRight,
  dot: faCircle,
  success: faCircleCheck,
  info: faCircleInfo,
  clock: faClock,
  database: faDatabase,
  door: faDoorOpen,
  eye: faEye,
  film: faFilm,
  globe: faGlobe,
  overview: faGaugeHigh,
  zones: faLayerGroup,
  link: faLink,
  location: faLocationDot,
  search: faMagnifyingGlass,
  edit: faPen,
  percent: faPercent,
  plus: faPlus,
  live: faSatelliteDish,
  server: faServer,
  signal: faSignal,
  filters: faSliders,
  stopwatch: faStopwatch,
  warning: faTriangleExclamation,
  user: faUser,
  users: faUsers,
  camera: faVideo,
  pulse: faWaveSquare,
  close: faXmark,
};
export type IconName = keyof typeof icons;
@Component({
  selector: 'app-icon',
  host: {
    '[attr.name]': 'name()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg [attr.viewBox]="viewBox()" aria-hidden="true" focusable="false">
    <path [attr.d]="path()" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      width: 1em;
      height: 1em;
      align-items: center;
      justify-content: center;
    }
    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly definition = computed(() => icons[this.name()].icon);
  readonly viewBox = computed(() => `0 0 ${this.definition()[0]} ${this.definition()[1]}`);
  readonly path = computed(() => {
    const data = this.definition()[4];
    return Array.isArray(data) ? data.join(' ') : data;
  });
}
