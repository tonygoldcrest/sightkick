import { ScoreData } from '../types';

export function calculateAccuracy({
  totalNotes,
  falseHits,
  hitNotes = 0,
}: ScoreData) {
  return parseFloat((hitNotes / (totalNotes + falseHits)).toFixed(2));
}

export const STAR_RATING_BANDS = [0.2, 0.4, 0.6, 0.8, 0.92];

export function getStarRating(scoreData: ScoreData, bands = STAR_RATING_BANDS) {
  const accuracy = calculateAccuracy(scoreData);

  return bands.filter((threshold) => accuracy >= threshold).length;
}
