export declare const GameState: {
  readonly IDLE: 'idle';
  readonly AIMING: 'aiming';
  readonly FLYING: 'flying';
  readonly HIT: 'hit';
  readonly MISS: 'miss';
  readonly RESETTING: 'resetting';
};

export type GameStateType = (typeof GameState)[keyof typeof GameState];

export interface PositionCoords {
  x: number;
  y: number;
}

export interface PromptPositionObject {
  top?: string | number;
  bottom?: string | number;
  left?: string | number;
  right?: string | number;
}

export interface ArrowPuckTheme {
  primaryColor?: string;
  arrowColor?: string;
  targetRingColors?: string[];
}

export interface ArrowPuckStats {
  score: number;
  shots: number;
  hits: number;
  accuracy: number;
}

export interface ArrowPuckOptions {
  mountTarget?: HTMLElement;
  bowPosition?: 'bottom-left' | 'bottom-right' | PositionCoords;
  targetPosition?: 'top-right' | 'top-left' | PositionCoords;
  gravity?: number;
  powerMultiplier?: number;
  maxDragRadius?: number;
  airResistance?: number;
  autoOpen?: boolean;
  showPrompt?: boolean;
  promptText?: string;
  closeText?: string;
  promptPosition?: 'bottom-right' | 'bottom-left' | PromptPositionObject;
  zIndex?: number;
  theme?: ArrowPuckTheme;
  enableTrajectory?: boolean;
  enableSound?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onHit?: (score: number, totalScore: number) => void;
  onMiss?: () => void;
}

export declare class ArrowPuck {
  constructor(options?: ArrowPuckOptions);
  options: ArrowPuckOptions;
  state: GameStateType;
  totalScore: number;
  totalShots: number;
  hits: number;
  isOpen: boolean;

  open(): void;
  close(): void;
  toggle(): void;
  reset(): void;
  destroy(): void;
  getStats(): ArrowPuckStats;
}

export { ArrowPuck as ArrowShot };
export default ArrowPuck;
