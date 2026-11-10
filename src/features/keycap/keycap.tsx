import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import Svg, { G, Path } from 'react-native-svg';

import { LED_PATHS, type LedFrame } from './lighting';

const CLASSIC_IMAGE = require(
  '../../../assets/images/keycaps/classic.png'
);

type LedLayer = Readonly<{
  strokeWidth: number;
  strokeOpacity?: number;
  stroke?: string;
}>;

// Draw from the outer glow toward the bright center of each LED.
const ACTIVE_LAYERS: readonly LedLayer[] = [
  { strokeWidth: 145, strokeOpacity: 0.2 },
  { strokeWidth: 96, strokeOpacity: 0.5 },
  { strokeWidth: 57 },
  { strokeWidth: 13, strokeOpacity: 0.55, stroke: '#FFFFFF' },
];
const INACTIVE_LAYERS: readonly LedLayer[] = [
  { strokeWidth: 75, strokeOpacity: 0.94, stroke: '#39465A' },
  { strokeWidth: 30, strokeOpacity: 0.3, stroke: '#66778E' },
];

type Props = {
  frame?: LedFrame;
  playing?: boolean;
  faded?: boolean;
};

export const Keycap = memo(function Keycap({
  frame,
  playing = false,
  faded = false,
}: Props) {
  return (
    <View
      style={[styles.container, faded && styles.faded]}
    >
      {/* Realistic keycap image */}
      <Image
        source={CLASSIC_IMAGE}
        resizeMode="contain"
        style={styles.image}
      />

      {/* Dynamic LED overlay */}
      {playing && (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox="0 0 1084 1084"
        >
          {LED_PATHS.map((d, id) => {
            const active = frame?.active.includes(id) ?? false;

            const color = frame?.colors[id] ?? '#FFFFFF';

            return (
              <G key={id}>
                {(active ? ACTIVE_LAYERS : INACTIVE_LAYERS).map((layer) => (
                  <Path
                    key={layer.strokeWidth}
                    d={d}
                    fill="none"
                    stroke={layer.stroke ?? color}
                    strokeWidth={layer.strokeWidth}
                    strokeOpacity={layer.strokeOpacity}
                    strokeLinecap="round"
                  />
                ))}
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '42%',
    maxWidth: 164,
    aspectRatio: 1,
  },

  image: {
    width: '100%',
    height: '100%',
  },

  faded: {
    opacity: 0.82,
  },
});
