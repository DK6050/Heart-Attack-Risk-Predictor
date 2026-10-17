import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

/** Non-blocking notifications (replaces browser alert() pop-ups). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts$ = new BehaviorSubject<Toast[]>([]);
  private nextId = 1;

  success(text: string): void {
    this.push('success', text, 4000);
  }

  error(text: string): void {
    this.push('error', text, 7000);
  }

  info(text: string): void {
    this.push('info', text, 4500);
  }

  dismiss(id: number): void {
    this.toasts$.next(this.toasts$.value.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, text: string, ms: number): void {
    const id = this.nextId++;
    // keep the stack short: drop the oldest when there are already 4
    this.toasts$.next([...this.toasts$.value.slice(-3), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
