import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard, AuthMatchGuard, HomeRedirectGuard, NoAuthGuard } from './auth/guards';
import { UserType } from './auth/enums';
import { ForbiddenComponent } from './layout/error-pages/forbidden.component';
import { NotFoundComponent } from './layout/error-pages/not-found.component';
import { ShellComponent } from './layout/shell/shell.component';

/**
 * How a visit is routed:
 *
 *   /                 -> HomeRedirectGuard sends the user to THEIR home page
 *                        (teacher -> /teacher/today, admin -> /admin/dashboard,
 *                         student -> /student/attendance), or to /login if signed out
 *   /login            -> the sign-in page (NoAuthGuard: signed-in users are sent home)
 *   /teacher/...      -> teacher area, lazy loaded, only for teachers
 *   /admin/...        -> administrators' area, lazy loaded, only for admins
 *   /student/...      -> student area, lazy loaded, only for students
 *   anything else     -> "not found"; a wrong area -> "forbidden"
 *
 * The three areas are guarded with canMatch, so someone who is not allowed in
 * never even downloads that area's code.
 */
const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [HomeRedirectGuard], children: [] },

  {
    path: 'login',
    canActivate: [NoAuthGuard],
    loadChildren: () => import('./auth/login/login.module').then((m) => m.LoginModule),
  },

  {
    path: '',
    component: ShellComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'teacher',
        canMatch: [AuthMatchGuard],
        data: { roles: [UserType.TEACHER, UserType.HOD] },
        loadChildren: () => import('./main/teacher/teacher.module').then((m) => m.TeacherModule),
      },
      {
        path: 'admin',
        canMatch: [AuthMatchGuard],
        data: { roles: [UserType.ADMIN, UserType.SUPER_ADMIN, UserType.HOD] },
        loadChildren: () => import('./main/admin/admin.module').then((m) => m.AdminModule),
      },
      {
        path: 'student',
        canMatch: [AuthMatchGuard],
        data: { roles: [UserType.STUDENT] },
        loadChildren: () => import('./main/student/student.module').then((m) => m.StudentModule),
      },
      {
        path: 'account',
        loadChildren: () => import('./main/account/account.module').then((m) => m.AccountModule),
      },
      { path: 'forbidden', component: ForbiddenComponent, title: 'No access' },
      { path: '**', component: NotFoundComponent, title: 'Page not found' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
