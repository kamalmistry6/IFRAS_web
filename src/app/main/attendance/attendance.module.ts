import { NgModule } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { SessionsListComponent } from './sessions-list/sessions-list.component';
import { TakeAttendanceComponent } from './take-attendance/take-attendance.component';

/**
 * The attendance screens that a teacher and an administrator both use: the list of
 * sessions and the session itself (mark, submit, cancel, correct). Each area imports
 * this module and puts the screens under its own routes:
 *
 *   /teacher/sessions, /teacher/sessions/:id      (TeacherModule)
 *   /admin/sessions,   /admin/sessions/:id        (AdminModule)
 *
 * What each user may do is decided by the server (a teacher has a correction window,
 * an administrator has none), so the screens are the same.
 */
@NgModule({
  declarations: [SessionsListComponent, TakeAttendanceComponent],
  imports: [SharedModule],
  exports: [SessionsListComponent, TakeAttendanceComponent],
})
export class AttendanceModule {}
