import { useState } from 'react';
import { ChevronLeft, ChevronRight, List, X } from 'lucide-react';
import { Hole } from '../data/mockHoleData';

interface HoleSelectorProps {
  holes: Hole[];
  currentHole: number;
  onHoleSelect: (holeNumber: number) => void;
  courseName: string;
}

export function HoleSelector({ holes, currentHole, onHoleSelect, courseName }: HoleSelectorProps) {
  const [showHoleList, setShowHoleList] = useState(false);

  const handlePrevious = () => {
    const newHole = currentHole > 1 ? currentHole - 1 : holes.length;
    onHoleSelect(newHole);
  };

  const handleNext = () => {
    const newHole = currentHole < holes.length ? currentHole + 1 : 1;
    onHoleSelect(newHole);
  };

  const currentHoleData = holes.find((h) => h.number === currentHole);

  return (
    <>
      <div className="bg-slate-900/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Previous hole"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          <button
            onClick={() => setShowHoleList(true)}
            className="flex-1 mx-3 text-center"
          >
            <div className="text-sm text-slate-400">{courseName}</div>
            <div className="text-2xl font-bold text-white">
              Hole {currentHole}
            </div>
            {currentHoleData && (
              <div className="text-xs text-slate-400 mt-1">
                Par {currentHoleData.par} • {currentHoleData.yardage} yards
              </div>
            )}
          </button>

          <button
            onClick={handleNext}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Next hole"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>

        <button
          onClick={() => setShowHoleList(true)}
          className="w-full mt-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold text-white transition flex items-center justify-center gap-2 min-h-[44px]"
        >
          <List className="w-4 h-4" />
          View All Holes
        </button>
      </div>

      {showHoleList && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{courseName}</h2>
                <p className="text-sm text-slate-400">
                  Par {holes.reduce((sum, h) => sum + h.par, 0)} • {' '}
                  {holes.reduce((sum, h) => sum + h.yardage, 0).toLocaleString()} yards
                </p>
              </div>
              <button
                onClick={() => setShowHoleList(false)}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {holes.map((hole) => {
                  const isActive = hole.number === currentHole;
                  return (
                    <button
                      key={hole.number}
                      onClick={() => {
                        onHoleSelect(hole.number);
                        setShowHoleList(false);
                      }}
                      className={`p-4 rounded-xl border-2 transition transform active:scale-95 ${
                        isActive
                          ? 'bg-green-600 border-green-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-sm font-semibold mb-1">Hole {hole.number}</div>
                      <div className="text-xs opacity-80">
                        Par {hole.par}
                      </div>
                      <div className="text-xs opacity-80">
                        {hole.yardage} yds
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-3">Course Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Front 9</p>
                    <p className="text-white font-semibold">
                      Par {holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Back 9</p>
                    <p className="text-white font-semibold">
                      Par {holes.slice(9).reduce((sum, h) => sum + h.par, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Par 3s</p>
                    <p className="text-white font-semibold">
                      {holes.filter((h) => h.par === 3).length} holes
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Par 4s</p>
                    <p className="text-white font-semibold">
                      {holes.filter((h) => h.par === 4).length} holes
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Par 5s</p>
                    <p className="text-white font-semibold">
                      {holes.filter((h) => h.par === 5).length} holes
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Total Holes</p>
                    <p className="text-white font-semibold">{holes.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
