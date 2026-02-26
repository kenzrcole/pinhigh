import { useState, useEffect } from 'react';
import { Map, FileText, Settings } from 'lucide-react';
import { HoleMapView } from './HoleMapViewGoogleMaps';
import { ScorecardView } from './ScorecardView';
import { SettingsView } from './SettingsView';
import { HomeScreen } from './HomeScreen';
import { AppSettingsScreen } from './AppSettingsScreen';
import { CourseEditorScreen } from './CourseEditorScreen';
import { VenueSelectionScreen } from './VenueSelectionScreen';
import { VenueCourseSelectionScreen } from './VenueCourseSelectionScreen';
import { CompetitionFormatScreen } from './CompetitionFormatScreen';
import { AISelectionScreen } from './AISelectionScreen';
import { ExploreScreen } from './ExploreScreen';
import { ExploreCourseMapView } from './ExploreCourseMapView';
import { ExploreHoleByHoleView } from './ExploreHoleByHoleView';
import { StatsScreen } from './StatsScreen';
import { StoreScreen } from './StoreScreen';
import { StoreCategoryScreen } from './StoreCategoryScreen';
import { STORE_CATEGORIES } from '../data/storeCategories';
import { useCurrentRound } from '../context/CurrentRoundContext';
import { useGolfGame } from '../context/GolfGameContext';
import { saveRoundToHistory } from '../services/roundHistoryStore';
import { COURSES, VENUES } from '../data/courses';
import type { Course } from '../data/courses';
import { getCourseHoleCount, getTeeSetNames, getTeeSetInfo } from '../services/courseBounds';

type View = 'map' | 'scorecard' | 'settings';
type FlowView =
  | 'home'
  | 'app-settings'
  | 'course-editor'
  | 'course'
  | 'venue-course'
  | 'competition'
  | 'ai'
  | 'round'
  | 'explore'
  | 'stats'
  | 'store'
  | 'store-players'
  | 'store-maps'
  | 'store-orgs';
type ExploreSubView = 'picker' | 'course-map' | 'hole-by-hole';

export function GolfGPSApp() {
  const { round, setRound } = useCurrentRound();
  const { gameState } = useGolfGame();
  const [currentView, setCurrentView] = useState<View>('map');
  const [flowView, setFlowView] = useState<FlowView>(() =>
    round.courseName ? 'round' : 'home'
  );
  const [exploreSubView, setExploreSubView] = useState<ExploreSubView>('picker');
  const [exploreCourseIndex, setExploreCourseIndex] = useState(0);
  const [selectedVenueIndex, setSelectedVenueIndex] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedTeeSetIndex, setSelectedTeeSetIndex] = useState(0);
  const [venueCourseIndex, setVenueCourseIndex] = useState<number | null>(null);
  const [venueTeeSetIndex, setVenueTeeSetIndex] = useState(0);

  useEffect(() => {
    if (!round.courseName && flowView === 'round') setFlowView('home');
  }, [round.courseName, flowView]);

  const handleStartRound = () => {
    const course = selectedCourse;
    if (!course) return;
    const holeCount = getCourseHoleCount(course.name) || 18;
    const teeSetNames = getTeeSetNames(course.name);
    const selectedTeeSet = teeSetNames.length > 0 ? teeSetNames[selectedTeeSetIndex] ?? teeSetNames[0] : undefined;
    setRound({
      courseName: course.name,
      selectedTeeSet,
      currentHoleNumber: 1,
      aiScoresByHole: Array(holeCount),
      userScoresByHole: Array(holeCount),
      userStatsByHole: Array(holeCount),
      aiStatsByHole: Array(holeCount),
    });
    setFlowView('round');
  };

  const handleEndRound = () => {
    saveRoundToHistory(round, gameState.aiProfile);
    setRound({
      courseName: '',
      selectedTeeSet: undefined,
      currentHoleNumber: 1,
      aiScoresByHole: Array(18),
      userScoresByHole: Array(18),
      userStatsByHole: Array(18),
      aiStatsByHole: Array(18),
    });
    setFlowView('home');
  };

  if (flowView === 'home') {
    return (
      <HomeScreen
        onPlay={() => setFlowView('course')}
        onExplore={() => setFlowView('explore')}
        onStore={() => setFlowView('store')}
        onStats={() => setFlowView('stats')}
        onSettings={() => setFlowView('app-settings')}
      />
    );
  }

  if (flowView === 'store') {
    return (
      <StoreScreen
        onBackToHome={() => setFlowView('home')}
        onPlayers={() => setFlowView('store-players')}
        onPremiumMaps={() => setFlowView('store-maps')}
        onOrgs={() => setFlowView('store-orgs')}
      />
    );
  }

  if (flowView === 'store-players') {
    const config = STORE_CATEGORIES.find((c) => c.id === 'players');
    return (
      <StoreCategoryScreen
        title={config?.title ?? 'Players'}
        items={config?.items ?? []}
        onBack={() => setFlowView('store')}
      />
    );
  }

  if (flowView === 'store-maps') {
    const config = STORE_CATEGORIES.find((c) => c.id === 'premium-maps');
    return (
      <StoreCategoryScreen
        title={config?.title ?? 'Premium Maps'}
        items={config?.items ?? []}
        onBack={() => setFlowView('store')}
      />
    );
  }

  if (flowView === 'store-orgs') {
    const config = STORE_CATEGORIES.find((c) => c.id === 'orgs');
    return (
      <StoreCategoryScreen
        title={config?.title ?? 'Orgs & Integrations'}
        items={config?.items ?? []}
        onBack={() => setFlowView('store')}
      />
    );
  }

  if (flowView === 'app-settings') {
    return (
      <AppSettingsScreen
        onBackToHome={() => setFlowView('home')}
        onEditCourse={() => setFlowView('course-editor')}
      />
    );
  }

  if (flowView === 'course-editor') {
    return (
      <div className="h-full w-full min-h-0 flex flex-col">
        <CourseEditorScreen onBack={() => setFlowView('app-settings')} />
      </div>
    );
  }

  if (flowView === 'course') {
    const venue = VENUES[selectedVenueIndex];
    const singleCourse = venue?.courses.length === 1;
    const teeSetNames = singleCourse
      ? getTeeSetNames(venue.courses[0].name)
      : [];
    return (
      <VenueSelectionScreen
        venues={VENUES}
        selectedIndex={selectedVenueIndex}
        onSelectIndex={(i) => {
          setSelectedVenueIndex(i);
          setSelectedTeeSetIndex(0);
        }}
        teeSetNames={teeSetNames}
        selectedTeeSetIndex={selectedTeeSetIndex}
        onSelectTeeSetIndex={setSelectedTeeSetIndex}
        selectedCourseName={singleCourse ? venue.courses[0].name : undefined}
        onConfirm={() => {
          if (singleCourse) {
            setSelectedCourse(venue.courses[0]);
            setFlowView('competition');
          } else {
            setVenueCourseIndex(null);
            setVenueTeeSetIndex(0);
            setFlowView('venue-course');
          }
        }}
        onBackToHome={() => setFlowView('home')}
      />
    );
  }

  if (flowView === 'venue-course') {
    const venue = VENUES[selectedVenueIndex];
    const course =
      venueCourseIndex != null ? venue.courses[venueCourseIndex] : null;
    const teeSetNames = course ? getTeeSetNames(course.name) : [];
    return (
      <VenueCourseSelectionScreen
        venue={venue}
        selectedCourseIndex={venueCourseIndex}
        onSelectCourse={(i) => {
          setVenueCourseIndex(i);
          setVenueTeeSetIndex(0);
        }}
        teeSetNames={teeSetNames}
        selectedTeeSetIndex={venueTeeSetIndex}
        onSelectTeeSetIndex={setVenueTeeSetIndex}
        selectedCourseName={course?.name}
        onConfirm={() => {
          if (venueCourseIndex == null) return;
          setSelectedCourse(venue.courses[venueCourseIndex]);
          setSelectedTeeSetIndex(venueTeeSetIndex);
          setFlowView('competition');
        }}
        onBack={() => setFlowView('course')}
        onBackToHome={() => setFlowView('home')}
      />
    );
  }

  if (flowView === 'competition') {
    return (
      <CompetitionFormatScreen
        onConfirm={() => setFlowView('ai')}
        onBackToCourse={() => setFlowView('course')}
        onBackToHome={() => setFlowView('home')}
      />
    );
  }

  if (flowView === 'explore') {
    const exploreCourse = COURSES[exploreCourseIndex];
    if (exploreSubView === 'course-map') {
      return (
        <ExploreCourseMapView
          courseName={exploreCourse.name}
          onBack={() => setExploreSubView('picker')}
        />
      );
    }
    if (exploreSubView === 'hole-by-hole') {
      return (
        <ExploreHoleByHoleView
          courseName={exploreCourse.name}
          onBack={() => setExploreSubView('picker')}
        />
      );
    }
    return (
      <ExploreScreen
        courses={COURSES}
        selectedIndex={exploreCourseIndex}
        onSelectIndex={setExploreCourseIndex}
        onChooseCourseMap={() => setExploreSubView('course-map')}
        onChooseHoleByHole={() => setExploreSubView('hole-by-hole')}
        onBackToHome={() => setFlowView('home')}
      />
    );
  }

  if (flowView === 'ai') {
    return (
      <AISelectionScreen
        onStartRound={handleStartRound}
        onBackToCompetition={() => setFlowView('competition')}
        onBackToHome={() => setFlowView('home')}
      />
    );
  }

  if (flowView === 'stats') {
    return (
      <StatsScreen onBackToHome={() => setFlowView('home')} />
    );
  }

  return (
    <div className="h-screen w-full bg-slate-900 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {currentView === 'map' && <HoleMapView />}
        {currentView === 'scorecard' && <ScorecardView />}
        {currentView === 'settings' && (
          <SettingsView onEndRound={handleEndRound} />
        )}
      </div>

      <nav className="bg-slate-950 border-t border-slate-800 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          <button
            onClick={() => setCurrentView('map')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-xl transition min-h-[60px] ${
              currentView === 'map'
                ? 'bg-green-600 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Map className="w-6 h-6" />
            <span className="text-xs font-semibold">Map</span>
          </button>

          <button
            onClick={() => setCurrentView('scorecard')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-xl transition min-h-[60px] ${
              currentView === 'scorecard'
                ? 'bg-green-600 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <FileText className="w-6 h-6" />
            <span className="text-xs font-semibold">Scorecard</span>
          </button>

          <button
            onClick={() => setCurrentView('settings')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-xl transition min-h-[60px] ${
              currentView === 'settings'
                ? 'bg-green-600 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-semibold">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
