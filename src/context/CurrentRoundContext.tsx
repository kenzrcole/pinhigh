import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { UserHoleStats, AIHoleStats } from '../types/holeStats';

export interface CurrentRoundState {
  courseName: string;
  /** Selected tee set (e.g. 'White', 'Blue') when course has multiple tees. */
  selectedTeeSet?: string;
  currentHoleNumber: number;
  aiScoresByHole: (number | undefined)[];
  userScoresByHole: (number | undefined)[];
  /** User-entered stats per hole (fairway, GIR, scrambling, putts). */
  userStatsByHole: (UserHoleStats | undefined)[];
  /** AI stats per hole (derived from shot history); summarized under AI score. */
  aiStatsByHole: (AIHoleStats | undefined)[];
}

interface CurrentRoundContextType {
  round: CurrentRoundState;
  setRound: (partial: Partial<CurrentRoundState>) => void;
}

const CurrentRoundContext = createContext<CurrentRoundContextType | undefined>(undefined);

const initialRound: CurrentRoundState = {
  courseName: '',
  currentHoleNumber: 1,
  aiScoresByHole: Array(18),
  userScoresByHole: Array(18),
  userStatsByHole: Array(18),
  aiStatsByHole: Array(18),
};

export function CurrentRoundProvider({ children }: { children: ReactNode }) {
  const [round, setRoundState] = useState<CurrentRoundState>(initialRound);

  const setRound = useCallback((partial: Partial<CurrentRoundState>) => {
    setRoundState((prev) => ({
      ...prev,
      ...partial,
    }));
  }, []);

  return (
    <CurrentRoundContext.Provider value={{ round, setRound }}>
      {children}
    </CurrentRoundContext.Provider>
  );
}

export function useCurrentRound() {
  const context = useContext(CurrentRoundContext);
  if (context === undefined) {
    throw new Error('useCurrentRound must be used within a CurrentRoundProvider');
  }
  return context;
}
