import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
} from '@angular/core';
import { Observable } from 'rxjs';
import { USER_TYPE_LABEL } from 'src/app/auth/enums';
import { CurrentUser } from 'src/app/auth/models';
import { AuthService } from 'src/app/auth/services';
import { PageTitleStrategyService } from 'src/app/core/services';

/** The bar across the top: menu button (small screens), page title and the account menu. */
@Component({
  selector: 'app-topbar',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
})
export class TopbarComponent {
  @Output() menuToggle = new EventEmitter<void>();

  readonly title$: Observable<string>;
  readonly user$: Observable<CurrentUser | null>;

  menuOpen = false;

  constructor(
    private auth: AuthService,
    titles: PageTitleStrategyService,
    private host: ElementRef<HTMLElement>,
  ) {
    this.user$ = auth.user$;
    this.title$ = titles.title$;
  }

  get fullName(): string {
    return this.auth.fullName;
  }

  /** "Teacher", "College administrator" ... */
  get roleLabel(): string {
    const userType = this.auth.userType;
    return userType ? USER_TYPE_LABEL[userType] : '';
  }

  get initials(): string {
    const parts = this.fullName.split(' ').filter(Boolean);
    return (
      (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
    ).toUpperCase();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  signOut(): void {
    this.menuOpen = false;
    this.auth.logout('signed_out');
  }

  /** Clicking anywhere outside the user menu closes it. */
  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: Event): void {
    if (
      this.menuOpen &&
      !this.host.nativeElement.querySelector('.user')?.contains(event.target as Node)
    ) {
      this.menuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.menuOpen = false;
  }
}
