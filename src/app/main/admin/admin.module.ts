import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppPermission } from 'src/app/auth/enums';
import { AuthGuard } from 'src/app/auth/guards';
import { ComingSoonComponent } from 'src/app/shared/components/coming-soon';
import { SharedModule } from 'src/app/shared/shared.module';
import { AssignmentsComponent } from './assignments/assignments.component';
import { AcademicsComponent } from './academics/academics.component';
import { ResourceTableComponent } from './academics/resource-table/resource-table.component';
import { AttendanceModule } from '../attendance/attendance.module';
import { SessionsListComponent } from '../attendance/sessions-list/sessions-list.component';
import { TakeAttendanceComponent } from '../attendance/take-attendance/take-attendance.component';
import { ReportsComponent } from '../reports/reports/reports.component';
import { ReportsModule } from '../reports/reports.module';
import { EnrollmentsComponent } from './enrollments/enrollments.component';
import { EnrollmentDialogComponent } from './enrollment-dialog/enrollment-dialog.component';
import { StudentDetailComponent } from './student-detail/student-detail.component';
import { StudentImportDialogComponent } from './student-import-dialog/student-import-dialog.component';
import { StudentsComponent } from './students/students.component';
import { TeachersComponent } from './teachers/teachers.component';
import { TimetableManagerComponent } from './timetable-manager/timetable-manager.component';

/**
 * The administrators' area (college and platform administrators share it).
 * Every admin screen of docs/FRONTEND_PAGES.md is here (A2 to A10) except the dashboard, which
 * is still a "coming soon" page. A new screen is added the same way: create the component, declare
 * it, add a route that asks for its permission through the AuthGuard:
 *
 *   { path: 'students', component: StudentsComponent, canActivate: [AuthGuard],
 *     data: { permissions: [AppPermission.STUDENTS_MANAGE] } }
 */
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    component: ComingSoonComponent,
    title: 'Dashboard',
    data: {
      description: 'Today at a glance: lectures, totals and recent sessions.',
      apis: ['GET /attendance/today/', 'GET /attendance/sessions/?page_size=10'],
    },
  },
  {
    path: 'academics',
    component: AcademicsComponent,
    title: 'Academic setup',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.ACADEMICS_VIEW] },
  },
  {
    path: 'sessions',
    component: SessionsListComponent,
    title: 'Sessions',
    canActivate: [AuthGuard],
    data: { scope: 'admin', permissions: [AppPermission.ATTENDANCE_SESSIONS_VIEW] },
  },
  {
    path: 'sessions/:id',
    component: TakeAttendanceComponent,
    title: 'Session',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.ATTENDANCE_SESSIONS_VIEW] },
  },
  {
    path: 'reports',
    component: ReportsComponent,
    title: 'Reports',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.REPORTS_VIEW] },
  },
  {
    path: 'students',
    component: StudentsComponent,
    title: 'Students',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.STUDENTS_MANAGE] },
  },
  {
    path: 'students/:id',
    component: StudentDetailComponent,
    title: 'Student',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.STUDENTS_MANAGE] },
  },
  {
    path: 'enrollments',
    component: EnrollmentsComponent,
    title: 'Enrollments',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.ENROLLMENTS_MANAGE] },
  },
  {
    path: 'teachers',
    component: TeachersComponent,
    title: 'Teachers',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.TEACHERS_MANAGE] },
  },
  {
    path: 'assignments',
    component: AssignmentsComponent,
    title: 'Subject assignments',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.ASSIGNMENTS_MANAGE] },
  },
  {
    path: 'timetable',
    component: TimetableManagerComponent,
    title: 'Timetable',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.TIMETABLE_MANAGE] },
  },
];

@NgModule({
  declarations: [
    AcademicsComponent,
    ResourceTableComponent,
    StudentsComponent,
    StudentDetailComponent,
    StudentImportDialogComponent,
    EnrollmentDialogComponent,
    EnrollmentsComponent,
    TeachersComponent,
    AssignmentsComponent,
    TimetableManagerComponent,
  ],
  imports: [SharedModule, AttendanceModule, ReportsModule, RouterModule.forChild(routes)],
})
export class AdminModule {}
