import { HttpInterceptorFn } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { BACKGROUND } from './api-error';

/** Counts the API requests the user is waiting for; the shell shows a progress bar while there are any. */
@Service()
export class LoadingService {
  private readonly pending = signal(0);
  readonly active = computed(() => this.pending() > 0);

  track(): () => void {
    this.pending.update((count) => count + 1);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.pending.update((count) => count - 1);
    };
  }
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(BACKGROUND)) return next(req);
  const stop = inject(LoadingService).track();
  return next(req).pipe(finalize(stop));
};
