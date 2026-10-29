import { Injectable } from '@angular/core';
import { AsyncSubject, Observable, Subject } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button, for deleting or other hard-to-undo actions. */
  danger?: boolean;
}

export interface ConfirmRequest {
  options: ConfirmOptions;
  answer: (confirmed: boolean) => void;
}

/**
 * Ask "are you sure?" before something hard to undo.
 *
 *   this.confirm
 *     .confirm({ title: 'Submit attendance?', message: '12 present, 3 absent.', confirmText: 'Submit' })
 *     .pipe(filter(Boolean), switchMap(() => this.sessions.submit(id)))
 *     .subscribe(...);
 *
 * It emits true when the user confirms and false when they cancel or press Escape.
 * ConfirmDialogComponent (in the shell) shows the dialog.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly requestSubject = new Subject<ConfirmRequest>();

  readonly requests$ = this.requestSubject.asObservable();

  confirm(options: ConfirmOptions): Observable<boolean> {
    const result = new AsyncSubject<boolean>();

    this.requestSubject.next({
      options,
      answer: (confirmed) => {
        result.next(confirmed);
        result.complete();
      },
    });

    return result.asObservable();
  }
}
