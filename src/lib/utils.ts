import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CENTRAL_TIMEZONE = 'America/Chicago';

export function formatCentralDeadline(
  value: string | Date,
  options?: Intl.DateTimeFormatOptions
) {
  const date = value instanceof Date ? value : new Date(value);
  const centralMinute = new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIMEZONE,
    minute: '2-digit',
  }).formatToParts(date).find((part) => part.type === 'minute')?.value;
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: CENTRAL_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  };

  if (Number(centralMinute) === 0) {
    delete formatOptions.minute;
  }

  return `${date.toLocaleString('en-US', formatOptions)} (CT)`;
}
