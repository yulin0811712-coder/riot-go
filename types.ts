export type AppState = 'LOGIN' | 'LOBBY' | 'PLAYING' | 'GAME_OVER';

export interface ScoreEntry {
  name: string;
  score: number;
  date: string;
  aiComment?: string;
  accuracy: number;
}

export interface Target {
  id: number;
  x: number;
  y: number;
  size: number;
  createdAt: number;
}

export interface GameStats {
  score: number;
  accuracy: number;
  shotsFired: number;
  targetsHit: number;
  bullseyes: number;
}