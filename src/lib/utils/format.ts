export function formatCurrency(amount: number): string {
  return `Rs ${amount.toLocaleString("en-IN")}`;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getSessionTypeLabel(type: string): string {
  switch (type) {
    case "home":
      return "Home visit";
    case "clinic":
      return "Clinic visit";
    case "online":
      return "Online session";
    default:
      return type;
  }
}

export function getSessionTypeIcon(type: string): string {
  switch (type) {
    case "home":
      return "🏠";
    case "clinic":
      return "🏥";
    case "online":
      return "💻";
    default:
      return "📅";
  }
}

/**
 * Per-visit-type accent so cards read as distinct at a glance instead of a wall of navy.
 * Stays inside the brand palette (navy accent / teal info / green success) — a warmer,
 * more colourful use of the same primaries, not new colours.
 * `grad` pairs are hand-picked lighter→darker stops of each hue for card headers.
 */
export function getSessionTypeTheme(type: string): {
  solid: string;
  soft: string;
  grad: [string, string];
} {
  switch (type) {
    case "home":
      return { solid: "#0086a8", soft: "rgba(0,134,168,0.10)", grad: ["#008fb3", "#00637d"] };
    case "clinic":
      return { solid: "#004060", soft: "rgba(0,64,96,0.10)", grad: ["#00557e", "#003d5e"] };
    case "online":
      return { solid: "#239149", soft: "rgba(35,145,73,0.10)", grad: ["#2ca659", "#138840"] };
    default:
      return { solid: "#004060", soft: "rgba(0,64,96,0.10)", grad: ["#00557e", "#003d5e"] };
  }
}

/** Local calendar date -> 'YYYY-MM-DD'. Deliberately not `toISOString()`, which converts
 *  to UTC first and can shift the date by a day depending on timezone/time-of-day. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' -> "24 Jul 2026". Parsed with an explicit local-midnight time (not passed
 *  bare to `new Date()`, which treats a date-only string as UTC and can display a day early). */
export function formatDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * 'YYYY-MM-DD' -> "Today" / "Yesterday" / "4 days ago" / "3 weeks ago" / "24 Jul 2026".
 *
 * Same local-midnight parse as `formatDateLabel` for the same reason. Days are compared on
 * calendar boundaries, not elapsed milliseconds: a visit at 21:00 yesterday is "Yesterday" at
 * 08:00 today, which is how a person reads it, whereas an hours/24 division calls it "Today".
 */
export function formatRelativeDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 0) return formatDateLabel(iso);
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  return formatDateLabel(iso);
}

/**
 * A full ISO timestamp -> "Just now" / "12m ago" / "5h ago" / "3d ago" / "24 Jul 2026".
 *
 * For things posted at a time of day, where `formatRelativeDay`'s calendar-day granularity is
 * too coarse — a comment written ten minutes ago reading "Today" is less useful than "10m ago".
 */
export function relativeCommentTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return formatDateLabel(toIsoDate(new Date(then)));
}

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}
