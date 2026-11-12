import { memo, useId } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

import Svg, {
  Defs,
  G,
  LinearGradient,
  Mask,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useAppData, useAppTheme } from '@/state/app_data';

import { LED_PATHS, type LedFrame } from './lighting';

const CLASSIC_IMAGE = require('../../../assets/images/keycaps/classic.png');

// Tint the photographed shell without flattening its shading or covering the LEDs.
const BODY_PATH =
  'M320 103H764Q822 103 861 142L918 200Q948 230 948 290V735Q948 794 911 831Q878 872 824 872H255Q199 872 165 831Q131 796 131 738V291Q131 241 165 208L230 141Q270 103 320 103Z';
const FACE_PATH =
  'M330 115H754Q859 115 859 220V592Q859 697 754 697H330Q224 697 224 592V220Q224 115 330 115Z';
const CASE_PATH =
  'M324 17H760Q830 17 882 65L1009 195Q1050 239 1050 312V758Q1050 830 1002 880L875 1007Q831 1046 758 1046H322Q250 1046 203 1003L77 876Q31 831 31 758V315Q31 244 78 195L204 69Q251 17 324 17Z';

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
  { strokeWidth: 75 },
  { strokeWidth: 30, strokeOpacity: 0.15, stroke: '#FFFFFF' },
];

type Props = {
  frame?: LedFrame;
  playing?: boolean;
  faded?: boolean;
  pressed?: boolean;
  idleColor?: string;
  size?: 'home' | 'preview' | 'thumbnail';
  /** Theme cards can preview a palette without changing the saved appearance. */
  appearance?: ReturnType<typeof useAppTheme>;
  ledOpacity?: Animated.Value;
};

// Static artwork does not need to rebuild for each playback frame.
const KeycapShell = memo(function KeycapShell({
  appearance,
  tintId,
  pressed,
}: {
  appearance: ReturnType<typeof useAppTheme>;
  tintId: string;
  pressed: boolean;
}) {
  return (
    <>
      {/* Keep the platform and shadow in the artwork's coordinate space on every platform. */}
      <Svg
        pointerEvents="none"
        aria-hidden={true}
        focusable={false}
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 1084 1084"
      >
        <G transform="translate(0 16)">
          <Path
            d={CASE_PATH}
            fill={appearance.keycapCase}
            stroke={appearance.keycapCase}
            strokeWidth={32}
            opacity={0.12}
          />
          <Path
            d={CASE_PATH}
            fill={appearance.keycapCase}
            stroke={appearance.keycapCase}
            strokeWidth={12}
            opacity={0.18}
          />
        </G>
      </Svg>
      {/* Realistic keycap image */}
      <Image source={CLASSIC_IMAGE} resizeMode="contain" style={styles.image} />

      <Svg
        pointerEvents="none"
        aria-hidden={true}
        focusable={false}
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 1084 1084"
      >
        <Defs>
          <Mask
            id={`${tintId}-shell`}
            x="0"
            y="0"
            width="1084"
            height="1084"
            maskUnits="userSpaceOnUse"
            maskType="luminance"
          >
            <Path d={CASE_PATH} fill="#FFFFFF" />
            <Path d={BODY_PATH} fill="#000000" />
            {LED_PATHS.map((d, id) => (
              <Path
                key={id}
                d={d}
                stroke="#000000"
                strokeWidth={145}
                strokeLinecap="butt"
              />
            ))}
          </Mask>
          <LinearGradient id={tintId} x1="0" y1="0" x2="1" y2="1">
            <Stop
              offset="0"
              stopColor={appearance.keycapBody}
              stopOpacity={0.8}
            />
            <Stop
              offset="1"
              stopColor={appearance.keycapSide}
              stopOpacity={0.94}
            />
          </LinearGradient>
          <LinearGradient id={`${tintId}-face`} x1="0" y1="0" x2="0.8" y2="1">
            <Stop
              offset="0"
              stopColor={
                pressed ? appearance.keycapBody : appearance.keycapHighlight
              }
            />
            <Stop offset="1" stopColor={appearance.keycapBody} />
          </LinearGradient>
        </Defs>
        <Path
          d={CASE_PATH}
          mask={`url(#${tintId}-shell)`}
          fill={appearance.keycapCase}
          opacity={0.9}
        />
        <Path
          d={CASE_PATH}
          fill="none"
          stroke="#15151B"
          strokeWidth={10}
          strokeOpacity={0.85}
        />
        {pressed && <Path d={BODY_PATH} fill={appearance.keycapSide} />}
        {/* Depress only the cap; the LED ring and platform stay fixed. */}
        <G
          transform={
            pressed
              ? 'translate(542 470) scale(0.96) translate(-542 -430)'
              : undefined
          }
        >
          <Path d={BODY_PATH} fill={`url(#${tintId})`} />
          <Path d={FACE_PATH} fill={`url(#${tintId}-face)`} />
          <Path
            d={FACE_PATH}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={6}
            strokeOpacity={0.4}
          />
          <SvgText
            x="542"
            y="440"
            textAnchor="middle"
            fill="#000000"
            fontSize={116}
            fontWeight="800"
            fontStyle="italic"
          >
            Clickd
          </SvgText>
        </G>
        <G>
          {LED_PATHS.map((d, id) => (
            <Path
              key={id}
              d={d}
              fill="none"
              stroke={appearance.keycapCase}
              strokeWidth={75}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
    </>
  );
});

export const Keycap = memo(function Keycap({
  frame,
  playing = false,
  faded = false,
  pressed = false,
  idleColor,
  size = 'home',
  appearance: appearanceOverride,
  ledOpacity,
}: Props) {
  const selectedAppearance = useAppTheme();
  const appearance = appearanceOverride ?? selectedAppearance;
  const { preferences } = useAppData();
  const tintId = `keycap-${useId().replace(/:/g, '')}`;
  return (
    <View
      style={[
        styles.container,
        size === 'preview' && styles.preview,
        size === 'thumbnail' && styles.thumbnail,
        faded && styles.faded,
      ]}
    >
      <KeycapShell appearance={appearance} tintId={tintId} pressed={pressed} />

      {/* Dynamic LED overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: ledOpacity ?? 1 }]}
      >
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox="0 0 1084 1084"
        >
          {LED_PATHS.map((d, id) => {
            const active = !playing || (frame?.active.includes(id) ?? false);

            const color = playing
              ? (frame?.colors[id] ?? '#FFFFFF')
              : (idleColor ?? preferences.idleLedColor);

            return (
              <G key={id}>
                {(active ? ACTIVE_LAYERS : INACTIVE_LAYERS).map((layer) => (
                  <Path
                    key={layer.strokeWidth}
                    d={d}
                    fill="none"
                    stroke={
                      layer.stroke ?? (active ? color : appearance.keycapCase)
                    }
                    strokeWidth={layer.strokeWidth}
                    strokeOpacity={layer.strokeOpacity}
                    strokeLinecap="butt"
                  />
                ))}
              </G>
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '42%',
    maxWidth: 164,
    aspectRatio: 1,
    flexShrink: 0,
  },

  // Artwork must not contribute an intrinsic height inside a scrolling editor.
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },

  preview: {
    width: '100%',
    maxWidth: 240,
  },

  thumbnail: { width: 48, height: 48 },

  faded: {
    opacity: 0.82,
  },
});
