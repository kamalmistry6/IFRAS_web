import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Observable } from 'rxjs';
import { Toast, ToastType } from '../../models';
import { ToastService } from '../../services';

/** Icon class suffix for each kind of toast (see styles/_icons.scss). */
const ICON_FOR: Record<ToastType, string> = {
  success: 'check-circle',
  error: 'alert',
  warning: 'alert',
  info: 'info',
};

/** Shows the messages from ToastService, top right. Placed once, in the shell. */
@Component({
  selector: 'app-toast-container',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss'],
})
export class ToastContainerComponent {
  readonly toasts$: Observable<Toast[]>;

  constructor(private toastService: ToastService) {
    this.toasts$ = toastService.toasts$;
  }

  icon(type: ToastType): string {
    return ICON_FOR[type];
  }

  dismiss(toast: Toast): void {
    this.toastService.dismiss(toast.id);
  }
}
