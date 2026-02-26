import { createContext, useContext, useState, ReactNode } from 'react';
import { GameState, PlayerStats, HoleScore } from '../types/gameTypes';
import { simulateCPUHole } from '../utils/cpuSimulator';
import { fetchCourseData } from '../utils/mockCourseData';

interface GameContextType {
  gameState: GameState;
  startGame: (userHandicap: number, cpuHandicap: number) => void;
  submitUserScore: (holeNumber: number, strokes: number, par: number) => void;
  resetGame: () => void;
  getPlayerScore: (player: 'user' | 'cpu') => number;
  isHoleComplete: (holeNumber: number) => boolean;
  clearCommentary: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const initialPlayerStats: PlayerStats = {
  name: '',
  handicap: 0,
  totalScore: 0,
  currentHole: 1,
  scores: [],
};

const initialGameState: GameState = {
  user: { ...initialPlayerStats, name: 'User' },
  cpu: { ...initialPlayerStats, name: 'CPU' },
  currentHole: 1,
  isGameActive: false,
  totalHoles: 18,
  shotCommentary: [],
};

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  const startGame = (userHandicap: number, cpuHandicap: number) => {
    setGameState({
      user: { ...initialPlayerStats, name: 'User', handicap: userHandicap },
      cpu: { ...initialPlayerStats, name: 'CPU', handicap: cpuHandicap },
      currentHole: 1,
      isGameActive: true,
      totalHoles: 18,
      shotCommentary: [],
    });
  };

  const submitUserScore = (holeNumber: number, strokes: number, par: number) => {
    setGameState((prev) => {
      const userHoleScore: HoleScore = {
        holeNumber,
        strokes,
        par,
      };

      const updatedUserScores = [...prev.user.scores, userHoleScore];
      const userTotalScore = updatedUserScores.reduce(
        (sum, score) => sum + score.strokes,
        0
      );

      const courseData = fetchCourseData();
      const cpuSimulation = simulateCPUHole(
        prev.cpu.handicap,
        courseData.tee,
        courseData.green,
        par
      );

      const cpuHoleScore: HoleScore = {
        holeNumber,
        strokes: cpuSimulation.strokes,
        par,
      };

      const updatedCPUScores = [...prev.cpu.scores, cpuHoleScore];
      const cpuTotalScore = updatedCPUScores.reduce(
        (sum, score) => sum + score.strokes,
        0
      );

      const nextHole = holeNumber + 1;
      const isGameComplete = nextHole > prev.totalHoles;

      console.log(`Hole ${holeNumber} Results:`, {
        user: `${strokes} strokes`,
        cpu: `${cpuSimulation.strokes} strokes`,
        cpuDetails: cpuSimulation.shotDetails,
      });

      return {
        ...prev,
        user: {
          ...prev.user,
          scores: updatedUserScores,
          totalScore: userTotalScore,
          currentHole: isGameComplete ? holeNumber : nextHole,
        },
        cpu: {
          ...prev.cpu,
          scores: updatedCPUScores,
          totalScore: cpuTotalScore,
          currentHole: isGameComplete ? holeNumber : nextHole,
        },
        currentHole: isGameComplete ? holeNumber : nextHole,
        isGameActive: !isGameComplete,
        shotCommentary: [...cpuSimulation.commentary, ...prev.shotCommentary].slice(0, 10),
      };
    });
  };

  const resetGame = () => {
    setGameState(initialGameState);
  };

  const getPlayerScore = (player: 'user' | 'cpu'): number => {
    return gameState[player].totalScore;
  };

  const isHoleComplete = (holeNumber: number): boolean => {
    return gameState.user.scores.some((score) => score.holeNumber === holeNumber);
  };

  const clearCommentary = () => {
    setGameState((prev) => ({
      ...prev,
      shotCommentary: [],
    }));
  };

  return (
    <GameContext.Provider
      value={{
        gameState,
        startGame,
        submitUserScore,
        resetGame,
        getPlayerScore,
        isHoleComplete,
        clearCommentary,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
