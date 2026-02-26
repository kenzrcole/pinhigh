/**
 * Golf Physics Engine
 * Calculates ball trajectory based on initial conditions
 */

export interface TrajectoryPoint {
  x: number;
  y: number;
  z: number;
}

export class GolfPhysics {
  // Physics constants
  static readonly GRAVITY = 9.81; // m/s^2
  static readonly BALL_MASS = 0.0459; // kg
  static readonly AIR_DENSITY = 1.225; // kg/m^3
  static readonly DRAG_COEFFICIENT = 0.3; // dimensionless
  static readonly TIME_STEP = 0.01; // seconds
  static readonly BALL_RADIUS = 0.02135; // meters (standard golf ball radius)
  static readonly BALL_AREA = Math.PI * this.BALL_RADIUS ** 2; // cross-sectional area

  /**
   * Calculate trajectory of a golf ball
   * @param speed - Initial speed in m/s
   * @param angle - Launch angle in degrees (0 = horizontal, 90 = vertical)
   * @param backspin - Backspin in RPM
   * @returns Array of position coordinates
   */
  calculateTrajectory(speed: number, angle: number, backspin: number = 0): TrajectoryPoint[] {
    // Convert angle from degrees to radians
    const angleRad = (angle * Math.PI) / 180;

    // Initial velocity components
    let vx = speed * Math.cos(angleRad); // horizontal velocity (forward)
    let vy = 0; // lateral velocity (sideways, assumed 0)
    let vz = speed * Math.sin(angleRad); // vertical velocity (upward)

    // Initial position
    let x = 0; // forward distance
    let y = 0; // lateral distance
    let z = 0; // height (starting at ground level)

    // Trajectory positions
    const positions: TrajectoryPoint[] = [{ x, y, z }];

    // Simulation loop
    while (z >= 0) {
      // Calculate current speed magnitude
      const currentSpeed = Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2);

      // Calculate drag force (F_drag = 0.5 * ρ * C_d * A * v^2)
      const dragForce = 0.5 * GolfPhysics.AIR_DENSITY * GolfPhysics.DRAG_COEFFICIENT * GolfPhysics.BALL_AREA * currentSpeed ** 2;

      // Drag acceleration (opposite to velocity direction)
      const dragAcceleration = dragForce / GolfPhysics.BALL_MASS;
      
      // Normalize velocity to get direction
      const speedNormalized = currentSpeed > 0 ? currentSpeed : 1;
      const dragAccelX = -dragAcceleration * (vx / speedNormalized);
      const dragAccelY = -dragAcceleration * (vy / speedNormalized);
      const dragAccelZ = -dragAcceleration * (vz / speedNormalized);

      // Update velocities with drag and gravity
      vx += dragAccelX * GolfPhysics.TIME_STEP;
      vy += dragAccelY * GolfPhysics.TIME_STEP;
      vz += dragAccelZ * GolfPhysics.TIME_STEP - GolfPhysics.GRAVITY * GolfPhysics.TIME_STEP;

      // Update positions
      x += vx * GolfPhysics.TIME_STEP;
      y += vy * GolfPhysics.TIME_STEP;
      z += vz * GolfPhysics.TIME_STEP;

      // Store position
      positions.push({ x, y, z });

      // Safety check to prevent infinite loops
      if (positions.length > 100000) {
        break;
      }
    }

    // Ensure final position is at ground level
    const lastPosition = positions[positions.length - 1];
    if (lastPosition.z < 0) {
      lastPosition.z = 0;
    }

    return positions;
  }
}
