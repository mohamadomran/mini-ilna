export function parseWhen(input: string): Date {
  const s = input.toLowerCase();

  const base = new Date();
  if (/tomorrow/i.test(s)) {
    base.setDate(base.getDate() + 1);
  }

  let hour = 10;

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

  const out = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hour,
    30,
    0,
    0
  );

  return out;
}
