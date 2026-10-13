import { BurnoutScore } from '../../api/models';

export interface BurnoutPart {
  readonly key: 'exposure' | 'relativeLoad' | 'trend';
  readonly label: string;
  readonly description: string;
  /** Points this part adds to the score, after the confidence factor */
  readonly points: number;
  /** The most it can add */
  readonly weight: number;
}

/** How many pages make a score fully trusted (the scorer's confidence = min(1, pages / 5)). */
const FULL_CONFIDENCE_PAGES = 5;

/** The scorer's confidence factor for a number of alerts. */
export function burnoutConfidence(alertCount: number): number {
  return Math.min(1, alertCount / FULL_CONFIDENCE_PAGES);
}

/**
 * The score split into its three parts (see SCORING.md in the scorer):
 * score = (50 × exposure + 30 × relative load + 20 × trend) × confidence.
 */
export function burnoutBreakdown(score: BurnoutScore): BurnoutPart[] {
  const confidence = burnoutConfidence(score.alertCount);
  const part = (
    key: BurnoutPart['key'],
    label: string,
    description: string,
    weight: number,
  ): BurnoutPart => ({
    key,
    label,
    description,
    weight,
    points: Math.round(weight * score.components[key] * confidence * 10) / 10,
  });
  return [
    part('exposure', 'Out-of-hours exposure', 'Night, evening and weekend pages', 50),
    part('relativeLoad', 'Relative load', 'Load compared with the rest of the team', 30),
    part('trend', 'Trend', 'Pages in the last 30 days against the 30 before', 20),
  ];
}
