import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** style the confirm button as a destructive action */
  danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/** Promise based confirmation dialog (replaces browser confirm()). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request$ = new BehaviorSubject<ConfirmRequest | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => this.request$.next({ ...options, resolve }));
  }

  answer(confirmed: boolean): void {
    const request = this.request$.value;
    this.request$.next(null);
    request?.resolve(confirmed);
  }
}
