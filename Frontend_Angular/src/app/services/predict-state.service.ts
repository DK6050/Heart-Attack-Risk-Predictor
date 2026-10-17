import { Injectable } from '@angular/core';
import { PredictionResult } from './api.service';
import { AuthService } from './auth.service';

/**
 * Remembers the Predict form (entered values and the last result) while the user moves between
 * pages, and across a browser refresh. It is cleared when the user logs out.
 */
@Injectable({ providedIn: 'root' })
export class PredictStateService {
  private static readonly KEY = 'heart_predict_state';

  values: Record<string, string> = {};
  result: PredictionResult | null = null;

  constructor(auth: AuthService) {
    this.restore();
    auth.loggedOut.subscribe(() => this.clear());
  }

  save(): void {
    try {
      sessionStorage.setItem(PredictStateService.KEY, JSON.stringify({ values: this.values, result: this.result }));
    } catch {
      /* storage unavailable: the in-memory copy still survives page navigation */
    }
  }

  clear(): void {
    this.values = {};
    this.result = null;
    try {
      sessionStorage.removeItem(PredictStateService.KEY);
    } catch {
      /* ignore */
    }
  }

  private restore(): void {
    try {
      const raw = sessionStorage.getItem(PredictStateService.KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      this.values = saved.values ?? {};
      this.result = saved.result ?? null;
    } catch {
      /* ignore corrupt or unavailable storage */
    }
  }
}
