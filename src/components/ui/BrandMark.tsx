import { View } from "react-native";
import { Image } from "expo-image";

interface BrandMarkProps {
  /** Edge length of the tile, in dp. The mark is inset within it. */
  size?: number;
  /** Corner radius of the white tile. Ignored when `tile` is false. */
  radius?: number;
  /**
   * Draw the mark on a white rounded tile (the default). The artwork is navy + teal on white,
   * so on any dark surface — the splash gradient, the login header — it needs the tile to stay
   * readable. Pass `false` only when the mark already sits on a light background.
   */
  tile?: boolean;
}

const MARK = require("../../../assets/images/brand-mark.png");

/**
 * The Physiobuddies mark, as one component so the logo can't drift between screens.
 *
 * Replaces the hand-drawn stand-ins that were here before: a white tile with a bold letter "P"
 * on the login header, and the same "P" with an `Activity` icon badge on the splash. Both were
 * placeholders for artwork that didn't exist yet; this renders the real thing.
 */
export function BrandMark({ size = 56, radius, tile = true }: BrandMarkProps) {
  const r = radius ?? Math.round(size * 0.3);
  const inset = Math.round(size * (tile ? 0.16 : 0));

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: tile ? r : 0,
        backgroundColor: tile ? "#ffffff" : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={MARK}
        style={{ width: size - inset * 2, height: size - inset * 2 }}
        contentFit="contain"
        // The mark is a fixed local asset, so there is nothing to fade in from — a transition
        // here would just make the logo flicker on every mount.
        transition={0}
        accessibilityLabel="Physiobuddies"
      />
    </View>
  );
}
