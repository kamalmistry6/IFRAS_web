import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppPermission } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';

type TabKey = 'subject' | 'defaulters';

interface Tab {
  key: TabKey;
  label: string;
  permission: AppPermission;
}

const TABS: Tab[] = [
  { key: 'subject', label: 'Subject attendance', permission: AppPermission.REPORTS_VIEW },
  { key: 'defaulters', label: 'Defaulters', permission: AppPermission.REPORTS_DEFAULTERS },
];

/**
 * The reports page, for administrators (/admin/reports) and teachers (/teacher/reports). Each report
 * is a tab; a user sees only the reports they may open, and a teacher, who has just one, sees no tabs.
 */
@Component({
  selector: 'app-reports',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
})
export class ReportsComponent {
  readonly tabs: Tab[];
  current: Tab;

  constructor(private auth: AuthService) {
    this.tabs = TABS.filter((tab) => this.auth.isAuthorizedNow({ permissions: [tab.permission] }));
    this.current = this.tabs[0] ?? TABS[0];
  }

  choose(tab: Tab): void {
    this.current = tab;
  }
}
