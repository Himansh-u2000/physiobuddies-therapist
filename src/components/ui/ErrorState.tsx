import { View, Text } from "react-native";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { COLORS } from "@/constants/config";

type StateTone = "danger" | "warning";

const TONE: Record<StateTone, { bg: string; color: string; chip: "cancelled" | "pending" }> = {
  danger: { bg: "bg-danger/10", color: COLORS.danger, chip: "cancelled" },
  warning: { bg: "bg-warning/10", color: COLORS.warning, chip: "pending" },
};

interface StateAction {
  label: string;
  onPress: () => void;
}

interface ErrorStateProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tone?: StateTone;
  title: string;
  badge: string;
  description: string;
  action?: StateAction;
  secondaryAction?: StateAction;
}

/** Matches the prototype's `.status-card` — icon, heading + status chip, description, actions. Used for server errors, offline, and permission-denied states. */
export function ErrorState({ icon: Icon, tone = "danger", title, badge, description, action, secondaryAction }: ErrorStateProps) {
  const t = TONE[tone];
  return (
    <View className="bg-surface-strong border-[1.5px] border-border rounded-lg p-4 mt-2">
      <View className="flex-row items-center mb-2.5" style={{ gap: 12 }}>
        <View className={`w-11 h-11 rounded-[14px] items-center justify-center ${t.bg}`}>
          <Icon size={20} color={t.color} />
        </View>
        <Text className="flex-1 text-[14px] font-extrabold text-fg">{title}</Text>
        <Chip variant={t.chip}>{badge}</Chip>
      </View>
      <Text className="text-[13px] text-muted leading-[19px] mb-3">{description}</Text>
      {(action || secondaryAction) && (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {action && (
            <Button fullWidth={false} onPress={action.onPress}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" fullWidth={false} onPress={secondaryAction.onPress}>
              {secondaryAction.label}
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
