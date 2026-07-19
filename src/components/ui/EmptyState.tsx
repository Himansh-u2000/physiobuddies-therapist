import { View, Text } from "react-native";
import { Button } from "./Button";
import { COLORS } from "@/constants/config";

type StateTone = "accent" | "info" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<StateTone, { bg: string; color: string }> = {
  accent: { bg: "bg-accent/10", color: COLORS.accent },
  info: { bg: "bg-info/10", color: COLORS.info },
  success: { bg: "bg-success/10", color: COLORS.success },
  warning: { bg: "bg-warning/10", color: COLORS.warning },
  danger: { bg: "bg-danger/10", color: COLORS.danger },
  neutral: { bg: "bg-muted/10", color: COLORS.muted },
};

interface StateAction {
  label: string;
  onPress: () => void;
}

interface EmptyStateProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tone?: StateTone;
  title: string;
  description: string;
  action?: StateAction;
  secondaryAction?: StateAction;
}

/** Matches the prototype's `.empty-card` — icon circle, heading, description, up to 2 CTAs. */
export function EmptyState({ icon: Icon, tone = "accent", title, description, action, secondaryAction }: EmptyStateProps) {
  const t = TONE[tone];
  return (
    <View className="bg-surface-strong border-[1.5px] border-border rounded-lg px-5 py-7 items-center mt-2">
      <View className={`w-16 h-16 rounded-[20px] items-center justify-center mb-3.5 ${t.bg}`}>
        <Icon size={28} color={t.color} />
      </View>
      <Text className="text-[15px] font-extrabold text-fg text-center mb-1.5">{title}</Text>
      <Text className="text-[13px] text-muted text-center leading-[19px] mb-4" style={{ maxWidth: 260 }}>
        {description}
      </Text>
      {(action || secondaryAction) && (
        <View className="flex-row flex-wrap justify-center" style={{ gap: 8 }}>
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
