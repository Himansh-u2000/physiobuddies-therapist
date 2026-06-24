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
