export const PASSING_SCORE = 80;

export function getCallOutcome(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 'pending';
  return numericScore >= PASSING_SCORE ? 'passed' : 'failed';
}
