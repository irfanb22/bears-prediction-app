export const CAMPAIGN_TIME_ZONE = 'America/Chicago';
export const CAMPAIGN_TIME_ZONE_LABEL = 'Central Time (Chicago)';

function partsInCentral(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPAIGN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function toCentralDateTimeInput(date: Date) {
  const parts = partsInCentral(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function defaultScheduledDateTime() {
  const nextHalfHour = new Date(Date.now() + 30 * 60_000);
  nextHalfHour.setMinutes(nextHalfHour.getMinutes() < 30 ? 30 : 60, 0, 0);
  return toCentralDateTimeInput(nextHalfHour);
}

function centralOffsetMinutes(date: Date) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPAIGN_TIME_ZONE,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  if (!name || name === 'GMT') return 0;
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(name);
  if (!match) throw new Error('Could not determine the Central Time offset.');
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '+' ? minutes : -minutes;
}

/** Converts a wall-clock value entered for Chicago into an unambiguous instant. */
export function centralDateTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Choose a valid delivery date and time.');

  const wallClockUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let instant = wallClockUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    instant = wallClockUtc - centralOffsetMinutes(new Date(instant)) * 60_000;
  }

  const iso = new Date(instant).toISOString();
  if (toCentralDateTimeInput(new Date(iso)) !== value) {
    throw new Error('That time does not exist in Central Time because of daylight saving time.');
  }
  return iso;
}

export function formatCentralDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPAIGN_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}
