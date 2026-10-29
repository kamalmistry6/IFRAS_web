import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, filter, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UserType } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { isAuthorized } from 'src/app/auth/utils/authorization';
import { NAV_ITEMS, NavItem } from '../nav.config';

/** The menu on the left. It lists only what the signed-in user may open. */
@Component({
  selector: 'app-sidebar',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  /** On small screens the sidebar slides in over the page. */
  @Input() open = false;
  /** Wide screens: show icons only. */
  @Input() collapsed = false;
  @Output() closed = new EventEmitter<void>();
  @Output() collapsedChange = new EventEmitter<boolean>();

  readonly appName = environment.appName;
  readonly items$: Observable<NavItem[]>;

  /** Labels of the parents whose sub-menu is open. */
  private expanded = new Set<string>();

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    this.items$ = auth.userType$.pipe(map((userType) => this.visible(NAV_ITEMS, userType)));

    // A parent opens by itself when the page is one of its items.
    this.openParentOfCurrentPage();
    router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.openParentOfCurrentPage());
  }

  isExpanded(item: NavItem): boolean {
    return this.expanded.has(item.label);
  }

  /** The logo button: shrink to icons, or open up again. */
  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed);
  }

  toggle(item: NavItem): void {
    // A sub-menu needs room, so a click on its parent opens the sidebar first.
    if (this.collapsed) this.collapsedChange.emit(false);
    if (this.expanded.has(item.label)) this.expanded.delete(item.label);
    else this.expanded.add(item.label);
  }

  /** True while the current page is one of the parent's items. */
  isParentActive(item: NavItem): boolean {
    return (item.items ?? []).some(
      (child) => !!child.route && this.router.url.startsWith(child.route),
    );
  }

  signOut(): void {
    this.closed.emit();
    this.auth.logout('signed_out');
  }

  /** Items this user may see; a parent with nothing left to show is dropped. */
  private visible(items: NavItem[], userType: UserType | null): NavItem[] {
    return items
      .filter((item) =>
        isAuthorized(userType, { permissions: item.permissions, roles: item.roles }),
      )
      .map((item) => (item.items ? { ...item, items: this.visible(item.items, userType) } : item))
      .filter((item) => !item.items || item.items.length > 0);
  }

  private openParentOfCurrentPage(): void {
    for (const item of NAV_ITEMS) {
      if (item.items && this.isParentActive(item)) this.expanded.add(item.label);
    }
  }
}
