import { CourseOverheadMapView } from './CourseOverheadMapView';

interface ExploreCourseMapViewProps {
  courseName: string;
  onBack: () => void;
}

/** Explore course map: same as course builder overhead view, read-only (no edit options). */
export function ExploreCourseMapView({ courseName, onBack }: ExploreCourseMapViewProps) {
  return <CourseOverheadMapView courseName={courseName} onBack={onBack} />;
}
