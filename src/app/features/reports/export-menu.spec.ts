import { TestBed } from '@angular/core/testing';
import { ExportMenu } from './export-menu';
import { ReportRequest } from './report-downloads';

describe('ExportMenu', () => {
  async function render(request: ReportRequest | null): Promise<HTMLButtonElement> {
    const fixture = TestBed.createComponent(ExportMenu);
    fixture.componentRef.setInput('request', request);
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  it('offers an export once the page has loaded', async () => {
    expect((await render(null)).disabled).toBe(true);
    expect(
      (await render({ kind: 'analytics', start: '2026-09-01', end: '2026-09-30' })).disabled,
    ).toBe(false);
  });

  it("doesn't offer windows longer than reports cover", async () => {
    const button = await render({ kind: 'analytics', start: '2025-01-01', end: '2026-09-30' });
    expect(button.disabled).toBe(true);
  });
});
