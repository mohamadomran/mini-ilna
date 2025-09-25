export type QuietHoursConfig = {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
};

function parseHHMM(input: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!match) return { hours: 0, minutes: 0 };

  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minutes = Math.min(59, Math.max(0, parseInt(match[2], 10)));

  return { hours, minutes };
}

export function loadQuietHoursFromEnv(): QuietHoursConfig {
  return {
    enabled: String(process.env.QUIET_HOURS_ENABLED).toLowerCase() === "true",
    start: process.env.QUIET_HOURS_START || "20:00",
    end: process.env.QUIET_HOURS_END || "08:00",
    timezone: process.env.QUIET_HOURS_TZ || "Asia/Dubai",
  };
}

export function isWithinQuietHours(
  now: Date,
  config: QuietHoursConfig
): boolean {
  if (!config.enabled) return false;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value])
  );

  const currentMinutes =
    parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);

  const { hours: startH, minutes: startM } = parseHHMM(config.start);
  const { hours: endH, minutes: endM } = parseHHMM(config.end);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes === endMinutes) return false; //werid/bad case

  if (startMinutes < endMinutes) {
    // same day window
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // overnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export function buildQuietHoursMessage(config: QuietHoursConfig): string {
  return `We're currently observing quiet hours (${config.start}-${config.end} ${config.timezone}). Please check in later.`;
}
