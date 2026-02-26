import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchCourseData } from '../utils/mockCourseData';
import { HoleData, GeoCoordinate } from '../types/courseData';
import { calculateHaversineDistance } from '../utils/haversine';

const teeIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const greenIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const bunkerIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const userIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export function CourseMap() {
  const [userPosition, setUserPosition] = useState<GeoCoordinate | null>(null);
  const [courseData, setCourseData] = useState<HoleData | null>(null);
  const [distanceToGreen, setDistanceToGreen] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const data = fetchCourseData();
    setCourseData(data);

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserPosition(newPosition);
          setLocationError(null);

          if (data) {
            const distance = calculateHaversineDistance(newPosition, data.green);
            setDistanceToGreen(distance);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationError('Unable to get GPS location');

          const mockPosition = {
            lat: 34.0522,
            lng: -118.2437,
          };
          setUserPosition(mockPosition);

          if (data) {
            const distance = calculateHaversineDistance(mockPosition, data.green);
            setDistanceToGreen(distance);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLocationError('Geolocation not supported');
      const mockPosition = {
        lat: 34.0522,
        lng: -118.2437,
      };
      setUserPosition(mockPosition);

      if (data) {
        const distance = calculateHaversineDistance(mockPosition, data.green);
        setDistanceToGreen(distance);
      }
    }
  }, []);

  if (!courseData || !userPosition) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading course data...</p>
        </div>
      </div>
    );
  }

  const centerPosition: LatLngExpression = [
    (courseData.tee.lat + courseData.green.lat) / 2,
    (courseData.tee.lng + courseData.green.lng) / 2,
  ];

  return (
    <div className="relative w-full h-screen">
      <MapContainer
        center={centerPosition}
        zoom={16}
        className="w-full h-full"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
        />

        <Marker position={[courseData.tee.lat, courseData.tee.lng]} icon={teeIcon}>
          <Popup>
            <div className="text-center">
              <strong>Tee Box</strong>
              <br />
              Hole {courseData.holeNumber} - Par {courseData.par}
            </div>
          </Popup>
        </Marker>

        <Marker position={[courseData.green.lat, courseData.green.lng]} icon={greenIcon}>
          <Popup>
            <div className="text-center">
              <strong>Green</strong>
              <br />
              Hole {courseData.holeNumber}
            </div>
          </Popup>
        </Marker>

        {courseData.bunkers.map((bunker, index) => (
          <Marker
            key={index}
            position={[bunker.lat, bunker.lng]}
            icon={bunkerIcon}
          >
            <Popup>
              <div className="text-center">
                <strong>Bunker {index + 1}</strong>
              </div>
            </Popup>
          </Marker>
        ))}

        <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
          <Popup>
            <div className="text-center">
              <strong>Your Position</strong>
              {locationError && (
                <>
                  <br />
                  <span className="text-xs text-orange-600">(Mock Location)</span>
                </>
              )}
            </div>
          </Popup>
        </Marker>

        <Circle
          center={[userPosition.lat, userPosition.lng]}
          radius={10}
          pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.3 }}
        />
      </MapContainer>

      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
        <h3 className="font-bold text-lg mb-2">Hole {courseData.holeNumber}</h3>
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-semibold">Par:</span> {courseData.par}
          </p>
          {distanceToGreen !== null && (
            <p>
              <span className="font-semibold">Distance to Green:</span>{' '}
              {distanceToGreen < 1000
                ? `${distanceToGreen.toFixed(1)} m`
                : `${(distanceToGreen / 1000).toFixed(2)} km`}
            </p>
          )}
          {locationError && (
            <p className="text-xs text-orange-600 mt-2">{locationError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
