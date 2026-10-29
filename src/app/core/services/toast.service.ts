import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Toast, ToastType } from '../models';

const MAX_VISIBLE = 4;

/**
 * Small pop-up messages ("Saved", "Not allowed"). Call it from anywhere:
 *
 *   this.toast.success('Saved', 'The student was updated.');
 *
 * ToastContainerComponent (in the shell) shows them.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly toastsSubject = new BehaviorSubject<Toast[]>([]);

  readonly toasts$ = this.toastsSubject.asObservable();

  success(title: string, message = '', duration = 4000): void {
    this.show('success', title, message, duration);
  }

  error(title: string, message = '', duration = 7000): void {
    this.show('error', title, message, duration);
  }

  warning(title: string, message = '', duration = 6000): void {
    this.show('warning', title, message, duration);
  }

  info(title: string, message = '', duration = 4000): void {
    this.show('info', title, message, duration);
  }

  show(type: ToastType, title: string, message: string, duration: number): void {
    const toast: Toast = { id: this.nextId++, type, title, message, duration };
    this.toastsSubject.next([...this.toastsSubject.value, toast].slice(-MAX_VISIBLE));

    if (duration > 0) {
      setTimeout(() => this.dismiss(toast.id), duration);
    }
  }

  dismiss(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.toastsSubject.next([]);
  }
}
