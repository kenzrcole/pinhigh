import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { CourseEditorOverheadView } from './CourseEditorOverheadView';
import { CourseEditorHoleView } from './CourseEditorHoleView';
import { COURSES } from '../data/courses';
import { getCourseHoleCount, verifyAllCoursesResolveForHole1 } from '../services/courseBounds';

type EditorView = 'picker' | 'overhead' | 'hole';

interface CourseEditorScreenProps {
  onBack: () => void;
}

export function CourseEditorScreen({ onBack }: CourseEditorScreenProps) {
  const [view, setView] = useState<EditorView>('picker');
  const [pendingHoleNumber, setPendingHoleNumber] = useState<number | null>(null);
  const [editingHoleNumber, setEditingHoleNumber] = useState<number>(1);
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(0);

  useEffect(() => {
    if (import.meta.env.DEV) {
      const { ok, failures } = verifyAllCoursesResolveForHole1();
      if (!ok) console.warn('[CourseEditor] Course bounds verification failed:', failures);
    }
  }, []);

  const courseName = COURSES[selectedCourseIndex]?.name ?? COURSES[0].name;

  const handleSelectCourse = (index: number) => {
    setSelectedCourseIndex(index);
    setView('overhead');
  };

  const handleSelectHole = (holeNumber: number) => {
    setPendingHoleNumber(holeNumber);
  };

  const handleConfirmEditHole = () => {
    if (pendingHoleNumber !== null) {
      setEditingHoleNumber(pendingHoleNumber);
      setPendingHoleNumber(null);
      setView('hole');
    }
  };

  const handleCancelEditHole = () => {
    setPendingHoleNumber(null);
  };

  if (view === 'hole') {
    return (
      <div className="h-full w-full flex flex-col bg-slate-900">
        <CourseEditorHoleView
          courseName={courseName}
          holeNumber={editingHoleNumber}
          onBack={() => setView('overhead')}
        />
      </div>
    );
  }

  if (view === 'picker') {
    return (
      <div className="h-full w-full flex flex-col bg-slate-900">
        <header className="flex items-center gap-3 p-4 border-b border-slate-800 shrink-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-white">Course Editor</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-slate-400 text-sm mb-4">Choose a course to map or edit.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COURSES.map((course, index) => {
              const holeCount = getCourseHoleCount(course.name) || course.holes?.length || 18;
              return (
                <button
                  key={course.name}
                  type="button"
                  onClick={() => handleSelectCourse(index)}
                  className="flex flex-col items-start text-left p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-green-500/50 hover:bg-slate-800/90 transition"
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <MapPin className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="font-semibold text-white truncate flex-1">{course.name}</span>
                    {course.mvpComplete && (
                      <span className="shrink-0 text-xs font-medium text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
                        ✓ MVP
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mt-1">{course.location}</p>
                  <p className="text-slate-400 text-xs mt-1">{holeCount} holes</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-slate-900">
      <header className="flex items-center gap-3 p-4 border-b border-slate-800 shrink-0">
        <button
          onClick={() => setView('picker')}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Back to course list"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-white truncate">{courseName}</h1>
      </header>

      <div className="flex-1 min-h-0">
        <CourseEditorOverheadView
          courseName={courseName}
          onBack={() => setView('picker')}
          onSelectHole={handleSelectHole}
        />
      </div>

      {pendingHoleNumber !== null && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-5 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-1">Edit this hole?</h3>
            <p className="text-slate-400 text-sm mb-4">
              You’re about to edit Hole {pendingHoleNumber}. You can move the tee and green, then save or use presets.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancelEditHole}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEditHole}
                className="flex-1 py-2.5 px-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium transition"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
