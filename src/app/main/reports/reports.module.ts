import { NgModule } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { DefaultersReportComponent } from './defaulters-report/defaulters-report.component';
import { ReportsComponent } from './reports/reports.component';
import { SubjectAttendanceReportComponent } from './subject-attendance-report/subject-attendance-report.component';

/**
 * The attendance reports, for administrators and teachers. Each area imports this module and puts
 * the page under its own route:
 *
 *   /admin/reports     (AdminModule)    subject attendance and defaulters
 *   /teacher/reports   (TeacherModule)  subject attendance, for the teacher's own subjects
 *
 * What each user may see is decided by the server; the page only hides the tabs a user cannot open.
 */
@NgModule({
  declarations: [ReportsComponent, SubjectAttendanceReportComponent, DefaultersReportComponent],
  imports: [SharedModule],
  exports: [ReportsComponent],
})
export class ReportsModule {}
