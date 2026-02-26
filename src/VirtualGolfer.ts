type LieType = 'tee' | 'fairway' | 'rough' | 'green';
type ClubType = 'driver' | 'long-iron' | 'short-iron' | 'wedge' | 'putter';

interface GeoCoordinate {
  lat: number;
  lng: number;
}

interface Club {
  name: ClubType;
  maxDistance: number;
  variance: number;
}

interface ShotHistoryEntry {
  shot: number;
  club: ClubType;
  start: GeoCoordinate;
  end: GeoCoordinate;
  result: string;
  commentary: string;
  distanceYards: number;
  remainingYards: number;
}

interface HoleResult {
  strokes: number;
  shotHistory: ShotHistoryEntry[];
  finalPosition: GeoCoordinate;
}

export class VirtualGolfer {
  private handicap: number;
  private currentLie: LieType;
  private playerName: string;
  private clubBag: Club[];

  constructor(handicap: number, currentLie: LieType = 'tee', playerName: string = 'CPU') {
    this.handicap = Math.max(-10, Math.min(36, handicap));
    this.currentLie = currentLie;
    this.playerName = playerName;
    this.clubBag = [
      { name: 'driver', maxDistance: 290, variance: 0.15 },
      { name: 'long-iron', maxDistance: 210, variance: 0.10 },
      { name: 'short-iron', maxDistance: 150, variance: 0.08 },
      { name: 'wedge', maxDistance: 100, variance: 0.05 },
      { name: 'putter', maxDistance: 50, variance: 0.03 }
    ];
  }

  private boxMullerTransform(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  private selectClub(distanceYards: number): Club {
    if (this.currentLie === 'green') {
      return this.clubBag.find(c => c.name === 'putter')!;
    }

    if (distanceYards > 230) {
      return this.clubBag.find(c => c.name === 'driver')!;
    } else if (distanceYards >= 150) {
      return this.clubBag.find(c => c.name === 'long-iron')!;
    } else if (distanceYards >= 50) {
      return this.clubBag.find(c => c.name === 'short-iron')!;
    } else {
      return this.clubBag.find(c => c.name === 'wedge')!;
    }
  }

  private calculateDistance(pos1: GeoCoordinate, pos2: GeoCoordinate): number {
    const R = 6371000;
    const lat1 = (pos1.lat * Math.PI) / 180;
    const lat2 = (pos2.lat * Math.PI) / 180;
    const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
    const dLng = ((pos2.lng - pos1.lng) * Math.PI) / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private calculateBearing(from: GeoCoordinate, to: GeoCoordinate): number {
    const lat1 = (from.lat * Math.PI) / 180;
    const lat2 = (to.lat * Math.PI) / 180;
    const dLng = ((to.lng - from.lng) * Math.PI) / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    const bearing = Math.atan2(y, x);
    return ((bearing * 180) / Math.PI + 360) % 360;
  }

  private applyGaussianNoise(targetDistance: number, club: Club): { distance: number; angle: number } {
    const handicapErrorFactor = this.handicap <= 0
      ? Math.abs(this.handicap) * 0.02
      : this.handicap * 0.015;

    const totalVariance = club.variance + handicapErrorFactor;

    const lieMultiplier = {
      tee: 1.0,
      fairway: 1.1,
      rough: 1.5,
      green: 0.5,
    }[this.currentLie];

    const distanceError = this.boxMullerTransform() * totalVariance * lieMultiplier;
    const angleError = this.boxMullerTransform() * 10 * totalVariance * lieMultiplier;

    const actualDistance = Math.min(targetDistance * (1 + distanceError), club.maxDistance);

    return {
      distance: Math.max(actualDistance, 0),
      angle: angleError
    };
  }

  private moveToCoordinate(
    start: GeoCoordinate,
    bearing: number,
    distanceMeters: number
  ): GeoCoordinate {
    const R = 6371000;
    const bearingRad = (bearing * Math.PI) / 180;
    const angularDistance = distanceMeters / R;

    const lat1 = (start.lat * Math.PI) / 180;
    const lng1 = (start.lng * Math.PI) / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
    );

    const lng2 = lng1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
      lat: (lat2 * 180) / Math.PI,
      lng: (lng2 * 180) / Math.PI,
    };
  }

  private determineLie(distanceToGreen: number, accuracy: number): LieType {
    if (distanceToGreen < 5) {
      return 'green';
    }

    if (accuracy > 0.8) {
      return 'fairway';
    } else if (accuracy > 0.5) {
      return 'rough';
    } else {
      return 'rough';
    }
  }

  private generateCommentary(
    shotNumber: number,
    club: ClubType,
    shotDistanceYards: number,
    remainingYards: number,
    result: string,
    holedOut: boolean
  ): string {
    if (holedOut) {
      return `Shot ${shotNumber}: ${this.playerName} drains it! Hole complete.`;
    }

    const clubName = club === 'long-iron' ? '5-Iron' :
                     club === 'short-iron' ? '7-Iron' :
                     club.charAt(0).toUpperCase() + club.slice(1);

    if (remainingYards < 3) {
      return `Shot ${shotNumber}: ${clubName} ${Math.round(shotDistanceYards)}y... tap-in range!`;
    } else if (remainingYards < 15) {
      return `Shot ${shotNumber}: ${clubName} ${Math.round(shotDistanceYards)}y... lands ${Math.round(remainingYards)}ft from the pin!`;
    } else {
      return `Shot ${shotNumber}: ${clubName} ${Math.round(shotDistanceYards)}y... ${Math.round(remainingYards)}y remaining.`;
    }
  }

  playHole(startCoords: GeoCoordinate, holeCoords: GeoCoordinate, maxStrokes: number = 10): HoleResult {
    let currentPosition = { ...startCoords };
    let shotHistory: ShotHistoryEntry[] = [];
    let strokes = 0;

    while (strokes < maxStrokes) {
      strokes++;

      const distanceToPin = this.calculateDistance(currentPosition, holeCoords);
      const distanceYards = distanceToPin * 1.09361;

      if (distanceYards < 1) {
        currentPosition = { ...holeCoords };
        shotHistory.push({
          shot: strokes,
          club: 'putter',
          start: currentPosition,
          end: holeCoords,
          result: 'Holed',
          commentary: `Shot ${strokes}: ${this.playerName} drains it! Hole complete.`,
          distanceYards: distanceYards,
          remainingYards: 0
        });
        break;
      }

      const club = this.selectClub(distanceYards);

      const targetDistance = Math.min(distanceYards, club.maxDistance);
      const bearing = this.calculateBearing(currentPosition, holeCoords);
      const noise = this.applyGaussianNoise(targetDistance, club);

      const adjustedBearing = bearing + noise.angle;
      const shotDistanceMeters = (noise.distance * 0.9144);

      const landingPosition = this.moveToCoordinate(
        currentPosition,
        adjustedBearing,
        shotDistanceMeters
      );

      const newDistanceToPin = this.calculateDistance(landingPosition, holeCoords);
      const remainingYards = newDistanceToPin * 1.09361;

      const accuracy = 1 - (Math.abs(noise.angle) / 10);
      const lie = this.determineLie(newDistanceToPin, accuracy);

      const result = lie === 'green' ? 'Green' :
                     lie === 'fairway' ? 'Fairway' :
                     'Rough';

      const holedOut = remainingYards < 1;
      const finalPosition = holedOut ? { ...holeCoords } : landingPosition;

      const actualShotDistance = this.calculateDistance(currentPosition, finalPosition);
      const actualShotYards = actualShotDistance * 1.09361;

      const commentary = this.generateCommentary(
        strokes,
        club.name,
        actualShotYards,
        remainingYards,
        result,
        holedOut
      );

      shotHistory.push({
        shot: strokes,
        club: club.name,
        start: currentPosition,
        end: finalPosition,
        result,
        commentary,
        distanceYards: Math.round(distanceYards),
        remainingYards: Math.round(remainingYards)
      });

      currentPosition = finalPosition;
      this.currentLie = lie;

      if (holedOut) {
        break;
      }
    }

    return {
      strokes,
      shotHistory,
      finalPosition: currentPosition
    };
  }

  getHandicap(): number {
    return this.handicap;
  }

  getCurrentLie(): LieType {
    return this.currentLie;
  }

  setCurrentLie(lie: LieType): void {
    this.currentLie = lie;
  }
}

export type { GeoCoordinate, ShotHistoryEntry, HoleResult, ClubType };
