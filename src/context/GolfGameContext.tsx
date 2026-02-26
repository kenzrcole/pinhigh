import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
const SETTINGS_STORAGE_KEY = 'golfGPS_settings';

export interface PlayerScore {
  holeNumber: number;
  strokes: number;
  par: number;
}

export interface GameSettings {
  isProMode: boolean;
  windSpeed: number;
  windDirection: number;
  slope: number;
}

/** AI opponent: named character/tour or numeric handicap. */
export type AIProfile =
  | 'EW 2K'
  | 'PGA Tour'
  | 'LPGA Tour'
  | 'D.B.'
  | 'J.D.'
  | 'M.R.'
  | 'N.J.'
  | number;

/** Competition format for the round. */
export type CompetitionFormat = 'stroke-play' | 'match-play' | 'team-scramble' | 'tournament';

/** Team best ball scramble: partner and number of opposing teams. */
export interface TeamScrambleOptions {
  partnerType: 'friend' | 'ai';
  opponentsCount: 1 | 2;
}

/** Tournament mode: field size, play style, and field handicap variance (10% worse to 10% better). */
export const TOURNAMENT_FIELD_SIZES = [20, 25, 30, 40, 50, 60, 100, 120] as const;
export type TournamentFieldSize = (typeof TOURNAMENT_FIELD_SIZES)[number];
export type TournamentPlayStyle = 'net' | 'gross';

export interface TournamentOptions {
  fieldSize: TournamentFieldSize;
  playStyle: TournamentPlayStyle;
  /** Field handicap variance: -0.1 (10% worse) to 0.1 (10% better). Same bar as AI variance. */
  fieldHandicapVariance: number;
}

/** App tier: Free (limited AI, no variance), Premium (all features), Course Pro (+ course editor). */
export type AppTier = 'free' | 'premium' | 'course-pro';

/** AI handicaps allowed on Free tier. */
export const FREE_TIER_AI_HANDICAPS = [0, 5, 10, 15, 20] as const;

function isAllowedForFreeTier(profile: AIProfile): boolean {
  if (typeof profile !== 'number') return false;
  return (FREE_TIER_AI_HANDICAPS as readonly number[]).includes(profile);
}

export interface GolfGameState {
  currentHole: number;
  playerScores: PlayerScore[];
  aiScores: PlayerScore[];
  settings: GameSettings;
  aiHandicap: number;
  aiProfile: AIProfile;
  /** AI plays 10% worse to 10% better: -0.1 to 0.1. 0 = stock. Premium/Course Pro only. */
  aiVariance: number;
  /** Free: AI 0,5,10,15,20 only, no variance. Premium: all. Course Pro: all + course editor. */
  appTier: AppTier;
  shotCommentary: string[];
  /** Competition format chosen between course and AI selection. */
  competitionFormat: CompetitionFormat;
  /** Set when competitionFormat is 'team-scramble'. */
  teamScrambleOptions: TeamScrambleOptions | null;
  /** Set when competitionFormat is 'tournament'. */
  tournamentOptions: TournamentOptions | null;
}

interface GolfGameContextType {
  gameState: GolfGameState;
  setAiProfile: (profile: AIProfile) => void;
  setAiVariance: (variance: number) => void;
  setAppTier: (tier: AppTier) => void;
  setCompetitionFormat: (format: CompetitionFormat) => void;
  setTeamScrambleOptions: (options: TeamScrambleOptions | null) => void;
  setTournamentOptions: (options: TournamentOptions | null) => void;
  toggleProMode: () => void;
  addPlayerScore: (holeNumber: number, strokes: number, par: number) => void;
  addAIScore: (holeNumber: number, strokes: number, par: number) => void;
  nextHole: () => void;
  resetGame: () => void;
  getTotalScore: (player: 'player' | 'ai') => number;
  addShotCommentary: (commentary: string) => void;
  clearCommentary: () => void;
}

const GolfGameContext = createContext<GolfGameContextType | undefined>(undefined);

const defaultTournamentOptions: TournamentOptions = {
  fieldSize: 30,
  playStyle: 'net',
  fieldHandicapVariance: 0,
};

const initialGameState: GolfGameState = {
  currentHole: 1,
  playerScores: [],
  aiScores: [],
  settings: {
    isProMode: false,
    windSpeed: 8,
    windDirection: 270,
    slope: 2.5,
  },
  aiHandicap: 15,
  aiProfile: 15 as AIProfile,
  aiVariance: 0,
  appTier: 'free' as AppTier,
  shotCommentary: [],
  competitionFormat: 'stroke-play',
  teamScrambleOptions: null,
  tournamentOptions: null,
};

function loadPersistedSettings(): Partial<Pick<GolfGameState, 'aiProfile' | 'aiHandicap' | 'settings' | 'appTier'>> {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { aiProfile?: string | number; settings?: GameSettings; appTier?: AppTier };
    const out: Partial<Pick<GolfGameState, 'aiProfile' | 'aiHandicap' | 'settings' | 'appTier'>> = {};
    if (parsed.aiProfile !== undefined) {
      const p = parsed.aiProfile;
      if (p === 'EW 2K') {
        out.aiProfile = 'EW 2K';
        out.aiHandicap = -8;
      } else if (
        typeof p === 'string' &&
        ['PGA Tour', 'LPGA Tour', 'D.B.', 'J.D.', 'M.R.', 'N.J.'].includes(p)
      ) {
        out.aiProfile = p as AIProfile;
        out.aiHandicap = p === 'LPGA Tour' ? 2 : 0;
      } else if (
        typeof p === 'string' &&
        ['Bryson De Chambeau', 'Dustin Johnson', 'Rory McIlroy', 'Jack Nicklaus'].includes(p)
      ) {
        const map: Record<string, AIProfile> = {
          'Bryson De Chambeau': 'D.B.',
          'Dustin Johnson': 'J.D.',
          'Rory McIlroy': 'M.R.',
          'Jack Nicklaus': 'N.J.',
        };
        out.aiProfile = map[p];
        out.aiHandicap = 0;
      } else if (typeof p === 'number' && p >= -10 && p <= 40) {
        out.aiProfile = p as AIProfile;
        out.aiHandicap = p;
      }
    }
    if (parsed.settings && typeof parsed.settings === 'object') {
      out.settings = {
        isProMode: Boolean(parsed.settings.isProMode),
        windSpeed: typeof parsed.settings.windSpeed === 'number' ? parsed.settings.windSpeed : initialGameState.settings.windSpeed,
        windDirection: typeof parsed.settings.windDirection === 'number' ? parsed.settings.windDirection : initialGameState.settings.windDirection,
        slope: typeof parsed.settings.slope === 'number' ? parsed.settings.slope : initialGameState.settings.slope,
      };
    }
    if (parsed.appTier === 'free' || parsed.appTier === 'premium' || parsed.appTier === 'course-pro') {
      out.appTier = parsed.appTier;
    }
    return out;
  } catch {
    return {};
  }
}

function persistSettings(aiProfile: AIProfile, settings: GameSettings, appTier: AppTier) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ aiProfile, settings, appTier }));
  } catch {
    // ignore
  }
}

export function GolfGameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GolfGameState>(() => {
    const saved = loadPersistedSettings();
    const tier = saved.appTier ?? initialGameState.appTier;
    let aiProfile = saved.aiProfile ?? initialGameState.aiProfile;
    if (tier === 'free' && !isAllowedForFreeTier(aiProfile)) {
      aiProfile = 15 as AIProfile;
    }
    const aiHandicap =
      aiProfile === 'EW 2K' ? -8 : aiProfile === 'LPGA Tour' ? 2 : typeof aiProfile === 'number' ? aiProfile : 15;
    return {
      ...initialGameState,
      ...saved,
      appTier: tier,
      aiProfile,
      aiHandicap: saved.aiHandicap ?? aiHandicap,
      settings: saved.settings ?? initialGameState.settings,
    };
  });

  useEffect(() => {
    persistSettings(gameState.aiProfile, gameState.settings, gameState.appTier);
  }, [gameState.aiProfile, gameState.settings, gameState.appTier]);

  const setAiProfile = (aiProfile: AIProfile) => {
    setGameState((prev) => ({
      ...prev,
      aiProfile,
      aiHandicap:
        aiProfile === 'EW 2K' ? -8 : aiProfile === 'LPGA Tour' ? 2 : typeof aiProfile === 'number' ? aiProfile : 15,
    }));
  };

  const setAiVariance = (aiVariance: number) => {
    setGameState((prev) => ({
      ...prev,
      aiVariance: Math.max(-0.1, Math.min(0.1, aiVariance)),
    }));
  };

  const setAppTier = (tier: AppTier) => {
    setGameState((prev) => {
      const next = { ...prev, appTier: tier };
      if (tier === 'free') {
        next.aiVariance = 0;
        if (!isAllowedForFreeTier(prev.aiProfile)) {
          next.aiProfile = 15 as AIProfile;
          next.aiHandicap = 15;
        }
      }
      return next;
    });
  };

  const setCompetitionFormat = (competitionFormat: CompetitionFormat) => {
    setGameState((prev) => ({
      ...prev,
      competitionFormat,
      teamScrambleOptions: competitionFormat === 'team-scramble' ? prev.teamScrambleOptions ?? { partnerType: 'ai', opponentsCount: 1 } : null,
      tournamentOptions: competitionFormat === 'tournament' ? prev.tournamentOptions ?? defaultTournamentOptions : null,
    }));
  };

  const setTeamScrambleOptions = (teamScrambleOptions: TeamScrambleOptions | null) => {
    setGameState((prev) => ({ ...prev, teamScrambleOptions }));
  };

  const setTournamentOptions = (tournamentOptions: TournamentOptions | null) => {
    setGameState((prev) => ({ ...prev, tournamentOptions }));
  };

  const toggleProMode = () => {
    setGameState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        isProMode: !prev.settings.isProMode,
      },
    }));
  };

  const addPlayerScore = (holeNumber: number, strokes: number, par: number) => {
    setGameState((prev) => ({
      ...prev,
      playerScores: [
        ...prev.playerScores,
        { holeNumber, strokes, par },
      ],
    }));
  };

  const addAIScore = (holeNumber: number, strokes: number, par: number) => {
    setGameState((prev) => ({
      ...prev,
      aiScores: [
        ...prev.aiScores,
        { holeNumber, strokes, par },
      ],
    }));
  };

  const nextHole = () => {
    setGameState((prev) => ({
      ...prev,
      currentHole: Math.min(prev.currentHole + 1, 18),
    }));
  };

  const resetGame = () => {
    setGameState({
      ...initialGameState,
      settings: {
        ...initialGameState.settings,
        isProMode: gameState.settings.isProMode,
      },
      aiHandicap:
        gameState.aiProfile === 'EW 2K'
          ? -8
          : gameState.aiProfile === 'LPGA Tour'
            ? 2
            : typeof gameState.aiProfile === 'number'
              ? gameState.aiProfile
              : 15,
      aiProfile: gameState.aiProfile,
      aiVariance: gameState.aiVariance,
      appTier: gameState.appTier,
    });
  };

  const getTotalScore = (player: 'player' | 'ai'): number => {
    const scores = player === 'player' ? gameState.playerScores : gameState.aiScores;
    return scores.reduce((total, score) => total + score.strokes, 0);
  };

  const addShotCommentary = (commentary: string) => {
    setGameState((prev) => ({
      ...prev,
      shotCommentary: [commentary, ...prev.shotCommentary].slice(0, 10),
    }));
  };

  const clearCommentary = () => {
    setGameState((prev) => ({
      ...prev,
      shotCommentary: [],
    }));
  };

  return (
    <GolfGameContext.Provider
      value={{
        gameState,
        setAiProfile,
        setAiVariance,
        setAppTier,
        setCompetitionFormat,
        setTeamScrambleOptions,
        setTournamentOptions,
        toggleProMode,
        addPlayerScore,
        addAIScore,
        nextHole,
        resetGame,
        getTotalScore,
        addShotCommentary,
        clearCommentary,
      }}
    >
      {children}
    </GolfGameContext.Provider>
  );
}

export function useGolfGame() {
  const context = useContext(GolfGameContext);
  if (context === undefined) {
    throw new Error('useGolfGame must be used within a GolfGameProvider');
  }
  return context;
}
