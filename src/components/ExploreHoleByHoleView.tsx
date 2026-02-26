import { useState, useMemo } from 'react';
import { useJsApiLoader, GoogleMap, Marker } from '@react-google-maps/api';
import { calculateHaversineDistance } from '../utils/haversine';
import { getTeeAndGreenForCourse, getCourseHoleCount } from '../services/courseBounds';

const mapContainerStyle = { width: '100%', height: '100%' };

const exploreMapOptions: google.maps.MapOptions = {
  zoomControl: true,
  scrollwheel: true,
  disableDoubleClickZoom: false,
  gestureHandling: 'greedy',
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  minZoom: 14,
  maxZoom: 20,
  mapTypeId: 'satellite',
  tilt: 0,
};

interface ExploreHoleByHoleViewProps {
  courseName: string;
  onBack: () => void;
}

export function ExploreHoleByHoleView({ courseName, onBack }: ExploreHoleByHoleViewProps) {
  const [currentHole, setCurrentHole] = useState(1);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: 'google-map-script',
    preventGoogleFontsLoading: true,
  });

  const holeCount = getCourseHoleCount(courseName);
  const teeGreen = useMemo(
    () => getTeeAndGreenForCourse(courseName, currentHole),
    [courseName, currentHole]
  );

  const mapCenter = teeGreen
    ? {
        lat: (teeGreen.tee.lat + teeGreen.green.lat) / 2,
        lng: (teeGreen.tee.lng + teeGreen.green.lng) / 2,
      }
    : { lat: 37.78, lng: -122.5 };

  const distanceToHoleMeters = teeGreen
    ? calculateHaversineDistance(teeGreen.tee, teeGreen.green)
    : 0;
  const distanceYards = Math.round(distanceToHoleMeters * 1.09361);

  if (!apiKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4">
        <p className="font-semibold">Missing Google Maps API key</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white">
          Back
        </button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4">
        <p className="font-semibold">Failed to load map</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white">
          Back
        </button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400">
        Loading map...
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col relative">
      <div className="absolute top-2 left-2 right-2 z-[1000] flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-xl bg-slate-900/95 text-white font-medium shadow-lg shrink-0"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/95 text-white shadow-lg">
          <button
            onClick={() => setCurrentHole((h) => Math.max(1, h - 1))}
            disabled={currentHole <= 1}
            className="p-1 rounded disabled:opacity-40"
            aria-label="Previous hole"
          >
            ‹
          </button>
          <span className="font-semibold min-w-[4rem] text-center">
            Hole {currentHole}
          </span>
          <button
            onClick={() => setCurrentHole((h) => Math.min(holeCount, h + 1))}
            disabled={currentHole >= holeCount}
            className="p-1 rounded disabled:opacity-40"
            aria-label="Next hole"
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <GoogleMap
          mapContainerStyle={{ ...mapContainerStyle, position: 'absolute', inset: 0 }}
          center={mapCenter}
          zoom={17}
          options={exploreMapOptions}
        >
          {teeGreen && (
            <>
              <Marker
                position={teeGreen.tee}
                label={{ text: 'T', color: 'white', fontWeight: 'bold', fontSize: '12px' }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 14,
                  fillColor: '#1e3a5f',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
                zIndex={1000}
              />
              <Marker
                position={teeGreen.green}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: '#ffffff',
                  fillOpacity: 1,
                  strokeColor: '#0f766e',
                  strokeWeight: 2,
                }}
                zIndex={1000}
              />
            </>
          )}
        </GoogleMap>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-[1000]">
        <div className="rounded-xl bg-slate-900/95 backdrop-blur border border-slate-700 p-4 shadow-lg">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Distance to hole (tee → green)</p>
          <p className="text-2xl font-bold text-white">{distanceYards} yds</p>
          <p className="text-xs text-slate-500 mt-1">Pinch and drag to explore the hole</p>
        </div>
      </div>
    </div>
  );
}
