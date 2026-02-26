import { CourseOverheadMapView } from './CourseOverheadMapView';

interface CourseEditorOverheadViewProps {
  courseName: string;
  onBack: () => void;
  onSelectHole: (holeNumber: number) => void;
}

export function CourseEditorOverheadView({
  courseName,
  onBack,
  onSelectHole,
}: CourseEditorOverheadViewProps) {
  return (
    <CourseOverheadMapView
      courseName={courseName}
      onBack={onBack}
      onSelectHole={onSelectHole}
    />
  );
}
