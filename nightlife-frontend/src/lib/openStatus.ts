// src/lib/openStatus.ts
/** openHours: [{ day: "Friday", open: "20:00", close: "04:00" }] */
export function isOpenNow(
  openHours: Array<{ day: string; open: string; close: string }>
) {
  if (!openHours || openHours.length === 0) return false;
  const now = new Date();
  const dayIdx = now.getDay(); // 0..6 Sun..Sat
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const todayName = days[dayIdx];
  const ydayName = days[(dayIdx + 6) % 7];

  const spans = (d: string) => openHours.filter((x) => x.day === d);
  const inRange = (o: string, c: string, ref: Date) => {
    const [oh, om] = o.split(":").map(Number);
    const [ch, cm] = c.split(":").map(Number);
    const start = new Date(ref);
    start.setHours(oh, om, 0, 0);
    const end = new Date(ref);
    end.setHours(ch, cm, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1); // overnight
    return ref >= start && ref <= end;
  };

  if (spans(todayName).some(({ open, close }) => inRange(open, close, now)))
    return true;

  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (spans(ydayName).some(({ open, close }) => inRange(open, close, y)))
    return true;

  return false;
}
