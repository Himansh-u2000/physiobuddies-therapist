import { Image, View, Text } from "react-native";
import { COLORS } from "@/constants/config";
import { getInitials } from "@/lib/utils/format";

interface AvatarProps {
  name?: string;
  url?: string;
  size?: number;
  radius?: number;
}

export function Avatar({ name, url, size = 36, radius = 18 }: AvatarProps) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius }}
        className="border-2 border-white"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: COLORS.primarySoft,
      }}
      className="items-center justify-center border-2 border-white"
    >
      <Text
        className="font-extrabold text-accent"
        style={{ fontSize: size * 0.36 }}
      >
        {getInitials(name ?? "?")}
      </Text>
    </View>
  );
}

interface PortraitProps {
  name?: string;
  url?: string;
  size?: "default" | "lg";
}

export function Portrait({ name, url, size = "default" }: PortraitProps = {}) {
  const dim = size === "lg" ? 96 : 80;
  const radius = size === "lg" ? 22 : 18;
  return <Avatar name={name} url={url} size={dim} radius={radius} />;
}
