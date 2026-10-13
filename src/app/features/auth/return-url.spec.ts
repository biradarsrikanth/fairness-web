import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps paths inside the app', () => {
    expect(safeReturnUrl('/alerts?page=2')).toBe('/alerts?page=2');
  });

  it('refuses anything that could leave the app', () => {
    for (const url of ['https://evil.example', '//evil.example', '/\\evil.example', 'alerts']) {
      expect(safeReturnUrl(url), url).toBe('/');
    }
  });

  it('never returns to the sign-in pages', () => {
    expect(safeReturnUrl('/login?returnUrl=%2Falerts')).toBe('/');
    expect(safeReturnUrl('/change-password')).toBe('/');
    expect(safeReturnUrl(undefined)).toBe('/');
  });
});
