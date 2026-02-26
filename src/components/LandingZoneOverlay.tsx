interface LandingZoneOverlayProps {
  teeDistance: number;
  greenDistance: number;
}

export function LandingZoneOverlay({ teeDistance, greenDistance }: LandingZoneOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center pointer-events-none">
      <p className="text-xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        {Math.round(teeDistance * 1.09361)}
      </p>
      <p className="text-xl font-bold text-green-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        {Math.round(greenDistance * 1.09361)}
      </p>
    </div>
  );
}
