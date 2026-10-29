import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { ForbiddenComponent } from './error-pages/forbidden.component';
import { NotFoundComponent } from './error-pages/not-found.component';
import { ShellComponent } from './shell/shell.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TopbarComponent } from './topbar/topbar.component';

/**
 * The signed-in frame (shell, top bar, sidebar) and the error pages.
 * Imported by AppModule, because the shell is the parent of every feature route.
 */
@NgModule({
  declarations: [
    ShellComponent,
    TopbarComponent,
    SidebarComponent,
    NotFoundComponent,
    ForbiddenComponent,
  ],
  imports: [SharedModule],
})
export class LayoutModule {}
