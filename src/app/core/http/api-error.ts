import { HttpContext, HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../../api/models';

export type ErrorCode = NonNullable<ApiError['code']>;

/**
 * The caller shows this request's errors itself (e.g. a form under its fields), so the global error
 * snackbar stays quiet.
 */
export const HANDLES_ERRORS = new HttpContextToken<boolean>(() => false);

/** A request the user didn't start (e.g. the session refresh): no loading indicator. */
export const BACKGROUND = new HttpContextToken<boolean>(() => false);

export function handlesErrors(context = new HttpContext()): HttpContext {
  return context.set(HANDLES_ERRORS, true);
}

/** The gateway's problem details, if the error is one; network failures and foreign errors are not. */
export function apiError(error: unknown): ApiError | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  let body: unknown = error.error;
  // Operations without a response body (deletes) ask for text, so their errors arrive as JSON strings
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  return typeof body === 'object' && body !== null && 'code' in body ? (body as ApiError) : null;
}

export function errorCode(error: unknown): ErrorCode | null {
  return apiError(error)?.code ?? null;
}

/** Seconds from a Retry-After header (423 locked account, 429 rate limit), if the gateway sent one. */
export function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const value = Number(error.headers.get('Retry-After'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** A sentence for the user. The gateway's detail is written for people; the fallbacks cover the rest. */
export function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return "Can't reach the server. Check your connection and try again.";
  }
  const problem = apiError(error);
  const reference = problem?.requestId ? ` (reference ${problem.requestId})` : '';
  switch (problem?.code) {
    case 'INTERNAL_ERROR':
      return `Something went wrong on our side${reference}.`;
    case 'UPSTREAM_ERROR':
    case 'UPSTREAM_UNAVAILABLE':
    case 'UPSTREAM_TIMEOUT':
      return `A service we depend on isn't answering; try again shortly${reference}.`;
    case 'FORBIDDEN':
      return "You don't have access to that.";
    case 'TOO_MANY_REQUESTS':
      return 'Too many requests; wait a moment and try again.';
    case undefined:
      return error instanceof HttpErrorResponse && error.status >= 500
        ? 'The server had a problem; try again shortly.'
        : 'The request failed.';
    default:
      return problem?.detail ?? 'The request failed.';
  }
}
