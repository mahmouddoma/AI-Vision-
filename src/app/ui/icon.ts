import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  faArrowRight,
  faArrowRotateRight,
  faBars,
  faBuilding,
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
  faEye,
  faFilm,
  faGaugeHigh,
  faLayerGroup,
  faLink,
  faLocationDot,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faSatelliteDish,
  faSliders,
  faTriangleExclamation,
  faVideo,
  faWaveSquare,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

const icons = {
  arrow: faArrowRight,
  refresh: faArrowRotateRight,
  menu: faBars,
  building: faBuilding,
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
  eye: faEye,
  film: faFilm,
  overview: faGaugeHigh,
  zones: faLayerGroup,
  link: faLink,
  location: faLocationDot,
  search: faMagnifyingGlass,
  edit: faPen,
  plus: faPlus,
  live: faSatelliteDish,
  filters: faSliders,
  warning: faTriangleExclamation,
  camera: faVideo,
  pulse: faWaveSquare,
  close: faXmark,
};
export type IconName = keyof typeof icons;
@Component({
  selector: 'app-icon',
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
