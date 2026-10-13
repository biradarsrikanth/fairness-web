import { HttpErrorResponse } from '@angular/common/http';
import { apiError, describeError } from './api-error';

describe('api errors', () => {
  const problem = { code: 'CONFLICT', detail: 'Team still has engineers; move them first' };

  it("reads the gateway's problem details", () => {
    const error = new HttpErrorResponse({ status: 409, error: problem });
    expect(apiError(error)?.code).toBe('CONFLICT');
    expect(describeError(error)).toBe('Team still has engineers; move them first');
  });

  it('reads them from text responses too (operations without a response body)', () => {
    const error = new HttpErrorResponse({ status: 409, error: JSON.stringify(problem) });
    expect(describeError(error)).toBe('Team still has engineers; move them first');
  });

  it('falls back to a general sentence for anything else', () => {
    expect(
      apiError(new HttpErrorResponse({ status: 502, error: '<html>Bad gateway</html>' })),
    ).toBeNull();
    expect(describeError(new HttpErrorResponse({ status: 502, error: 'nope' }))).toBe(
      'The server had a problem; try again shortly.',
    );
    expect(describeError(new HttpErrorResponse({ status: 0 }))).toContain("Can't reach the server");
  });
});
