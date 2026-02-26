import { VirtualGolfer } from '../VirtualGolfer';
import { GeoCoordinate } from '../types/courseData';

interface SimulationResult {
  strokes: number;
  finalPosition: GeoCoordinate;
  shotDetails: Array<{
    shotNumber: number;
    lie: 'tee' | 'fairway' | 'rough';
    distanceToGreen: number;
    landed: 'green' | 'fairway' | 'rough';
  }>;
  commentary: string[];
}

export function simulateCPUHole(
  cpuHandicap: number,
  teePosition: GeoCoordinate,
  greenPosition: GeoCoordinate,
  par: number
): SimulationResult {
  const golfer = new VirtualGolfer(cpuHandicap, 'tee', 'CPU');
  const maxStrokes = par + 4;

  const result = golfer.playHole(teePosition, greenPosition, maxStrokes);

  const shotDetails = result.shotHistory.map(shot => ({
    shotNumber: shot.shot,
    lie: shot.start.lat === teePosition.lat && shot.start.lng === teePosition.lng ? 'tee' as const :
         shot.result === 'Green' ? 'green' as const :
         shot.result === 'Fairway' ? 'fairway' as const :
         'rough' as const,
    distanceToGreen: shot.distanceYards * 0.9144,
    landed: shot.result.toLowerCase() as 'green' | 'fairway' | 'rough',
  }));

  const commentary = result.shotHistory.map(shot => shot.commentary);

  return {
    strokes: result.strokes,
    finalPosition: result.finalPosition,
    shotDetails,
    commentary,
  };
}
