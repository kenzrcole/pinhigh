export type CPUDifficulty = 'scratch' | '10hcp' | '20hcp';

export interface CPUProfile {
  id: CPUDifficulty;
  name: string;
  handicap: number;
  description: string;
}

export interface CompanionHoleScore {
  holeNumber: number;
  par: number;
  userScore: number | null;
  cpuScore: number | null;
}

export interface CompanionGameState {
  currentHole: number;
  cpuDifficulty: CPUDifficulty | null;
  scores: CompanionHoleScore[];
  userTotal: number;
  cpuTotal: number;
  isGameActive: boolean;
}
