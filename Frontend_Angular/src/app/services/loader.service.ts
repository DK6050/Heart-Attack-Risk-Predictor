import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, finalize } from 'rxjs';

/** Message shown under the spinner for a request (set through HttpContext). */
export const LOADER_TEXT = new HttpContextToken<string>(() => 'Please wait…');
/** Set to true for requests that must not show the loader. */
export const LOADER_OFF = new HttpContextToken<boolean>(() => false);

export interface LoaderState {
  visible: boolean;
  text: string;
}

/**
 * Global loading overlay. Every HTTP request is tracked by `loaderInterceptor`, so any page that
 * talks to the API gets the loader automatically. The overlay appears after a short delay (no
 * flash for instant responses) and stays long enough to be readable once shown.
 */
@Injectable({ providedIn: 'root' })
export class LoaderService {
  private static readonly SHOW_DELAY_MS = 150;
  private static readonly MIN_VISIBLE_MS = 400;

  readonly state$ = new BehaviorSubject<LoaderState>({ visible: false, text: '' });

  private pending = 0;
  private text = '';
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;

  show(text: string): void {
    this.pending++;
    this.text = text;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.state$.value.visible) {
      this.state$.next({ visible: true, text });
    } else if (!this.showTimer) {
      this.showTimer = setTimeout(() => {
        this.showTimer = null;
        this.shownAt = Date.now();
        this.state$.next({ visible: true, text: this.text });
      }, LoaderService.SHOW_DELAY_MS);
    }
  }

  hide(): void {
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending > 0) return;

    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    if (!this.state$.value.visible) return;

    const remaining = LoaderService.MIN_VISIBLE_MS - (Date.now() - this.shownAt);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.state$.next({ visible: false, text: '' });
    }, Math.max(0, remaining));
  }
}

export const loaderInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(LOADER_OFF)) return next(req);
  const loader = inject(LoaderService);
  loader.show(req.context.get(LOADER_TEXT));
  return next(req).pipe(finalize(() => loader.hide()));
};
