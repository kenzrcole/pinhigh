export interface HoleScore {
  holeNumber: number;
  strokes: number;
  par: number;
}

export interface PlayerStats {
  name: string;
  handicap: number;
  totalScore: number;
  currentHole: number;
  scores: HoleScore[];
}

export interface GameState {
  user: PlayerStats;
  cpu: PlayerStats;
  currentHole: number;
  isGameActive: boolean;
  totalHoles: number;
  shotCommentary: string[];
}

export type PlayerType = 'user' | 'cpu';
