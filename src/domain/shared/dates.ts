/**
 * Deadline maths in Pakistan's timezone.
 *
 * A scholarship deadline is a wall-clock moment in the awarding body's own
 * country — HEC closes at 16:00 PKT, which is 11:00 UTC. Storing it as a UTC
 * date and rendering it in UTC produces the wrong day for any student outside
 * UTC, and quietly adds eight hours to the final afternoon. Since the whole
 * product claims not to invent dates, that failure mode is unacceptable, so
 * every deadline is resolved into Asia/Karachi before it is compared or shown.
 *
 * Pure: no I/O, no framework imports. See docs/PLAN.md §3.1.
 */

import { PK } from "@/config/pakistan";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MS_PER_DAY = 86_400_000;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Calendar parts for an instant, as seen in `timeZone`.
 *
 * Uses `Intl.DateTimeFormat.formatToParts` rather than a hard-coded UTC+5 so
 * this stays correct across Pakistan's daylight-saving transitions.
 */
function parts(instant: Date, timeZone: string): ZonedParts {
  const found = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(found.find((part) => part.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // `hour12: false` renders midnight as 24 in some ICU versions.
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

const pad = (value: number): string => String(value).padStart(2, "0");

/** `YYYY-MM-DD` for the instant as seen in `timeZone`. */
export function localDate(instant: Date, timeZone: string = PK.timeZone): string {
  const { year, month, day } = parts(instant, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Today in Pakistan as `YYYY-MM-DD`. */
export function todayPK(now: Date = new Date()): string {
  return localDate(now, PK.timeZone);
}

/**
 * Ordinal day number for a plain `YYYY-MM-DD` string.
 *
 * Day arithmetic is done on these ordinals rather than on instants, so no
 * offset or daylight-saving term ever enters the subtraction. A deadline that
 * closes at 16:00 is "0 days left" on its closing day, not "part of a day".
 */
function ordinal(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const millis = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(millis) ? null : Math.round(millis / MS_PER_DAY);
}

/**
 * The single place a stored deadline becomes an instant.
 *
 * Two shapes reach us, and they must not be conflated:
 *
 *  · `2026-10-20T16:00:00+05:00` — an instant with an offset. The offset records
 *    whose wall clock the deadline is on. Used for every HEC programme, because
 *    HEC publishes a closing *time*.
 *  · `2026-10-20` — a bare date, meaning "we saw a date but no time". It is
 *    resolved to the end of that local day (23:59 PKT), never to midnight.
 *
 * `new Date("2026-10-20")` silently means 00:00 **UTC**, which is 05:00 in
 * Karachi. Using it directly closes a date-only deadline five hours early and
 * then reports it closed all evening — so it is never used for bare dates.
 */
export function deadlineInstant(deadline: string | Date | null): Date | null {
  if (deadline === null) return null;
  if (deadline instanceof Date) {
    return Number.isNaN(deadline.getTime()) ? null : deadline;
  }
  const trimmed = deadline.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return pkrInstant(trimmed, 23, 59);
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The Pakistan calendar day a deadline falls on, or null if unparseable. */
function deadlineDay(deadline: string | Date): string | null {
  if (deadline instanceof Date) {
    return Number.isNaN(deadline.getTime()) ? null : localDate(deadline, PK.timeZone);
  }
  // A bare `YYYY-MM-DD` is already a local day; an ISO instant is converted.
  const trimmed = deadline.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const instant = new Date(trimmed);
  return Number.isNaN(instant.getTime()) ? null : localDate(instant, PK.timeZone);
}

/**
 * Whole calendar days from the Pakistan day `today` to the Pakistan day
 * containing `deadline`. Negative means already closed, 0 means it closes
 * today.
 */
export function daysUntil(deadline: string | Date | null, today: string): number | null {
  if (deadline === null) return null;
  const target = deadlineDay(deadline);
  const from = ordinal(today);
  if (target === null || from === null) return null;
  const to = ordinal(target);
  return to === null ? null : to - from;
}

/**
 * The honest state of a deadline relative to a real instant.
 *
 * `daysUntil` alone is not enough for display: a deadline closing at 16:00 today
 * has 0 whole days left at 17:00, which a naive UI renders as "0 days left" and
 * a student reasonably reads as "I still have time". That is the failure this
 * exists to prevent, so closed-ness is decided against the actual instant.
 */
export type DeadlineState =
  | { status: "UNKNOWN" }
  | { status: "CLOSED"; days: number }
  | { status: "CLOSING_TODAY"; minutesLeft: number }
  | { status: "OPEN"; days: number };

export function deadlineState(
  deadline: string | Date | null,
  now: Date = new Date(),
): DeadlineState {
  const instant = deadlineInstant(deadline);
  if (instant === null) return { status: "UNKNOWN" };

  const target = instant.getTime();
  const current = now.getTime();
  const days = daysUntil(instant, localDate(now, PK.timeZone));
  if (days === null) return { status: "UNKNOWN" };

  if (target <= current) return { status: "CLOSED", days };
  if (days === 0) {
    return { status: "CLOSING_TODAY", minutesLeft: Math.round((target - current) / 60_000) };
  }
  return { status: "OPEN", days };
}

/** True when no closing time was published, only a calendar date. */
function isDateOnly(deadline: string | Date): boolean {
  return typeof deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(deadline.trim());
}

/** `20 Oct 2026` in Pakistan. Empty string when there is no usable deadline. */
export function formatDeadlineDay(deadline: string | Date | null): string {
  const instant = deadlineInstant(deadline);
  if (instant === null) return "";
  const { year, month, day } = parts(instant, PK.timeZone);
  return `${day} ${MONTHS[month - 1] ?? ""} ${year}`;
}

/**
 * `20 Oct 2026, 16:00 PKT` — the full closing moment, never just the day.
 *
 * Showing only the date hides the fact that HEC's portal shuts at 16:00, which
 * is the single most common way a student misses an HEC deadline.
 *
 * When the awarding body published a date but no time, the time is *not*
 * invented: the output says so, so `23:59` never reaches a student as though
 * somebody had confirmed it.
 */
export function formatDeadline(deadline: string | Date | null): string {
  const day = formatDeadlineDay(deadline);
  if (!day) return "";
  if (isDateOnly(deadline!)) return `${day} (no closing time published)`;

  const instant = deadlineInstant(deadline)!;
  const { hour, minute } = parts(instant, PK.timeZone);
  return `${day}, ${pad(hour)}:${pad(minute)} ${PK.timeZoneLabel}`;
}

/**
 * Just the closing time, or null when none was published.
 *
 * Lets a compact badge say `4 hours left · 16:00 PKT` without repeating the
 * date it is already rendered next to.
 */
export function formatDeadlineTime(deadline: string | Date | null): string | null {
  if (!deadline || isDateOnly(deadline)) return null;
  const instant = deadlineInstant(deadline);
  if (instant === null) return null;
  const { hour, minute } = parts(instant, PK.timeZone);
  return `${pad(hour)}:${pad(minute)} ${PK.timeZoneLabel}`;
}

/**
 * A coarse, honest countdown: `4 hours`, `3 days`, `closed 2 days ago`.
 *
 * Deliberately not "3 days, 4 hours" — false precision on a countdown implies
 * a refresh rate and an accuracy the underlying data does not have.
 */
export function describeCountdown(state: DeadlineState): string {
  switch (state.status) {
    case "UNKNOWN":
      return "no confirmed date";
    case "CLOSED":
      if (state.days === 0) return "closed today";
      if (state.days === -1) return "closed yesterday";
      return `closed ${Math.abs(state.days)} days ago`;
    case "CLOSING_TODAY": {
      const hours = Math.floor(state.minutesLeft / 60);
      if (hours >= 1) return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
      return `${state.minutesLeft} min left`;
    }
    case "OPEN":
      if (state.days === 1) return "1 day left";
      return `${state.days} days left`;
  }
}

/**
 * The UTC instant of a Pakistan wall-clock moment.
 *
 * One probe is enough: read the zone's offset back at the naive instant, then
 * shift by it. Used when seeding a deadline the awarding body publishes in its
 * own local time ("closes 20 Oct 2026, 4:00 PM"). Getting this wrong is
 * exactly the bug this module exists to prevent.
 */
export function pkrInstant(
  date: string,
  hour = 23,
  minute = 59,
  timeZone: string = PK.timeZone,
): Date | null {
  if (ordinal(date) === null) return null;

  // The desired wall clock, read as though it were UTC.
  const wallClock = Date.parse(`${date}T${pad(hour)}:${pad(minute)}:00Z`);
  const probe = parts(new Date(wallClock), timeZone);
  // The wall clock this instant actually shows in `timeZone`.
  const shown = Date.UTC(probe.year, probe.month - 1, probe.day, probe.hour, probe.minute);
  return new Date(wallClock + (wallClock - shown));
}