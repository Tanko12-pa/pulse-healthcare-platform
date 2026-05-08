import { WellnessMetric } from '../types';

export function calculateWellnessScore(metrics: WellnessMetric[]): number {
  if (metrics.length === 0) return 0;
  
  const latest = metrics[0];
  let score = 0;
  let factors = 0;

  // Steps (Target: 10,000)
  if (latest.steps !== undefined && latest.steps !== null) {
    const stepScore = Math.min((latest.steps / 10000) * 100, 100);
    score += stepScore;
    factors++;
  }

  // Sleep (Target: 8 hours)
  if (latest.sleepHours !== undefined && latest.sleepHours !== null) {
    const sleepScore = Math.min((latest.sleepHours / 8) * 100, 100);
    score += sleepScore;
    factors++;
  }

  // Heart Rate (Target: 60-100 bpm)
  if (latest.heartRate !== undefined && latest.heartRate !== null) {
    let hrScore = 0;
    if (latest.heartRate >= 60 && latest.heartRate <= 100) {
      hrScore = 100;
    } else if (latest.heartRate < 60) {
      hrScore = Math.max(0, 100 - (60 - latest.heartRate) * 2);
    } else {
      hrScore = Math.max(0, 100 - (latest.heartRate - 100) * 2);
    }
    score += hrScore;
    factors++;
  }

  if (factors === 0) return 0;
  return Math.round(score / factors);
}

export function getWellnessMessage(score: number): string {
  if (score >= 90) return "Excellent! Your health metrics are optimal across all categories.";
  if (score >= 75) return "Great job! Your activity levels and sleep are above average.";
  if (score >= 50) return "You're on the right track, but there's room for improvement in your daily routine.";
  return "Focus on increasing your daily steps and getting more consistent sleep.";
}
