import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppPermission } from 'src/app/auth/enums';
import { AuthGuard } from 'src/app/auth/guards';
import { SharedModule } from 'src/app/shared/shared.module';
import { ChangePasswordComponent } from './change-password/change-password.component';

/**
 * The signed-in user's own account (every role). For now only C4, change password. It is also the one
 * page open to a user who must choose a new password before anything else (see AuthGuard).
 */
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'password' },
  {
    path: 'password',
    component: ChangePasswordComponent,
    title: 'Change password',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.PASSWORD_CHANGE] },
  },
];

@NgModule({
  declarations: [ChangePasswordComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class AccountModule {}
