import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppPermission } from 'src/app/auth/enums';
import { AuthGuard } from 'src/app/auth/guards';
import { SharedModule } from 'src/app/shared/shared.module';
import { MyAttendanceComponent } from './my-attendance/my-attendance.component';
import { MyProfileComponent } from './my-profile/my-profile.component';
import { SubjectLecturesComponent } from './subject-lectures/subject-lectures.component';

/**
 * The student's area (docs/FRONTEND_PAGES.md, ST1 to ST3). A student sees only their own data.
 * The password page (C4) is in the account area, which every role shares.
 */
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'attendance' },
  {
    path: 'attendance',
    component: MyAttendanceComponent,
    title: 'My attendance',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.MY_ATTENDANCE_VIEW] },
  },
  {
    path: 'attendance/:offering',
    component: SubjectLecturesComponent,
    title: 'Lectures',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.MY_ATTENDANCE_VIEW] },
  },
  {
    path: 'profile',
    component: MyProfileComponent,
    title: 'My profile',
    canActivate: [AuthGuard],
    data: { permissions: [AppPermission.STUDENT_PROFILE_VIEW] },
  },
];

@NgModule({
  declarations: [MyAttendanceComponent, SubjectLecturesComponent, MyProfileComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class StudentModule {}
