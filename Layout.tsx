import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes: number): string {
  if (!minutes || minutes < 0) return '0h 00m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function calculateWorkedMinutes(start: string, end: string, breakMins: number): number {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  let totalMins = (endH * 60 + endM) - (startH * 60 + startM);
  if (totalMins < 0) totalMins += 24 * 60; // handle overnight
  
  const worked = totalMins - (breakMins || 0);
  return Math.max(0, worked);
}
