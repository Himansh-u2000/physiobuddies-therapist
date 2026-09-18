import { View, Text } from "react-native";
import { Image } from "expo-image";
import { COLORS } from "@/constants/config";
import { getInitials } from "@/lib/utils/format";

interface AvatarProps {
  name?: string;
  url?: string;
  size?: number;
  radius?: number;
}

/**
 * A circular (or rounded) photo, falling back to initials.
 *
 * ## Why `expo-image` and not React Native's `Image`
 *
 * This was the largest single RAM cost in the app. React Native's `Image` on Android decodes the
 * source at its FULL pixel size, whatever size it is drawn at. Avatars arrive from uploads, and a
 * gallery photo is typically 4000×3000 — a ~48 MB ARGB bitmap to paint a 36px circle. The avatar
 * sits in the header on nearly every screen and repeats down the patient and appointment lists,
 * so on a 3–4 GB phone this alone was enough to get the app killed in the background.
 *
 * `expo-image` (Glide on Android) downsamples to the laid-out size before decoding, so the same
 * photo costs a few hundred KB at avatar size. `memory-disk` caching means the header's copy is
 * decoded once and reused as screens change, instead of re-fetched per mount.
 *
 * Every other image in the app already used `expo-image`; this was the one holdout.
 *
 * NativeWind is not wired to `expo-image` (see `lib/nativewind-interop.ts`), so the border lives
 * in `style` — a `className` here would be dropped without any warning.
 */
export function Avatar({ name, url, size = 36, radius = 18 }: AvatarProps) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: 2,
          borderColor: "#fff",
          backgroundColor: COLORS.primarySoft,
        }}
        contentFit="cover"
        cachePolicy="memory-disk"
        // Lets a recycled list cell drop the previous row's bitmap immediately rather than briefly
        // showing the wrong person's face while the new one loads.
        recyclingKey={url}
        transition={120}
        accessibilityLabel={name ? `${name}'s photo` : "Profile photo"}
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
