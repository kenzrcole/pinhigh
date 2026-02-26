import { CPUDifficulty } from '../types/companion';

interface ScoreDistribution {
  eagle: number;
  birdie: number;
  par: number;
  bogey: number;
  doubleBogey: number;
  tripleBogey: number;
}

const scoreDistributions: Record<CPUDifficulty, ScoreDistribution> = {
  scratch: {
    eagle: 0.02,
    birdie: 0.18,
    par: 0.50,
    bogey: 0.25,
    doubleBogey: 0.04,
    tripleBogey: 0.01,
  },
  '10hcp': {
    eagle: 0.01,
    birdie: 0.08,
    par: 0.30,
    bogey: 0.40,
    doubleBogey: 0.18,
    tripleBogey: 0.03,
  },
  '20hcp': {
    eagle: 0.00,
    birdie: 0.02,
    par: 0.15,
    bogey: 0.30,
    doubleBogey: 0.40,
    tripleBogey: 0.13,
  },
};

export function simulateCPUScore(difficulty: CPUDifficulty, par: number): number {
  const distribution = scoreDistributions[difficulty];
  const random = Math.random();

  let cumulative = 0;

  cumulative += distribution.eagle;
  if (random < cumulative) return par - 2;

  cumulative += distribution.birdie;
  if (random < cumulative) return par - 1;

  cumulative += distribution.par;
  if (random < cumulative) return par;

  cumulative += distribution.bogey;
  if (random < cumulative) return par + 1;

  cumulative += distribution.doubleBogey;
  if (random < cumulative) return par + 2;

  return par + 3;
}

export function getCPUProfileName(difficulty: CPUDifficulty): string {
  const names = {
    scratch: 'Scratch Golfer',
    '10hcp': '10 Handicap',
    '20hcp': '20 Handicap',
  };
  return names[difficulty];
}

export function getCPUHandicap(difficulty: CPUDifficulty): number {
  const handicaps = {
    scratch: 0,
    '10hcp': 10,
    '20hcp': 20,
  };
  return handicaps[difficulty];
}
