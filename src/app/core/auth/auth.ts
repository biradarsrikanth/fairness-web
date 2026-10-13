import { HttpContext, HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../api/api';
import { changePassword, getCurrentUser, login, logout, refreshSession } from '../../api/functions';
import { TokenResponse, UserResponse } from '../../api/models';
import { BACKGROUND, handlesErrors } from '../http/api-error';

export type Role = UserResponse['role'];

/** Session requests (sign in, refresh, sign out): the auth interceptor neither adds a token nor retries them. */
export const SESSION_REQUEST = new HttpContextToken<boolean>(() => false);

/** Refresh this long before the access token expires, so a request never leaves with a dying token. */
const EXPIRY_MARGIN_MS = 30_000;
const REFRESH_LOCK = 'fairness-web:refresh';
const CHANNEL = 'fairness-web:session';

interface AccessToken {
  readonly value: string;
  readonly expiresAt: number;
}

/**
 * The signed-in user and their access token, kept in memory only. The refresh token is an httpOnly cookie
 * the browser sends to /api/v1/auth by itself; a reload gets a new access token from it (see restore()).
 */
@Service()
export class AuthService {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  private readonly token = signal<AccessToken | null>(null);
  private readonly currentUser = signal<UserResponse | null>(null);
  private refreshing: Promise<boolean> | null = null;
  private readonly channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

  readonly user = this.currentUser.asReadonly();
  readonly signedIn = computed(() => this.currentUser() !== null);
  readonly role = computed(() => this.currentUser()?.role ?? null);
  readonly mustChangePassword = computed(() => this.currentUser()?.mustChangePassword ?? false);

  constructor() {
    // Signing out in one tab signs out the others: their refresh cookie is gone too
    this.channel?.addEventListener('message', (event: MessageEvent) => {
      if (event.data === 'signed-out' && this.signedIn()) {
        this.clear();
        void this.router.navigateByUrl('/login');
      }
    });
    inject(DestroyRef).onDestroy(() => this.channel?.close());
  }

  hasRole(...roles: Role[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  /** The current access token, if any; it may be about to expire (see tokenExpiresSoon). */
  accessToken(): string | null {
    return this.token()?.value ?? null;
  }

  tokenExpiresSoon(now = Date.now()): boolean {
    const token = this.token();
    return token === null || token.expiresAt - EXPIRY_MARGIN_MS <= now;
  }

  /** Signs in; rejects with the gateway's error (wrong password, locked account, rate limit). */
  async login(email: string, password: string): Promise<UserResponse> {
    const session = await this.api.invoke(login, { body: { email, password } }, sessionContext());
    return this.start(session);
  }

  /** Changing the password ends every other session and returns a fresh one for this tab. */
  async changePassword(currentPassword: string, newPassword: string): Promise<UserResponse> {
    const session = await this.api.invoke(
      changePassword,
      { body: { currentPassword, newPassword } },
      handlesErrors(),
    );
    return this.start(session);
  }

  /**
   * Gets a new access token with the refresh cookie. Concurrent callers share one request, and tabs take
   * turns: the cookie is rotated on every refresh. Resolves false when the session is over (signed out
   * elsewhere, expired, revoked); rejects when the gateway can't be reached, leaving the session as it is.
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= withLock(REFRESH_LOCK, () => this.requestRefresh()).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  /** On app start: picks up the session of an earlier visit, if its cookie is still valid. */
  async restore(): Promise<void> {
    await this.refresh().catch(() => false);
  }

  /** Reads the signed-in user again: the teams they see change when teams are added, renamed or removed. */
  async reloadUser(): Promise<void> {
    if (!this.signedIn()) return;
    try {
      const user = await this.api.invoke(getCurrentUser, {}, handlesErrors().set(BACKGROUND, true));
      this.currentUser.set(user);
    } catch {
      // The user stays as it was; the next sign-in or reload catches up
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.invoke(logout, {}, sessionContext());
    } catch {
      // The session ends here either way; the cookie expires on its own
    }
    this.clear();
    this.channel?.postMessage('signed-out');
    await this.router.navigateByUrl('/login');
  }

  /** The session can't be renewed: back to the sign-in page, then to where the user was. */
  async expire(): Promise<void> {
    this.clear();
    const current = this.router.url;
    // Several requests may fail together; the first one already went
    if (current.startsWith('/login')) return;
    await this.router.navigate(['/login'], {
      queryParams: { returnUrl: current === '/' ? undefined : current, reason: 'expired' },
    });
  }

  private async requestRefresh(): Promise<boolean> {
    try {
      this.start(await this.api.invoke(refreshSession, {}, sessionContext()));
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.clear();
        return false;
      }
      throw error;
    }
  }

  private start(session: TokenResponse): UserResponse {
    this.token.set({ value: session.accessToken, expiresAt: Date.parse(session.expiresAt) });
    this.currentUser.set(session.user);
    return session.user;
  }

  private clear(): void {
    this.token.set(null);
    this.currentUser.set(null);
  }
}

function sessionContext(): HttpContext {
  return handlesErrors().set(SESSION_REQUEST, true).set(BACKGROUND, true);
}

// The Web Locks API serialises refreshes across this browser's tabs; without it, run directly
function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request(name, task) : task();
}
