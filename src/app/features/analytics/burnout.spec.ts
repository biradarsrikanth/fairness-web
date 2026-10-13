import { BurnoutScore } from '../../api/models';
import { burnoutBreakdown, burnoutConfidence } from './burnout-breakdown';
import { sortBurnout } from './burnout-table';

function score(overrides: Partial<BurnoutScore>): BurnoutScore {
  return {
    engineerId: 1,
    name: 'Asha',
    team: 'SRE',
    score: 40,
    risk: 'MEDIUM',
    alertCount: 10,
    escalationsReceived: 0,
    nightPct: 10,
    eveningPct: 20,
    weekendPct: 5,
    trendRatio: 1,
    medianAckMinutes: 3,
    oncallHours: null,
    components: { exposure: 0.4, relativeLoad: 0.5, trend: 0.25 },
    ...overrides,
  };
}

describe('burnout', () => {
  const rows = [
    score({ engineerId: 1, name: 'asha', score: 40, risk: 'MEDIUM', medianAckMinutes: null }),
    score({ engineerId: 2, name: 'Ravi', score: 72, risk: 'HIGH', medianAckMinutes: 8 }),
    score({ engineerId: 3, name: 'Meera', score: 12, risk: 'LOW', medianAckMinutes: 2 }),
  ];

  it('sorts by score, highest first, by default', () => {
    expect(sortBurnout(rows, 'score', '').map((r) => r.engineerId)).toEqual([2, 1, 3]);
  });

  it('sorts names without regard to case, and risk by level', () => {
    expect(sortBurnout(rows, 'name', 'asc').map((r) => r.name)).toEqual(['asha', 'Meera', 'Ravi']);
    expect(sortBurnout(rows, 'risk', 'desc').map((r) => r.risk)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
  });

  it('puts a missing median ack first when ascending', () => {
    expect(sortBurnout(rows, 'medianAckMinutes', 'asc').map((r) => r.engineerId)).toEqual([
      1, 3, 2,
    ]);
  });

  it('leaves the input alone', () => {
    sortBurnout(rows, 'name', 'asc');
    expect(rows[0].engineerId).toBe(1);
  });

  it('splits the score into its weighted parts', () => {
    // 50 × 0.4 + 30 × 0.5 + 20 × 0.25 = 40
    const parts = burnoutBreakdown(score({}));
    expect(parts.map((p) => [p.key, p.points, p.weight])).toEqual([
      ['exposure', 20, 50],
      ['relativeLoad', 15, 30],
      ['trend', 5, 20],
    ]);
  });

  it('scales the parts down for engineers with few alerts', () => {
    expect(burnoutConfidence(2)).toBe(0.4);
    expect(burnoutConfidence(9)).toBe(1);
    expect(burnoutBreakdown(score({ alertCount: 2 }))[0].points).toBe(8);
  });
});
