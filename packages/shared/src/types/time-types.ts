/**
 * Time system types
 * 
 * These types are used by the Time system and potentially other systems
 * that need to interact with game time functionality.
 */

export enum TimeOfDay {
  DAWN = 'dawn',
  MORNING = 'morning',
  NOON = 'noon',
  AFTERNOON = 'afternoon',
  DUSK = 'dusk',
  NIGHT = 'night',
  MIDNIGHT = 'midnight'
}

export interface TimeEvent {
  id: string;
  hour: number;
  minute: number;
  callback: (time: GameTime) => void;
  repeat: boolean;
  lastTriggered?: number;
}

export interface GameTime {
  hour: number;
  minute: number;
  second: number;
  day: number;
  timeOfDay: TimeOfDay;
  isDaytime: boolean;
  sunAngle: number;
  moonPhase: number;
}

export interface TimeConfig {
  startHour?: number;
  startMinute?: number;
  startDay?: number;
  timeScale?: number; // How fast time passes (1 = real time, 60 = 1 minute per second)
  pauseTime?: boolean;
}