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
