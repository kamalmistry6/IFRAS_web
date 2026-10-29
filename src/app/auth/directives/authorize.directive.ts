import { Directive, ElementRef, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppPermission, UserType } from '../enums';
import { AuthService } from '../services';
import { isAuthorized } from '../utils/authorization';

/**
 * appAuthorize: hides the element when the signed-in user is not allowed to see it.
 *
 * INPUTS
 *   [appAuthorize]  AppPermission[]  the user must hold ANY of these (ALL if isAll is true)
 *   [roles]         UserType[]       the user type must be one of these
 *   [exceptRole]    boolean          invert the roles check
 *   [isAll]         boolean          require every listed permission
 *
 * EXAMPLES
 *   A button only for people who can manage students:
 *     <button [appAuthorize]="[Permission.STUDENTS_MANAGE]">Add student</button>
 *
 *   A section only for teachers:
 *     <section [appAuthorize]="[]" [roles]="[UserType.TEACHER]"> ... </section>
 *
 *   Everyone except students:
 *     <div [appAuthorize]="[]" [roles]="[UserType.STUDENT]" [exceptRole]="true"> ... </div>
 *
 * This is for tidiness only. The server enforces every rule anyway.
 * An empty [appAuthorize]="[]" with no roles shows the element to every signed-in user.
 */
@Directive({
  selector: '[appAuthorize]',
  standalone: false,
})
export class AuthorizeDirective implements OnInit, OnChanges, OnDestroy {
  @Input('appAuthorize') permissions: AppPermission[] = [];
  @Input() roles: UserType[] = [];
  @Input() exceptRole = false;
  @Input() isAll = false;

  private userType: UserType | null = null;
  private subscription?: Subscription;

  constructor(
    private element: ElementRef<HTMLElement>,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.subscription = this.auth.userType$.subscribe((userType) => {
      this.userType = userType;
      this.update();
    });
  }

  ngOnChanges(): void {
    this.update();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private update(): void {
    const allowed = isAuthorized(this.userType, {
      permissions: this.permissions,
      roles: this.roles,
      isAll: this.isAll,
      exceptRole: this.exceptRole,
    });

    // The global [hidden] rule (styles/_base.scss) hides it.
    this.element.nativeElement.hidden = !allowed;
  }
}
