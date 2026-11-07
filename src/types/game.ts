export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  name: string;
  label: string;
  description: string;
  color: string;
  targetRadius: number; // radius in px
  targetSpeed: number; // vertical oscillation speed
  maxWind: number; // max wind speed in m/s (-max to +max)
  trajectoryGuideRatio: number; // 1 = full arc, 0.4 = partial, 0.15 = minimal
  arrowsPerRound: number;
  passScore: number;
  bonusAppleChance: number;
  distanceMultiplier: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    name: 'easy',
    label: 'Easy',
    description: 'Calm breeze, big target, full trajectory guide. Great for beginners!',
    color: '#10b981', // emerald
    targetRadius: 48,
    targetSpeed: 0, // static target
    maxWind: 2.0,
    trajectoryGuideRatio: 0.95,
    arrowsPerRound: 12,
    passScore: 350,
    bonusAppleChance: 0.4,
    distanceMultiplier: 0.72,
  },
  normal: {
    name: 'normal',
    label: 'Normal',
    description: 'Moving target, shifting wind, medium trajectory guide. Test your timing!',
    color: '#3b82f6', // blue
    targetRadius: 38,
    targetSpeed: 70, // smooth bobbing
    maxWind: 6.0,
    trajectoryGuideRatio: 0.45,
    arrowsPerRound: 10,
    passScore: 450,
    bonusAppleChance: 0.6,
    distanceMultiplier: 0.88,
  },
  hard: {
    name: 'hard',
    label: 'Hard',
    description: 'High turbulent gusts, swift oscillating target, tiny guide. True marksman challenge!',
    color: '#ef4444', // red
    targetRadius: 28,
    targetSpeed: 130, // fast movement with oscillation
    maxWind: 12.0,
    trajectoryGuideRatio: 0.18,
    arrowsPerRound: 8,
    passScore: 500,
    bonusAppleChance: 0.8,
    distanceMultiplier: 1.05,
  },
};

export interface Arrow {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  angle: number;
  isFlying: boolean;
  isStuck: boolean;
  stuckTargetId?: string; // target it attached to
  stuckOffset?: { x: number; y: number }; // relative offset to target center
  trail: { x: number; y: number; alpha: number }[];
}

export interface Target {
  id: string;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  speed: number;
  amplitude: number;
  phase: number;
  type: 'standard' | 'balloon' | 'apple';
  pointsMultiplier: number;
  active: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  life: number;
  maxLife: number;
  shape?: 'circle' | 'spark' | 'splinter';
}

export interface FloatingText {
  id: number;
  text: string;
  subText?: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  arrowsRemaining: number;
  arrowsShot: number;
  bullseyes: number;
  hits: number;
  misses: number;
  longestStreak: number;
  currentStreak: number;
  round: number;
}
