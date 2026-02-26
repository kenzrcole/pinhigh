import { ChevronLeft, ChevronRight, Home, Map, ListOrdered } from 'lucide-react';
import type { Course } from '../data/courses';

type ExploreSubView = 'picker' | 'course-map' | 'hole-by-hole';

interface ExploreScreenProps {
  courses: Course[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onChooseCourseMap: () => void;
  onChooseHoleByHole: () => void;
  onBackToHome: () => void;
}

export function ExploreScreen({
  courses,
  selectedIndex,
  onSelectIndex,
  onChooseCourseMap,
  onChooseHoleByHole,
  onBackToHome,
}: ExploreScreenProps) {
  const course = courses[selectedIndex];
  const hasMultiple = courses.length > 1;

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-slate-800">
        <button
          onClick={onBackToHome}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Home"
        >
          <Home className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-white">Explore</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col px-4 py-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          {hasMultiple && (
            <button
              onClick={() => onSelectIndex((selectedIndex - 1 + courses.length) % courses.length)}
              className="p-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition shrink-0"
              aria-label="Previous course"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div className="flex-1 flex flex-col items-center justify-center min-h-[180px] max-w-[280px]">
            <div className="w-full aspect-video max-h-[140px] rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
              <div className="text-slate-500 p-4 text-center">
                <Map className="w-12 h-12 mx-auto mb-2 opacity-60" />
                <span className="text-xs">Course map view</span>
              </div>
            </div>
            <h2 className="text-lg font-bold text-white mt-3 text-center">{course.name}</h2>
            <p className="text-slate-400 text-sm mt-0.5">{course.location}</p>
          </div>

          {hasMultiple && (
            <button
              onClick={() => onSelectIndex((selectedIndex + 1) % courses.length)}
              className="p-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition shrink-0"
              aria-label="Next course"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        <p className="text-slate-500 text-xs text-center mb-6">
          {hasMultiple ? 'Use arrows to change course' : ''}
        </p>

        <div className="space-y-3">
          <button
            onClick={onChooseCourseMap}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-left transition"
          >
            <div className="p-3 rounded-xl bg-green-500/20">
              <Map className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="font-semibold">Course Map</p>
              <p className="text-xs text-slate-400 mt-0.5">Overhead view of the full course. Pinch and drag to explore.</p>
            </div>
          </button>

          <button
            onClick={onChooseHoleByHole}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-left transition"
          >
            <div className="p-3 rounded-xl bg-blue-500/20">
              <ListOrdered className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="font-semibold">Hole by Hole</p>
              <p className="text-xs text-slate-400 mt-0.5">View each hole with distance. Pinch and drag to explore.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
