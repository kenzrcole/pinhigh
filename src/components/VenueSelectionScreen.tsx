import { ChevronLeft, ChevronRight, Home, MapPin } from 'lucide-react';
import type { Venue } from '../data/courses';
import { getTeeSetInfo } from '../services/courseBounds';

interface VenueSelectionScreenProps {
  venues: Venue[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  teeSetNames?: string[];
  selectedTeeSetIndex?: number;
  onSelectTeeSetIndex?: (index: number) => void;
  /** When single course, pass course name so we can show tee set yardage/rating/slope. */
  selectedCourseName?: string;
  onConfirm: () => void;
  onBackToHome: () => void;
}

export function VenueSelectionScreen({
  venues,
  selectedIndex,
  onSelectIndex,
  teeSetNames = [],
  selectedTeeSetIndex = 0,
  onSelectTeeSetIndex,
  selectedCourseName,
  onConfirm,
  onBackToHome,
}: VenueSelectionScreenProps) {
  const venue = venues[selectedIndex];
  const hasMultiple = venues.length > 1;
  const hasMultipleTees = teeSetNames.length > 1;
  const singleCourse = venue.courses.length === 1;
  const teeSetInfo =
    selectedCourseName != null
      ? getTeeSetInfo(selectedCourseName, selectedTeeSetIndex)
      : undefined;

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
        <h1 className="text-lg font-semibold text-white">Select Course</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm flex items-center gap-2">
          {hasMultiple && (
            <button
              onClick={() => onSelectIndex((selectedIndex - 1 + venues.length) % venues.length)}
              className="p-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              aria-label="Previous venue"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div className="flex-1 bg-slate-800/80 rounded-2xl border border-slate-700 p-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="p-3 rounded-xl bg-green-500/20">
                <MapPin className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">{venue.name}</h2>
            <p className="text-slate-400 text-sm mt-1">{venue.location}</p>
            <p className="text-slate-500 text-xs mt-2">
              {singleCourse
                ? venue.courses[0].holes.length
                  ? `${venue.courses[0].holes.length} holes`
                  : '18 holes (full map)'
                : `${venue.courses.length} courses`}
            </p>
            {singleCourse && hasMultipleTees && (
              <div className="mt-3">
                <label className="text-slate-400 text-xs block mb-1">Tees</label>
                <select
                  value={selectedTeeSetIndex}
                  onChange={(e) => onSelectTeeSetIndex?.(Number(e.target.value))}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 text-white text-sm py-2 px-3"
                >
                  {teeSetNames.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
                {teeSetInfo && (
                  <div className="mt-2 text-slate-400 text-xs space-y-0.5">
                    <p>{teeSetInfo.totalYardage.toLocaleString()} yds</p>
                    <p>Rating {teeSetInfo.courseRating} · Slope {teeSetInfo.slopeRating}</p>
                  </div>
                )}
              </div>
            )}
            {singleCourse && teeSetInfo && !hasMultipleTees && (
              <div className="mt-2 text-slate-400 text-xs space-y-0.5">
                <p>{teeSetInfo.totalYardage.toLocaleString()} yds</p>
                <p>Rating {teeSetInfo.courseRating} · Slope {teeSetInfo.slopeRating}</p>
              </div>
            )}
          </div>

          {hasMultiple && (
            <button
              onClick={() => onSelectIndex((selectedIndex + 1) % venues.length)}
              className="p-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              aria-label="Next venue"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        <p className="text-slate-500 text-xs mt-4">
          {hasMultiple ? 'Use arrows to change venue' : ''}
        </p>
      </div>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={onConfirm}
          className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition"
        >
          Next: {singleCourse ? 'Competition Format' : 'Choose course'}
        </button>
      </div>
    </div>
  );
}
