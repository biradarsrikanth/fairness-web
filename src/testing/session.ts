import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TokenResponse, UserResponse } from '../app/api/models';
import { AuthService, Role } from '../app/core/auth/auth';

export function user(role: Role, overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 7,
    email: `${role.toLowerCase()}@example.com`,
    fullName: `Test ${role.toLowerCase()}`,
    role,
    engineerId: role === 'ENGINEER' ? 3 : null,
    teams: [{ id: 1, name: 'SRE' }],
    mustChangePassword: false,
    ...overrides,
  };
}

/** A session as the gateway returns it; the access token lives {@code expiresInMs} from now. */
export function session(
  role: Role = 'ADMIN',
  options: { token?: string; expiresInMs?: number; user?: Partial<UserResponse> } = {},
): TokenResponse {
  return {
    accessToken: options.token ?? 'access-1',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + (options.expiresInMs ?? 15 * 60_000)).toISOString(),
    user: user(role, options.user),
  };
}

/** Signs the AuthService in by answering its login request. */
export async function signIn(
  role: Role = 'ADMIN',
  options: Parameters<typeof session>[1] = {},
): Promise<AuthService> {
  const auth = TestBed.inject(AuthService);
  const http = TestBed.inject(HttpTestingController);
  const signedIn = auth.login('someone@example.com', 'a-password-123');
  http.expectOne('/api/v1/auth/login').flush(session(role, options));
  await signedIn;
  return auth;
}

/** The gateway's 401 for a missing, expired or rejected access token. */
export const UNAUTHENTICATED = {
  status: 401,
  statusText: 'Unauthorized',
};
export const UNAUTHENTICATED_BODY = { code: 'UNAUTHENTICATED', detail: 'Sign in again' };

/** Lets promise callbacks (Api.invoke is promise-based) run before the next assertion. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
