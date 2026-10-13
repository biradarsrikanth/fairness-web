import { Type } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApiConfiguration } from '../app/api/api-configuration';
import { authInterceptor } from '../app/core/auth/auth-interceptor';
import { settle } from './session';

/** A page under test behind the real router, with the HTTP backend faked. */
export interface PageTest {
  readonly harness: RouterTestingHarness;
  readonly http: HttpTestingController;
  /** Lets requests start and the page re-render; doesn't wait for unanswered requests. */
  render(): Promise<HTMLElement>;
}

export async function pageTest(routes: Routes): Promise<PageTest> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideApiConfiguration(''),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const harness = await RouterTestingHarness.create();
  return {
    harness,
    http,
    async render() {
      await settle();
      harness.detectChanges();
      await settle();
      harness.detectChanges();
      return harness.routeNativeElement!;
    },
  };
}

export function route(path: string, component: Type<unknown>) {
  return { path, component };
}

/** Whitespace-collapsed text. */
export function text(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** A page of results as the gateway returns it. */
export function pageOf<T>(content: T[], totalElements = content.length, page = 0, size = 20) {
  return { content, page, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}
