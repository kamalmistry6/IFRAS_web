import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComingSoonComponent } from 'src/app/shared/components/coming-soon';
import { SharedModule } from 'src/app/shared/shared.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { SessionsListComponent } from '../attendance/sessions-list/sessions-list.component';
import { TimetableComponent } from './timetable/timetable.component';
import { TakeAttendanceComponent } from '../attendance/take-attendance/take-attendance.component';
import { TodayComponent } from './today/today.component';

/**
 * The teacher's area: today's lectures (T1), taking attendance (T2) and the history of sessions (T4).
 * The other screens (docs/FRONTEND_PAGES.md, T5 and T6) are added here one at a time:
 * create the component, declare it, add a route.
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
    path: 'sessions',
    component: SessionsListComponent,
    title: 'My sessions',
    data: { scope: 'teacher' },
  },
  { path: 'sessions/:id', component: TakeAttendanceComponent, title: 'Take attendance' },
];

@NgModule({
  declarations: [TodayComponent, TimetableComponent],
  imports: [SharedModule, AttendanceModule, RouterModule.forChild(routes)],
})
export class TeacherModule {}
