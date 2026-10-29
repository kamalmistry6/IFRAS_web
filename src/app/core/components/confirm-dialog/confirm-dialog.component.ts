import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ConfirmRequest, ConfirmService } from '../../services';

/**
 * The dialog behind ConfirmService. Placed once, in the shell. It uses the
 * browser's native <dialog>, which gives a backdrop, focus trapping and the
 * Escape key for free.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;

  request: ConfirmRequest | null = null;
  private subscription?: Subscription;

  constructor(private confirmService: ConfirmService) {}

  ngOnInit(): void {
    this.subscription = this.confirmService.requests$.subscribe((request) => {
      // A new question replaces an unanswered one, which counts as "no".
      this.request?.answer(false);
      this.request = request;

      const element = this.dialog.nativeElement;
      if (!element.open) element.showModal();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  answer(confirmed: boolean): void {
    const request = this.request;
    this.request = null;
    this.dialog.nativeElement.close();
    request?.answer(confirmed);
  }

  /** Escape key: the native dialog is closing itself, so only report the answer. */
  onCancel(): void {
    const request = this.request;
    this.request = null;
    request?.answer(false);
  }

  /** A click on the dark backdrop (the dialog element itself) counts as "no". */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog.nativeElement) this.answer(false);
  }
}
