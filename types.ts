
export interface RiceCookerState {
  status: 'idle' | 'cooking' | 'warm' | 'scheduled';
  riceLevel: number; // 0-100%
  waterLevel: number; // 0-100%
  timeLeftSeconds: number;
  totalTimeSeconds: number;
  mode: 'white' | 'brown' | 'sushi' | 'quick' | 'porridge';
  error?: string;
  cookingEndTime?: number;
}

export interface CookingPreset {
  name: string;
  riceAmount: number; // cups
  waterAmount: number; // liters or ratio
  timeSeconds: number;
  mode: string;
}

export interface CookingSchedule {
  id: string;
  targetTime: string;
  riceCups: number;
  waterRatio: number;
  mode: string;
  label?: string;
}

export enum AppRoute {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  DASHBOARD = 'DASHBOARD'
}

export interface DeviceConfig {
  id: string;
  name?: string;
  addedAt: number;
}
