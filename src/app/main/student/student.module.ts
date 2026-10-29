import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComingSoonComponent } from 'src/app/shared/components/coming-soon';
import { SharedModule } from 'src/app/shared/shared.module';

/**
 * The student's area. For now only the landing page that the sign-in redirect
 * points to. The other screens (docs/FRONTEND_PAGES.md, ST2 and ST3) come later.
 */
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'attendance' },
  {
    path: 'attendance',
    component: ComingSoonComponent,
    title: 'My attendance',
    data: {
      description: 'Your attendance percentage, overall and per subject.',
      apis: ['GET /attendance/my/'],
    },
  },
];

@NgModule({
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class StudentModule {}
