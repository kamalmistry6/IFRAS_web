import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComingSoonComponent } from 'src/app/shared/components/coming-soon';
import { AppPermission } from 'src/app/auth/enums';
import { AuthGuard } from 'src/app/auth/guards';
import { SharedModule } from 'src/app/shared/shared.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { SessionsListComponent } from '../attendance/sessions-list/sessions-list.component';
import { ReportsComponent } from '../reports/reports/reports.component';
import { ReportsModule } from '../reports/reports.module';
import { TeacherProfileComponent } from './teacher-profile/teacher-profile.component';
import { TimetableComponent } from './timetable/timetable.component';
import { TakeAttendanceComponent } from '../attendance/take-attendance/take-attendance.component';
import { TodayComponent } from './today/today.component';

/**
 * The teacher's area: today's lectures (T1) and the timetable (T5). Taking attendance (T2) and the
 * history of sessions (T4) are in the shared attendance module, because administrators use them too.
 * The profile (T6) is here too. The dashboard is still to build: create the component, declare it, add a route.
 */
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'today' },
  {
    path: 'dashboard',
    component: ComingSoonComponent,
    title: 'Dashboard',
    data: {
      description: 'My lectures, sessions and attendance numbers at a glance.',
      apis: ['GET /attendance/today/', 'GET /attendance/sessions/?page_size=10'],
    },
  },
  { path: 'today', component: TodayComponent, title: "Today's lectures" },
  { path: 'timetable', component: TimetableComponent, title: 'My timetable' },
  {
    path: 'reports',
    component: ReportsComponent,
    title: 'Reports',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.REPORTS_VIEW] },
  },
  {
    path: 'profile',
    component: TeacherProfileComponent,
    title: 'My profile',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.TEACHER_PROFILE_EDIT] },
  },
  {
    path: 'sessions',
    component: SessionsListComponent,
    title: 'My sessions',
    data: { scope: 'teacher' },
  },
  { path: 'sessions/:id', component: TakeAttendanceComponent, title: 'Take attendance' },
];

@NgModule({
  declarations: [TodayComponent, TimetableComponent, TeacherProfileComponent],
  imports: [SharedModule, AttendanceModule, ReportsModule, RouterModule.forChild(routes)],
})
export class TeacherModule {}
