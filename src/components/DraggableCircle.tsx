import { useRef, useMemo, useEffect, useState } from 'react';
import { Circle, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, LeafletMouseEvent } from 'leaflet';

interface DraggableCircleProps {
  position: [number, number];
  radius: number;
  name: string;
  draggable: boolean;
  pathOptions: {
    color: string;
    fillColor: string;
    fillOpacity: number;
  };
  onDragEnd: (lat: number, lng: number) => void;
  hideMarker?: boolean;
}

const circleMarkerIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33]
});

export function DraggableCircle({
  position,
  radius,
  name,
  draggable,
  pathOptions,
  onDragEnd,
  hideMarker = false,
}: DraggableCircleProps) {
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const map = useMap();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!hideMarker || !draggable || !circleRef.current) return;

    const circle = circleRef.current;

    const handleMouseDown = (e: LeafletMouseEvent) => {
      setIsDragging(true);
      map.dragging.disable();
      e.originalEvent.preventDefault();
    };

    const handleMouseMove = (e: LeafletMouseEvent) => {
      if (isDragging) {
        const { lat, lng } = e.latlng;
        circle.setLatLng([lat, lng]);
      }
    };

    const handleMouseUp = (e: LeafletMouseEvent) => {
      if (isDragging) {
        setIsDragging(false);
        map.dragging.enable();
        const { lat, lng } = e.latlng;
        onDragEnd(lat, lng);
      }
    };

    circle.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    return () => {
      circle.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
    };
  }, [hideMarker, draggable, isDragging, map, onDragEnd]);

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
    <>
      <Circle
        center={position}
        radius={radius}
        pathOptions={pathOptions}
        ref={circleRef}
      >
        {!draggable && (
          <Popup>
            <div className="text-center">
              <strong>{name}</strong>
            </div>
          </Popup>
        )}
      </Circle>
      {draggable && !hideMarker && (
        <Marker
          draggable={true}
          eventHandlers={eventHandlers}
          position={position}
          ref={markerRef}
          icon={circleMarkerIcon}
        >
          <Popup>
            <div className="text-center">
              <strong>{name}</strong>
              <p className="text-xs text-gray-600 mt-1">Drag to reposition</p>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}
