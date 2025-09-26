export function parseWhen(input: string): Date {
  const s = input.toLowerCase();

  const base = new Date();
  if (/tomorrow/i.test(s)) {
    base.setDate(base.getDate() + 1);
  }

  let hour: number | null = null;
  let minute = 30;

  //match "after <num> (am| pm)""
  const match = s.match(/after\s*(\d{1,2})\s*(am|pm)?/i);

  if (match) {
    let h = parseInt(match[1], 10);
    const meridiem = (match[2] || "").toLowerCase();

    if (meridiem === "pm" && h < 12) h += 12;
    if (!meridiem && h <= 7) {
      h += 12;
    }
    hour = h;
  }

  if (hour === null) {
    const atMatch = s.match(
      /\b(?:at|around|by)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
    );

    if (atMatch) {
      let h = parseInt(atMatch[1], 10);
      const mins = atMatch[2] ? parseInt(atMatch[2], 10) : null;
      const meridiem = (atMatch[3] || "").toLowerCase();

      if (meridiem === "pm" && h < 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;
      if (!meridiem && h <= 7) {
        h += 12;
      }

      hour = h;
      minute = mins !== null && !Number.isNaN(mins) ? mins : 30;
    }
  }

  if (hour === null) {
    hour = 10;
    minute = 30;
  }

  const out = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hour,
    minute,
    0,
    0
  );

  return out;
}
