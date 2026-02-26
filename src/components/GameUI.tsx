import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Trophy, User, Cpu } from 'lucide-react';
import { ShotFeed } from './ShotFeed';

export function GameUI() {
  const { gameState, startGame, submitUserScore, resetGame, isHoleComplete, clearCommentary } = useGame();
  const [userHandicap, setUserHandicap] = useState(10);
  const [cpuHandicap, setCpuHandicap] = useState(15);
  const [currentStrokes, setCurrentStrokes] = useState('');
  const [currentPar] = useState(4);

  const handleStartGame = () => {
    startGame(userHandicap, cpuHandicap);
  };

  const handleSubmitScore = () => {
    const strokes = parseInt(currentStrokes);
    if (strokes > 0 && strokes <= 15) {
      submitUserScore(gameState.currentHole, strokes, currentPar);
      setCurrentStrokes('');
    }
  };

  const calculateScoreToPar = (totalScore: number, holesPlayed: number): string => {
    const expectedPar = holesPlayed * 4;
    const diff = totalScore - expectedPar;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  if (!gameState.isGameActive && gameState.user.scores.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Golf Game</h1>
            <p className="text-gray-600">Set up your game to begin</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4" />
                Your Handicap
              </label>
              <input
                type="number"
                min="0"
                max="36"
                value={userHandicap}
                onChange={(e) => setUserHandicap(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Cpu className="w-4 h-4" />
                CPU Handicap
              </label>
              <input
                type="number"
                min="0"
                max="36"
                value={cpuHandicap}
                onChange={(e) => setCpuHandicap(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition"
              />
            </div>

            <button
              onClick={handleStartGame}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-lg transition transform hover:scale-105 active:scale-95"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  const gameComplete = !gameState.isGameActive && gameState.user.scores.length > 0;

  if (gameComplete) {
    const userWon = gameState.user.totalScore < gameState.cpu.totalScore;
    const tie = gameState.user.totalScore === gameState.cpu.totalScore;

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <Trophy className={`w-20 h-20 mx-auto mb-4 ${userWon ? 'text-yellow-500' : 'text-gray-400'}`} />
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              {tie ? "It's a Tie!" : userWon ? 'You Win!' : 'CPU Wins!'}
            </h1>
            <p className="text-gray-600">Game Complete</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 rounded-xl p-6 text-center">
              <User className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <p className="text-sm font-semibold text-gray-600 mb-1">User</p>
              <p className="text-3xl font-bold text-gray-800">{gameState.user.totalScore}</p>
              <p className="text-sm text-gray-500 mt-1">
                {calculateScoreToPar(gameState.user.totalScore, gameState.user.scores.length)}
              </p>
            </div>

            <div className="bg-red-50 rounded-xl p-6 text-center">
              <Cpu className="w-8 h-8 mx-auto mb-2 text-red-600" />
              <p className="text-sm font-semibold text-gray-600 mb-1">CPU</p>
              <p className="text-3xl font-bold text-gray-800">{gameState.cpu.totalScore}</p>
              <p className="text-sm text-gray-500 mt-1">
                {calculateScoreToPar(gameState.cpu.totalScore, gameState.cpu.scores.length)}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Scorecard</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-2">Hole</th>
                    <th className="text-center py-2">Par</th>
                    <th className="text-center py-2">User</th>
                    <th className="text-center py-2">CPU</th>
                  </tr>
                </thead>
                <tbody>
                  {gameState.user.scores.map((score, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-2">{score.holeNumber}</td>
                      <td className="text-center">{score.par}</td>
                      <td className="text-center font-semibold">{score.strokes}</td>
                      <td className="text-center font-semibold">
                        {gameState.cpu.scores[idx]?.strokes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={resetGame}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-lg transition transform hover:scale-105 active:scale-95"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Hole {gameState.currentHole}
            </h2>
            <div className="text-right">
              <p className="text-sm text-gray-600">Par {currentPar}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-700">User</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {gameState.user.totalScore}
              </p>
              <p className="text-sm text-gray-500">
                {calculateScoreToPar(gameState.user.totalScore, gameState.user.scores.length)}
              </p>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-gray-700">CPU</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {gameState.cpu.totalScore}
              </p>
              <p className="text-sm text-gray-500">
                {calculateScoreToPar(gameState.cpu.totalScore, gameState.cpu.scores.length)}
              </p>
            </div>
          </div>

          {!isHoleComplete(gameState.currentHole) && (
            <div className="border-t pt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Enter Your Score for Hole {gameState.currentHole}
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={currentStrokes}
                  onChange={(e) => setCurrentStrokes(e.target.value)}
                  placeholder="Strokes"
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitScore()}
                />
                <button
                  onClick={handleSubmitScore}
                  disabled={!currentStrokes}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition"
                >
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>

        {gameState.shotCommentary.length > 0 && (
          <div className="mb-6">
            <ShotFeed commentary={gameState.shotCommentary} />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="font-semibold text-gray-700 mb-4">Scorecard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 px-2">Hole</th>
                  <th className="text-center py-3 px-2">Par</th>
                  <th className="text-center py-3 px-2">User</th>
                  <th className="text-center py-3 px-2">CPU</th>
                </tr>
              </thead>
              <tbody>
                {gameState.user.scores.map((score, idx) => {
                  const cpuScore = gameState.cpu.scores[idx];
                  return (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-3 px-2">{score.holeNumber}</td>
                      <td className="text-center py-3 px-2">{score.par}</td>
                      <td className="text-center py-3 px-2">
                        <span className={`font-semibold ${
                          score.strokes < score.par ? 'text-green-600' :
                          score.strokes > score.par ? 'text-red-600' :
                          'text-gray-800'
                        }`}>
                          {score.strokes}
                        </span>
                      </td>
                      <td className="text-center py-3 px-2">
                        <span className={`font-semibold ${
                          cpuScore.strokes < cpuScore.par ? 'text-green-600' :
                          cpuScore.strokes > cpuScore.par ? 'text-red-600' :
                          'text-gray-800'
                        }`}>
                          {cpuScore.strokes}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
