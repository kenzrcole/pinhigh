import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { DomUtil, LatLng } from 'leaflet';
import { createRoot } from 'react-dom/client';
import { LandingZoneOverlay } from './LandingZoneOverlay';

interface MapOverlayProps {
  position: [number, number];
  teeDistance: number;
  greenDistance: number;
}

export function MapOverlay({ position, teeDistance, greenDistance }: MapOverlayProps) {
  const map = useMap();

  useEffect(() => {
    const container = DomUtil.create('div');
    container.style.position = 'absolute';
    container.style.zIndex = '1000';
    container.style.pointerEvents = 'none';

    const root = createRoot(container);
    root.render(<LandingZoneOverlay teeDistance={teeDistance} greenDistance={greenDistance} />);

    const updatePosition = () => {
      const point = map.latLngToContainerPoint(new LatLng(position[0], position[1]));
      container.style.left = `${point.x}px`;
      container.style.top = `${point.y}px`;
      container.style.transform = 'translate(-50%, -50%)';
    };

    map.getContainer().appendChild(container);
    updatePosition();

    map.on('move zoom', updatePosition);

    return () => {
      map.off('move zoom', updatePosition);
      root.unmount();
      container.remove();
    };
  }, [map, position, teeDistance, greenDistance]);

  return null;
}
