import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ProgressBarComponent } from './components/progress-bar/progress-bar.component';
import { ToastContainerComponent } from './components/toast-container/toast-container.component';

/**
 * App-wide pieces that exist once: the toast container, the progress bar and
 * the confirm dialog. The layout shell places them. Imported by AppModule only.
 *
 * The interceptors, the global error handler and the services are plain
 * classes registered in AppModule or provided in root; they need no declaration.
 */
@NgModule({
  declarations: [ToastContainerComponent, ProgressBarComponent, ConfirmDialogComponent],
  imports: [CommonModule, SharedModule],
  exports: [ToastContainerComponent, ProgressBarComponent, ConfirmDialogComponent],
})
export class CoreModule {}
