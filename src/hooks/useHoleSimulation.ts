/**
 * useHoleSimulation — Recursive Shot-Selection System (FIG 4).
 * Runs full simulation instantly; requestAnimationFrame animates ball flight.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { detectLie, type LieType, type HoleGeoJSON, type LatLng } from '../engine/LieDetector';
import { runHoleSimulation, type ShotStep } from '../engine/runHoleSimulation';

export type { ShotStep };

export interface UseHoleSimulationParams {
  teePosition: LatLng;
  pinPosition: LatLng;
  holeGeoJSON: HoleGeoJSON;
  par: number;
  handicap: number;
  fairwayCenter?: LatLng | null;
  maxShots?: number;
}

export interface UseHoleSimulationResult {
  ballPosition: LatLng;
  shotCount: number;
  currentLie: LieType | null;
  isHoled: boolean;
  shots: ShotStep[];
  isAnimating: boolean;
  play: () => void;
  reset: () => void;
}

export function useHoleSimulation(params: UseHoleSimulationParams): UseHoleSimulationResult {
  const {
    teePosition,
    pinPosition,
    holeGeoJSON,
    par,
    handicap,
    fairwayCenter,
    maxShots = 20,
  } = params;

  const [ballPosition, setBallPosition] = useState<LatLng>(() => ({ ...teePosition }));
  const [shotCount, setShotCount] = useState(0);
  const [currentLie, setCurrentLie] = useState<LieType | null>(null);
  const [isHoled, setIsHoled] = useState(false);
  const [shots, setShots] = useState<ShotStep[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const animationIndexRef = useRef(0);
  const resultRef = useRef<{ shots: ShotStep[]; finalPosition: LatLng; isHoled: boolean; shotCount: number } | null>(null);
  const rafRef = useRef<number>(0);

  const reset = useCallback(() => {
    setBallPosition({ ...teePosition });
    setShotCount(0);
    setCurrentLie(null);
    setIsHoled(false);
    setShots([]);
    setIsAnimating(false);
    animationIndexRef.current = 0;
    resultRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [teePosition]);

  const play = useCallback(() => {
    const result = runHoleSimulation({
      teePosition,
      pinPosition,
      holeGeoJSON,
      par,
      handicap,
      fairwayCenter,
      maxShots,
    });
    resultRef.current = result;
    setShots(result.shots);
    setShotCount(result.shotCount);
    setIsHoled(result.isHoled);
    setCurrentLie(result.shots.length ? result.shots[result.shots.length - 1].lie : null);

    if (result.shots.length === 0) return;

    setBallPosition(result.shots[0].from);
    animationIndexRef.current = 0;
    setIsAnimating(true);

    const startTime = performance.now();
    const durationMs = 800;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const idx = Math.min(
        animationIndexRef.current,
        Math.floor((elapsed / durationMs) * result.shots.length)
      );
      if (idx > animationIndexRef.current) {
        animationIndexRef.current = idx;
      }
      if (idx < result.shots.length) {
        const step = result.shots[idx];
        const stepStart = (idx / result.shots.length) * durationMs;
        const stepElapsed = elapsed - stepStart;
        const stepDuration = durationMs / result.shots.length;
        const t = Math.min(1, stepElapsed / stepDuration);
        const lat = step.from.lat + (step.to.lat - step.from.lat) * t;
        const lng = step.from.lng + (step.to.lng - step.from.lng) * t;
        setBallPosition({ lat, lng });
      } else {
        setBallPosition(result.finalPosition);
        setIsAnimating(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [
    teePosition,
    pinPosition,
    holeGeoJSON,
    par,
    handicap,
    fairwayCenter,
    maxShots,
  ]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    ballPosition,
    shotCount,
    currentLie,
    isHoled,
    shots,
    isAnimating,
    play,
    reset,
  };
}
