import { useRef, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Icon, LeafletMouseEvent } from 'leaflet';

interface DraggableMarkerProps {
  position: [number, number];
  icon: Icon;
  name: string;
  draggable: boolean;
  onDragEnd: (lat: number, lng: number) => void;
}

export function DraggableMarker({ position, icon, name, draggable, onDragEnd }: DraggableMarkerProps) {
  const markerRef = useRef<any>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          onDragEnd(latLng.lat, latLng.lng);
        }
      },
    }),
    [onDragEnd]
  );

  return (
    <Marker
      draggable={draggable}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={icon}
    >
      <Popup>
        <div className="text-center">
          <strong>{name}</strong>
          {draggable && (
            <p className="text-xs text-gray-600 mt-1">Drag to reposition</p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
