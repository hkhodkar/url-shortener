import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { apiErrorMessage } from '../api/api-error';

export interface LoadState<T> {
  value: T | undefined;
  loading: boolean;
  error: string | null;
}

export interface Loader<T> {
  readonly state: Signal<LoadState<T>>;
  readonly value: Signal<T | undefined>;
  reload(): void;
  /** Replace the loaded value, e.g. after a successful edit. */
  set(value: T): void;
}

/**
 * Loads data whenever `params` change, keeping the previous value on screen
 * while the next request runs. Must be called in an injection context.
 */
export function loader<P, T>(params: () => P, fetch: (params: P) => Observable<T>): Loader<T> {
  const destroyRef = inject(DestroyRef);
  const tick = signal(0);
  const state = signal<LoadState<T>>({ value: undefined, loading: true, error: null });

  toObservable(computed(() => ({ params: params(), tick: tick() })))
    .pipe(
      switchMap(({ params: p }) =>
        fetch(p).pipe(
          map((value) => ({ value, error: null as string | null })),
          catchError((error: unknown) => of({ value: undefined, error: apiErrorMessage(error) })),
          startWith(null),
        ),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe((result) => {
      if (result === null) {
        state.update((s) => ({ ...s, loading: true, error: null }));
      } else if (result.error !== null) {
        state.update((s) => ({ ...s, loading: false, error: result.error }));
      } else {
        state.set({ value: result.value, loading: false, error: null });
      }
    });

  return {
    state: state.asReadonly(),
    value: computed(() => state().value),
    reload: () => tick.update((n) => n + 1),
    set: (value: T) => state.set({ value, loading: false, error: null }),
  };
}
