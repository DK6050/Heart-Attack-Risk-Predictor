import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type Role = 'admin' | 'user';

interface Session {
  token: string;
  role: Role;
  name?: string;
}

/** Keeps the login token for the current browser tab (cleared when the tab closes). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly KEY = 'heart_session';
  private memory: Session | null = null;

  /** Emits whenever the session ends, so per-user state elsewhere can be cleared. */
  readonly loggedOut = new Subject<void>();

  private get session(): Session | null {
    if (this.memory) return this.memory;
    try {
      const raw = sessionStorage.getItem(AuthService.KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }

  get token(): string | null {
    return this.session?.token ?? null;
  }

  get role(): Role | null {
    return this.session?.role ?? null;
  }

  /** display name of the signed-in person */
  get name(): string {
    return this.session?.name ?? '';
  }

  /** the page each role starts on */
  get home(): string {
    return this.role === 'admin' ? '/admindashboard' : this.role === 'user' ? '/dashboard' : '/login';
  }

  start(token: string, role: Role, name = ''): void {
    this.memory = { token, role, name };
    try {
      sessionStorage.setItem(AuthService.KEY, JSON.stringify(this.memory));
    } catch {
      /* storage unavailable: the in-memory copy still works for this page load */
    }
  }

  logout(): void {
    this.loggedOut.next();
    this.memory = null;
    try {
      sessionStorage.removeItem(AuthService.KEY);
    } catch {
      /* ignore */
    }
  }
}
