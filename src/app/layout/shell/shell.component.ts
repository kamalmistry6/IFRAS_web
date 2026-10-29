import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

const COLLAPSED_KEY = 'fra.sidebar.collapsed';

/**
 * The frame around every signed-in page: top bar, sidebar, and the content
 * area where the routed page appears.
 */
@Component({
  selector: 'app-shell',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit, OnDestroy {
  /** Small screens: the sidebar slides in over the page. */
  sidebarOpen = false;
  /** Wide screens: the sidebar shrinks to icons only. Remembered between visits. */
  collapsed = this.readCollapsed();
  private subscription?: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Moving to another page closes the menu that slid over the content.
    this.subscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => (this.sidebarOpen = false));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleCollapsed(): void {
    this.setCollapsed(!this.collapsed);
  }

  setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // Storage can be blocked; the sidebar still works for this visit.
    }
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
