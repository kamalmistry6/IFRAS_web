import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppPermission } from 'src/app/auth/enums';
import { AuthService } from 'src/app/auth/services';
import { RESOURCES, ResourceConfig } from './academics.config';

/** A10: the academic structure. One tab for each resource, all drawn by the same table. */
@Component({
  selector: 'app-academics',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './academics.component.html',
  styleUrls: ['./academics.component.scss'],
})
export class AcademicsComponent {
  readonly tabs = RESOURCES;
  current: ResourceConfig = RESOURCES[0];

  constructor(private auth: AuthService) {}

  /** A platform administrator: sees the college field and filter, and may change colleges and years. */
  get platform(): boolean {
    return !!this.auth.user?.is_super_admin;
  }

  /** A college administrator's own college. */
  get collegeId(): number | null {
    return this.auth.user?.college?.id ?? null;
  }

  /** Colleges and academic years are shared by every college, so only a platform administrator edits them. */
  canWrite(tab: ResourceConfig): boolean {
    return this.auth.isAuthorizedNow({
      permissions: [
        tab.platformOnly
          ? AppPermission.ACADEMICS_PLATFORM_MANAGE
          : (tab.managePermission ?? AppPermission.ACADEMICS_MANAGE),
      ],
    });
  }

  choose(tab: ResourceConfig): void {
    this.current = tab;
  }
}
