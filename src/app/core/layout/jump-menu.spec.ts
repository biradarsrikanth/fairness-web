import { JumpItem, matchJumpItems } from './jump-menu';

const item = (label: string, group: JumpItem['group'], keywords?: string): JumpItem => ({
  id: label,
  label,
  group,
  icon: 'analytics',
  keywords,
  run: () => undefined,
});

describe('matchJumpItems', () => {
  const items = [
    item('Analytics', 'Pages', 'Monitor'),
    item('Alerts', 'Pages', 'Monitor'),
    item('Volvo S42 · alerts', 'Teams'),
    item('Switch to Console (dark)', 'Actions', 'theme mode'),
  ];

  it('returns everything for an empty query', () => {
    expect(matchJumpItems(items, '  ')).toHaveLength(4);
  });

  it('matches every word, in any order, ignoring case', () => {
    expect(matchJumpItems(items, 'ALERTS s42').map((i) => i.label)).toEqual(['Volvo S42 · alerts']);
  });

  it('matches keywords and the group', () => {
    expect(matchJumpItems(items, 'theme').map((i) => i.label)).toEqual([
      'Switch to Console (dark)',
    ]);
    expect(matchJumpItems(items, 'monitor')).toHaveLength(2);
  });
});
