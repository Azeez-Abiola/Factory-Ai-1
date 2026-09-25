// Shared schedule maths for automated reports (console + worker).
export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export interface ScheduleTiming {
  frequency: ScheduleFrequency;
  run_hour: number;
  weekday: number; // 0 = Sunday
  month_day: number; // 1-28
  timezone: string;
}

/** Minutes the given zone is ahead of UTC at a given instant. */
const zoneOffsetMinutes = (tz: string, at: Date) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 0;
  }
};

/** Local calendar date (y, m, d, weekday) of an instant in a zone. */
const localDate = (tz: string, at: Date) => {
  const shifted = new Date(at.getTime() + zoneOffsetMinutes(tz, at) * 60000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate(), wd: shifted.getUTCDay() };
};

/** Next run strictly after `from`. */
export const computeNextRun = (t: ScheduleTiming, from: Date = new Date()): Date => {
  const start = localDate(t.timezone, from);
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(start.y, start.m, start.d + i));
    const wd = day.getUTCDay();
    const md = day.getUTCDate();
    if (t.frequency === "weekly" && wd !== t.weekday) continue;
    if (t.frequency === "monthly" && md !== t.month_day) continue;
    const naive = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), md, t.run_hour, 0, 0);
    const candidate = new Date(naive - zoneOffsetMinutes(t.timezone, new Date(naive)) * 60000);
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  return new Date(from.getTime() + 864e5);
};

/** How far back each run looks. */
export const lookbackDays = (f: ScheduleFrequency) => (f === "daily" ? 1 : f === "weekly" ? 7 : 30);

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const describeSchedule = (t: ScheduleTiming) => {
  const hh = `${String(t.run_hour).padStart(2, "0")}:00`;
  if (t.frequency === "daily") return `Every day at ${hh}`;
  if (t.frequency === "weekly") return `Every ${WEEKDAYS[t.weekday]} at ${hh}`;
  return `Monthly on day ${t.month_day} at ${hh}`;
};
