import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map } from 'rxjs';

/**
 * Counts the HTTP calls in flight. LoadingInterceptor starts and stops it;
 * the progress bar in the shell listens to isLoading$.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = new BehaviorSubject<number>(0);

  readonly isLoading$ = this.pending.pipe(
    map((count) => count > 0),
    distinctUntilChanged(),
  );

  start(): void {
    this.pending.next(this.pending.value + 1);
  }

  stop(): void {
    this.pending.next(Math.max(0, this.pending.value - 1));
  }
}
