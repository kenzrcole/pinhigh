import { useState, useEffect } from 'react';
import {
  MapPin,
  Target,
  TrendingUp,
  Trophy,
  Play,
  RotateCcw,
  ChevronRight,
  Navigation,
} from 'lucide-react';
import { CPUDifficulty, CompanionGameState, CompanionHoleScore } from '../types/companion';
import { simulateCPUScore, getCPUProfileName, getCPUHandicap } from '../utils/cpuScoring';
import { GeoCoordinate } from '../types/courseData';
import { calculateHaversineDistance } from '../utils/haversine';

const MOCK_COURSE = {
  name: 'Pebble Beach Golf Links',
  location: 'Pebble Beach, CA',
  holes: Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: i % 3 === 0 ? 5 : i % 2 === 0 ? 3 : 4,
    green: {
      lat: 36.5674 + (i * 0.001),
      lng: -121.9500 + (i * 0.0008),
    },
  })),
};

export function GolfCompanion() {
  const [gameState, setGameState] = useState<CompanionGameState>({
    currentHole: 1,
    cpuDifficulty: null,
    scores: [],
    userTotal: 0,
    cpuTotal: 0,
    isGameActive: false,
  });

  const [userPosition, setUserPosition] = useState<GeoCoordinate | null>(null);
  const [distanceToGreen, setDistanceToGreen] = useState<number | null>(null);
  const [userScoreInput, setUserScoreInput] = useState('');
  const [showScorecard, setShowScorecard] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setUserPosition({
            lat: 36.5674,
            lng: -121.9500,
          });
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setUserPosition({
        lat: 36.5674,
        lng: -121.9500,
      });
    }
  }, []);

  useEffect(() => {
    if (userPosition && gameState.isGameActive) {
      const currentHoleData = MOCK_COURSE.holes[gameState.currentHole - 1];
      const distance = calculateHaversineDistance(userPosition, currentHoleData.green);
      setDistanceToGreen(distance);
    }
  }, [userPosition, gameState.currentHole, gameState.isGameActive]);

  const startGame = (difficulty: CPUDifficulty) => {
    const initialScores: CompanionHoleScore[] = MOCK_COURSE.holes.map((hole) => ({
      holeNumber: hole.number,
      par: hole.par,
      userScore: null,
      cpuScore: null,
    }));

    setGameState({
      currentHole: 1,
      cpuDifficulty: difficulty,
      scores: initialScores,
      userTotal: 0,
      cpuTotal: 0,
      isGameActive: true,
    });
    setShowScorecard(false);
  };

  const simulateCPUHole = () => {
    if (!gameState.cpuDifficulty) return;

    const currentHoleData = MOCK_COURSE.holes[gameState.currentHole - 1];
    const cpuScore = simulateCPUScore(gameState.cpuDifficulty, currentHoleData.par);

    setGameState((prev) => {
      const updatedScores = [...prev.scores];
      updatedScores[gameState.currentHole - 1].cpuScore = cpuScore;

      return {
        ...prev,
        scores: updatedScores,
        cpuTotal: prev.cpuTotal + cpuScore,
      };
    });
  };

  const submitUserScore = () => {
    const score = parseInt(userScoreInput);
    if (!score || score < 1 || score > 15) return;

    setGameState((prev) => {
      const updatedScores = [...prev.scores];
      updatedScores[gameState.currentHole - 1].userScore = score;

      const newUserTotal = prev.userTotal + score;
      const isLastHole = gameState.currentHole === 18;

      return {
        ...prev,
        scores: updatedScores,
        userTotal: newUserTotal,
        currentHole: isLastHole ? 18 : prev.currentHole + 1,
        isGameActive: !isLastHole,
      };
    });

    setUserScoreInput('');
    if (gameState.currentHole === 18) {
      setShowScorecard(true);
    }
  };

  const resetGame = () => {
    setGameState({
      currentHole: 1,
      cpuDifficulty: null,
      scores: [],
      userTotal: 0,
      cpuTotal: 0,
      isGameActive: false,
    });
    setShowScorecard(false);
    setUserScoreInput('');
  };

  const currentHoleData = gameState.isGameActive
    ? MOCK_COURSE.holes[gameState.currentHole - 1]
    : null;

  const currentHoleScore = gameState.isGameActive
    ? gameState.scores[gameState.currentHole - 1]
    : null;

  if (!gameState.isGameActive && gameState.scores.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-12 pt-8">
              <div className="inline-block p-4 bg-green-500/10 rounded-full mb-4">
                <Trophy className="w-16 h-16 text-green-500" />
              </div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Golf Companion
              </h1>
              <p className="text-gray-400">Play against the CPU</p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-200">
                Select CPU Difficulty
              </h2>

              <button
                onClick={() => startGame('scratch')}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 p-6 rounded-2xl transition transform hover:scale-105 active:scale-95 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-2xl font-bold">Scratch Golfer</p>
                    <p className="text-green-200 text-sm mt-1">0 Handicap - Expert</p>
                  </div>
                  <ChevronRight className="w-8 h-8" />
                </div>
              </button>

              <button
                onClick={() => startGame('10hcp')}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 p-6 rounded-2xl transition transform hover:scale-105 active:scale-95 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-2xl font-bold">10 Handicap</p>
                    <p className="text-blue-200 text-sm mt-1">Intermediate</p>
                  </div>
                  <ChevronRight className="w-8 h-8" />
                </div>
              </button>

              <button
                onClick={() => startGame('20hcp')}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 p-6 rounded-2xl transition transform hover:scale-105 active:scale-95 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-2xl font-bold">20 Handicap</p>
                    <p className="text-amber-200 text-sm mt-1">Beginner Friendly</p>
                  </div>
                  <ChevronRight className="w-8 h-8" />
                </div>
              </button>
            </div>

            <div className="mt-12 p-6 bg-gray-800/50 rounded-2xl border border-gray-700">
              <h3 className="font-semibold mb-3 text-gray-200">Course Info</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span>{MOCK_COURSE.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-green-500" />
                  <span>{MOCK_COURSE.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-500" />
                  <span>18 Holes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showScorecard || !gameState.isGameActive) {
    const userWon = gameState.userTotal < gameState.cpuTotal;
    const tie = gameState.userTotal === gameState.cpuTotal;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white pb-20">
        <div className="px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className={`inline-block p-4 rounded-full mb-4 ${
                userWon ? 'bg-green-500/10' : tie ? 'bg-gray-500/10' : 'bg-red-500/10'
              }`}>
                <Trophy className={`w-16 h-16 ${
                  userWon ? 'text-green-500' : tie ? 'text-gray-400' : 'text-red-500'
                }`} />
              </div>
              <h1 className="text-4xl font-bold mb-2">
                {tie ? "It's a Tie!" : userWon ? 'You Win!' : 'CPU Wins!'}
              </h1>
              <p className="text-gray-400">Final Score</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 p-6 rounded-2xl border border-green-500/30">
                <p className="text-sm text-gray-400 mb-1">You</p>
                <p className="text-4xl font-bold">{gameState.userTotal}</p>
                <p className="text-sm text-green-400 mt-1">
                  {gameState.userTotal - 72 > 0 ? '+' : ''}{gameState.userTotal - 72}
                </p>
              </div>

              <div className="bg-gradient-to-br from-red-600/20 to-red-700/20 p-6 rounded-2xl border border-red-500/30">
                <p className="text-sm text-gray-400 mb-1">
                  {gameState.cpuDifficulty && getCPUProfileName(gameState.cpuDifficulty)}
                </p>
                <p className="text-4xl font-bold">{gameState.cpuTotal}</p>
                <p className="text-sm text-red-400 mt-1">
                  {gameState.cpuTotal - 72 > 0 ? '+' : ''}{gameState.cpuTotal - 72}
                </p>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-4 mb-6">
              <h3 className="font-semibold mb-4 text-lg">Scorecard</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-2 text-gray-400">Hole</th>
                      <th className="text-center py-3 px-2 text-gray-400">Par</th>
                      <th className="text-center py-3 px-2 text-green-400">You</th>
                      <th className="text-center py-3 px-2 text-red-400">CPU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameState.scores.map((score) => (
                      <tr key={score.holeNumber} className="border-b border-gray-800">
                        <td className="py-3 px-2">{score.holeNumber}</td>
                        <td className="text-center py-3 px-2 text-gray-400">{score.par}</td>
                        <td className="text-center py-3 px-2">
                          <span className={`font-semibold ${
                            score.userScore === null ? 'text-gray-600' :
                            score.userScore < score.par ? 'text-green-400' :
                            score.userScore > score.par ? 'text-red-400' :
                            'text-white'
                          }`}>
                            {score.userScore ?? '-'}
                          </span>
                        </td>
                        <td className="text-center py-3 px-2">
                          <span className={`font-semibold ${
                            score.cpuScore === null ? 'text-gray-600' :
                            score.cpuScore < score.par ? 'text-green-400' :
                            score.cpuScore > score.par ? 'text-red-400' :
                            'text-white'
                          }`}>
                            {score.cpuScore ?? '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={resetGame}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 p-4 rounded-xl font-semibold transition transform hover:scale-105 active:scale-95"
            >
              <RotateCcw className="w-5 h-5 inline mr-2" />
              New Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white pb-24">
      <div className="px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Hole {gameState.currentHole}</h1>
              <p className="text-sm text-gray-400">Par {currentHoleData?.par}</p>
            </div>
            <button
              onClick={() => setShowScorecard(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition"
            >
              View Card
            </button>
          </div>

          <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 border border-green-500/30 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-500/20 rounded-full">
                <Navigation className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Distance to Green</p>
                <p className="text-3xl font-bold">
                  {distanceToGreen !== null
                    ? distanceToGreen < 1000
                      ? `${Math.round(distanceToGreen)}m`
                      : `${(distanceToGreen / 1000).toFixed(2)}km`
                    : 'Loading...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MapPin className="w-4 h-4" />
              <span>GPS Tracking Active</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">You</span>
              </div>
              <p className="text-3xl font-bold">{gameState.userTotal}</p>
              <p className="text-xs text-gray-500 mt-1">
                {gameState.userTotal - (gameState.currentHole - 1) * 4 > 0 ? '+' : ''}
                {gameState.userTotal - (gameState.currentHole - 1) * 4}
              </p>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-red-400" />
                <span className="text-sm text-gray-400">
                  {gameState.cpuDifficulty && getCPUProfileName(gameState.cpuDifficulty).split(' ')[0]}
                </span>
              </div>
              <p className="text-3xl font-bold">{gameState.cpuTotal}</p>
              <p className="text-xs text-gray-500 mt-1">
                {gameState.cpuTotal - (gameState.currentHole - 1) * 4 > 0 ? '+' : ''}
                {gameState.cpuTotal - (gameState.currentHole - 1) * 4}
              </p>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 mb-6">
            <h3 className="font-semibold mb-4">CPU Simulation</h3>
            {currentHoleScore?.cpuScore === null ? (
              <button
                onClick={simulateCPUHole}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 p-4 rounded-xl font-semibold transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Simulate CPU Hole
              </button>
            ) : (
              <div className="text-center p-6 bg-gray-900/50 rounded-xl">
                <p className="text-sm text-gray-400 mb-2">CPU Score</p>
                <p className="text-5xl font-bold text-red-400">{currentHoleScore.cpuScore}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {currentHoleScore.cpuScore === currentHoleScore.par
                    ? 'Par'
                    : currentHoleScore.cpuScore < currentHoleScore.par
                    ? currentHoleScore.cpuScore === currentHoleScore.par - 1
                      ? 'Birdie'
                      : 'Eagle'
                    : currentHoleScore.cpuScore === currentHoleScore.par + 1
                    ? 'Bogey'
                    : currentHoleScore.cpuScore === currentHoleScore.par + 2
                    ? 'Double Bogey'
                    : 'Triple Bogey'}
                </p>
              </div>
            )}
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Enter Your Score</h3>
            <div className="flex gap-3">
              <input
                type="number"
                min="1"
                max="15"
                value={userScoreInput}
                onChange={(e) => setUserScoreInput(e.target.value)}
                placeholder="Strokes"
                className="flex-1 px-4 py-4 bg-gray-900 border border-gray-700 rounded-xl focus:border-green-500 focus:outline-none transition text-lg"
                onKeyDown={(e) => e.key === 'Enter' && submitUserScore()}
              />
              <button
                onClick={submitUserScore}
                disabled={!userScoreInput || currentHoleScore?.cpuScore === null}
                className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 rounded-xl font-semibold transition"
              >
                Next
              </button>
            </div>
            {currentHoleScore?.cpuScore === null && (
              <p className="text-xs text-yellow-500 mt-3">Simulate CPU score first</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
