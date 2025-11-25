
export interface Point {
  x: number;
  y: number;
}

export interface Orb {
  id: string;
  color: string;
  x: number;
  y: number;
  radius: number;
  isDragging: boolean;
  baseX?: number;
  baseY?: number;
}

export interface Word {
  id: string;
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isCaught: boolean;
  caughtLineId?: string;
  pathProgress?: number;
  opacity: number;
  // For chaotic motion
  tOffset: number; 
}

export interface LinePath {
  id: string;
  points: Point[];
  color: string;
  timestamp: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'background' | 'negative' | 'sparkle' | 'trail';
  // Additional props for effects
  rotation?: number;
  rotationSpeed?: number;
}

export interface CenterOrbColor {
  color: string;
  angle: number;
  radius: number; // distance from center
  speed: number;
  blobSize: number;
}

export interface CenterOrbState {
  colors: CenterOrbColor[];
  scale: number;
}
