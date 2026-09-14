import { Minus, TrendingDown, TrendingUp } from "lucide-react-native";
import { Badge } from "@/components/ui";

/**
 * Week-over-week change, with a direction that matches the sign.
 *
 * Both earnings screens used to hardcode the direction: the dashboard printed `+{n}%` and the
 * Earnings screen `↑ {n}%`, each on a green "success" badge — so a losing week read "↑ -12% vs last
 * week", in green. And because the mapper returned `0` when there was nothing to compare against, a
 * therapist's first earning week read as flat.
 *
 * Status colour is legitimate here — up genuinely is good news — so it follows the dataviz rule for
 * status: it always ships with an icon AND words, never colour alone. A dip is `warning`, not
 * `danger`; one slow week is not an alarm.
 */
export function ChangeBadge({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  if (percent === 0) {
    return (
      <Badge variant="neutral" size="sm" dot={false} icon={Minus}>
        Same as last week
      </Badge>
    );
  }
  const up = percent > 0;
  return (
    <Badge variant={up ? "success" : "warning"} size="sm" dot={false} icon={up ? TrendingUp : TrendingDown}>
      {/* A real minus sign, and an explicit plus: the sign is the information. */}
      {`${up ? "+" : "−"}${Math.abs(percent)}% vs last week`}
    </Badge>
  );
}
