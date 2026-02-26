import { ChevronLeft, Home, MapPin } from 'lucide-react';
import type { Course, Venue } from '../data/courses';
import { getTeeSetInfo } from '../services/courseBounds';

interface VenueCourseSelectionScreenProps {
  venue: Venue;
  selectedCourseIndex: number | null;
  onSelectCourse: (index: number) => void;
  teeSetNames: string[];
  selectedTeeSetIndex: number;
  onSelectTeeSetIndex: (index: number) => void;
  selectedCourseName?: string;
  onConfirm: () => void;
  onBack: () => void;
  onBackToHome: () => void;
}

export function VenueCourseSelectionScreen({
  venue,
  selectedCourseIndex,
  onSelectCourse,
  teeSetNames,
  selectedTeeSetIndex,
  onSelectTeeSetIndex,
  selectedCourseName,
  onConfirm,
  onBack,
  onBackToHome,
}: VenueCourseSelectionScreenProps) {
  const hasMultipleTees = teeSetNames.length > 1;
  const selectedCourse =
    selectedCourseIndex != null ? venue.courses[selectedCourseIndex] : null;
  const teeSetInfo =
    selectedCourseName != null
      ? getTeeSetInfo(selectedCourseName, selectedTeeSetIndex)
      : undefined;

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-slate-800">
        <button
          onClick={onBack}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-white">Select course</h1>
        <button
          onClick={onBackToHome}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Home"
        >
          <Home className="w-6 h-6" />
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6">
        <p className="text-slate-400 text-sm mb-4 text-center">
          {venue.name} — choose a course
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          {venue.courses.map((course: Course, index: number) => (
            <button
              key={course.name}
              type="button"
              onClick={() => onSelectCourse(index)}
              className={`rounded-2xl border p-4 text-left transition flex flex-col min-h-[100px] ${
                selectedCourseIndex === index
                  ? 'bg-green-600/20 border-green-500 text-white'
                  : 'bg-slate-800/80 border-slate-700 text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-xl bg-green-500/20">
                  <MapPin className="w-5 h-5 text-green-400" />
                </div>
              </div>
              <span className="font-semibold text-sm line-clamp-2">{course.name}</span>
              <span className="text-slate-400 text-xs mt-1">
                {course.holes.length ? `${course.holes.length} holes` : '18 holes'}
              </span>
            </button>
          ))}
        </div>

        {selectedCourse && hasMultipleTees && (
          <div className="mt-6 max-w-md mx-auto">
            <label className="text-slate-400 text-xs block mb-1">Tees</label>
            <select
              value={selectedTeeSetIndex}
              onChange={(e) => onSelectTeeSetIndex(Number(e.target.value))}
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
        {selectedCourse && teeSetInfo && !hasMultipleTees && (
          <div className="mt-4 max-w-md mx-auto text-slate-400 text-xs space-y-0.5">
            <p>{teeSetInfo.totalYardage.toLocaleString()} yds</p>
            <p>Rating {teeSetInfo.courseRating} · Slope {teeSetInfo.slopeRating}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onConfirm}
          disabled={selectedCourseIndex == null}
          className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:pointer-events-none text-white font-semibold transition"
        >
          Next: Competition Format
        </button>
      </div>
    </div>
  );
}
