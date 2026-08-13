import { useState } from "react";
import { View, Text } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { CalendarCheck } from "lucide-react-native";
import { BottomSheet, Button, Chip } from "@/components/ui";
import { toIsoDate } from "@/lib/utils/format";

/**
 * Native calendar date picker (via `@expo/ui` — already a linked dependency, so this adds
 * no new native module) plus quick-pick shortcuts for the common cases, so picking "next
 * Tuesday" doesn't require scrolling a wheel for the 95% case.
 */

interface DatePickerSheetProps {
  visible: boolean;
  /** Pre-selected date for the embedded calendar, ISO 'YYYY-MM-DD'. */
  initialDate?: string;
  onClose: () => void;
  onSelect: (iso: string) => void;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

const QUICK_PICKS = [
  { label: "In 3 days", days: 3 },
  { label: "In 1 week", days: 7 },
  { label: "In 2 weeks", days: 14 },
];

export function DatePickerSheet({ visible, initialDate, onClose, onSelect }: DatePickerSheetProps) {
  const today = new Date();
  const [customDate, setCustomDate] = useState<Date>(() =>
    initialDate ? new Date(`${initialDate}T00:00:00`) : addDays(today, 3),
  );

  const choose = (date: Date) => {
    onSelect(toIsoDate(date));
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="text-[16px] font-bold text-fg">Recommended follow-up</Text>
      <Text className="text-muted text-[12px]">Pick a quick option, or choose a custom date below</Text>

      <View className="flex-row flex-wrap mt-1" style={{ gap: 8 }}>
        {QUICK_PICKS.map((q) => (
          <Chip key={q.label} variant="info" onPress={() => choose(addDays(today, q.days))}>
            {q.label}
          </Chip>
        ))}
      </View>

      <View className="h-px bg-border my-2" />
      <Text className="text-[12px] font-bold text-fg mb-1">Custom date</Text>

      <DateTimePicker
        value={customDate}
        mode="date"
        minimumDate={today}
        presentation="inline"
        onValueChange={(_, date) => setCustomDate(date)}
      />

      <Button onPress={() => choose(customDate)}>
        <CalendarCheck size={16} color="#fff" />
        <Text className="text-white font-bold text-[14px]">Use this date</Text>
      </Button>
      <Button variant="secondary" onPress={onClose}>
        Cancel
      </Button>
    </BottomSheet>
  );
}
