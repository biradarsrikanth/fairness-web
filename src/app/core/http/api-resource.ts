import { HttpClient, HttpContext } from '@angular/common/http';
import { ResourceRef, Signal, inject, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ApiFnRequired } from '../../api/api';
import { ApiConfiguration } from '../../api/api-configuration';
import { handlesErrors } from './api-error';

/**
 * An API operation loaded into signals: it runs whenever params() changes, cancelling the request still on
 * its way, and stays idle while params() is undefined. The page shows the error itself (resource.error()),
 * so the global error snackbar stays quiet. Call in an injection context.
 */
export function apiResource<P, R>(
  fn: ApiFnRequired<P, R>,
  params: () => P | undefined,
  context: () => HttpContext = () => handlesErrors(),
): ResourceRef<R | undefined> {
  const http = inject(HttpClient);
  const config = inject(ApiConfiguration);
  return rxResource({
    params,
    stream: ({ params }) =>
      fn(http, config.rootUrl, params, context()).pipe(map((response) => response.body)),
  });
}

/** The resource's last value, kept on screen (dimmed) while the next one loads. */
export function keepLast<T>(resource: ResourceRef<T | undefined>): Signal<T | undefined> {
  return linkedSignal<T | undefined, T | undefined>({
    source: () => (resource.hasValue() ? resource.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });
}
