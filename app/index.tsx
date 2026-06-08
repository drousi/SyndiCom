import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { Colors, FontWeight } from '../src/constants/theme';

export default function Index() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const dotAnim1 = useRef(new Animated.Value(0.3)).current;
  const dotAnim2 = useRef(new Animated.Value(0.3)).current;
  const dotAnim3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Fade + scale in the logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing dots loader
    const animateDots = () => {
      const pulse = (anim: Animated.Value, delay: number) =>
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ]);

      Animated.loop(
        Animated.parallel([
          pulse(dotAnim1, 0),
          pulse(dotAnim2, 200),
          pulse(dotAnim3, 400),
        ])
      ).start();
    };
    animateDots();
  }, []);

  return (
    <View style={{
      flex: 1,
      backgroundColor: Colors.navy,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 20,
    }}>
      {/* Logo icon + name */}
      <Animated.View style={{
        alignItems: 'center',
        gap: 20,
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}>
        {/* SVG Icon — large centered */}
        <Svg width={96} height={96} viewBox="0 0 10.6 10.86">
          <Path fill="#81ae45" d="M6.73.48l.48.38.6.49s.02.02.02.04v2s0,0-.01,0h0l-.77-.38h-.01v2.86s0,.03-.02.04l-.07.06-.79.7h-.02S6.14,0,6.14,0C6.14,0,6.73.48,6.73.48Z"/>
          <Path fill="#2c578b" d="M3.41,2.86v4.88h0v-.09s0-.01,0-.01h0s.06,0,.08.02l-.09.09s0,.03,0,.04l.14.16.32.32.61.62v.02h0c-.43.15-.87.19-1.33.17-.26-.01-.48-.04-.64-.09-.12-.03-.28-.07-.41-.12-.2-.07-.4-.16-.6-.28-.03-.02-.05-.05-.05-.09v-4.38s0-.03.02-.03l1.92-1.2.02-.03ZM2.78,4.12l-.51.3s-.03.03-.03.04v.71s0,.02.02.02h0l.5-.3s.02-.02.02-.04v-.73h0ZM2.25,6.53h0l.53-.29h0v-.76h0l-.53.32h0v.74h0ZM2.79,6.88s0-.01,0-.01h0l-.52.27h0v.78s0,.01,0,.01h0l.52-.3h0v-.75Z"/>
          <Path fill="#81ae45" d="M3.83,3.35c.05.06.11.12.16.17.02.02.03.05.03.08v3.52s0,.03-.02.04c-.16.16-.32.32-.49.48-.03-.01-.05-.02-.08-.02,0,0,0,0,0,.01h0v.09h0V2.84l.42.48v.03Z"/>
          <Path fill="#2c578b" d="M7.47,5.52v-1.92s0-.02.02-.02h0l1.45.57s.01.01,0,.02h0l-1.45,1.35h-.02s0,0,0,0Z"/>
          <Path fill="#81ae45" d="M6.74,8.72c-.37.34-.69.62-.96.86-.02.02-.05.03-.08.04-.05.01-.1.03-.15.04l-1.87-1.89v-.04h0c.32-.31.63-.6.91-.88.08-.08.17-.19.29-.21.14-.03.24.04.35.14.07.07.16.15.27.23.25.2.47.39.68.56h.03c.39-.36.97-.84,1.19-1.03.11-.09.37-.32.8-.68.7-.59,1.33-1.11,1.9-1.59.06-.05.12-.1.19-.16.06-.04.11-.07.16-.06.09,0,.16.07.15.17,0,.06-.02.11-.06.15-.41.58-.69.98-.85,1.18-.04.05-.15.19-.34.42-.04.05-.08.09-.12.13-.25.3-.43.51-.52.61-.3.33-.59.63-.88.92-.28.27-.47.46-.58.56s-.29.27-.54.5l.03.03Z"/>
          <Path fill="#2c578b" d="M1.14,8.85c.16.16.32.28.46.38.47.3.98.48,1.52.61.44.1.89.14,1.34.14.16,0,.33-.01.48-.03.6-.05,1.21-.24,1.75-.49.01,0,.07-.03.17-.08.05-.02.11-.05.17-.09.39-.22.77-.49,1.14-.82.11-.09.18-.16.2-.19h0s.06-.05.08-.08h0c.18-.18.36-.37.52-.57.31-.38.59-.8.84-1.25,0,0,.01-.02.02-.02h.02v.32c-.05.56-.22,1.09-.52,1.59-.11.18-.22.34-.34.5-.05.06-.13.16-.24.28-.09.11-.18.19-.26.26-.3.27-.58.49-.86.66-.82.49-1.78.8-2.74.87-1.21.09-2.47-.1-3.51-.76-.42-.27-.8-.64-1.04-1.07-.16-.28-.26-.58-.31-.9-.1-.63.06-1.33.36-1.9.12-.22.26-.44.44-.65.07-.09.14-.15.24-.25,0,0,0-.01.02-.01h0c-.08.14-.15.27-.21.38-.08.13-.13.26-.17.38-.06.19-.15.46-.19.69-.04.3-.05.57-.02.83.03.27.13.54.26.78.1.18.22.35.37.5h0Z"/>
          <Path fill="#81ae45" d="M5.32,9.69c-.64.1-1.28.1-1.91,0-.12-.02-.24-.04-.35-.07-.48-.1-.93-.29-1.36-.57-.08-.05-.16-.11-.24-.18h0c.86.4,1.86.5,2.78.3.14-.03.27-.07.4-.12.02,0,.04,0,.05.01l.64.64h-.01Z"/>
          <Path fill="#1e3562" d="M6.14,0v6.7h-.02v.02s0,.02-.01.03c-.04.03-.13.11-.27.24-.01.01-.03.01-.04,0-.12-.11-.26-.23-.41-.34-.03-.02-.06-.05-.09-.07-.11-.11-.2-.16-.37-.15-.1,0-.19.05-.27.12-.1.09-.19.18-.29.26l-.33.31v-3.52s0-.06-.03-.08c-.05-.06-.1-.12-.16-.17h0s-.03-.08-.03-.12v-1.74s0-.05.04-.07c.18-.11.44-.27.77-.49,0,0,.05-.03.12-.08.17-.11.28-.17.33-.2.12-.07.28-.17.47-.31.21-.14.41-.26.57-.34h.01ZM5.27,2.31v-.77s0-.02-.02-.02h0l-.53.32s-.02.02-.02.04v.77s0,0,.01,0h0c.1-.07.22-.13.35-.21.05-.03.11-.06.18-.09.02,0,.03-.03.03-.05ZM5.27,3h-.01c-.26.14-.39.21-.53.3-.02,0-.03.03-.03.06v.73s0,.02.02.02h0l.55-.31s.02-.02.02-.03v-.75h-.01v-.02ZM4.72,5.54l.52-.31s.03-.03.03-.06v-.74s0-.02-.02-.02h-.01l-.52.31s-.03.03-.03.05c0,.18,0,.37-.01.57h0v.18s.02.01.03.01h.01Z"/>
          <G>
            <Path fill="#10182b" d="M5.27,2.31s-.01.04-.03.05c-.07.03-.13.06-.18.09-.13.08-.25.14-.35.21h-.02v-.77s0-.03.02-.04l.53-.32h.02v.77h0Z"/>
            <Path fill="#10182b" d="M5.27,3h0v.78l-.55.31h-.02v-.73s.01-.04.03-.06c.14-.1.28-.16.53-.3h.01Z"/>
            <Path fill="#10182b" d="M2.78,4.12h0v.73s0,.03-.02.04l-.5.3h-.03v-.72s0-.04.03-.04l.51-.3h0Z"/>
            <Path fill="#10182b" d="M4.72,5.54h-.02v-.18h-.01c.02-.2.02-.39.01-.57,0-.02,0-.04.03-.05l.52-.31h.03v.75s0,.04-.03.06l-.52.31h-.01Z"/>
            <Path fill="#10182b" d="M2.25,6.53v-.74h0l.53-.32h0v.76h0l-.53.29h0Z"/>
            <Path fill="#10182b" d="M2.79,6.88v.75h0l-.52.3h0v-.78h0l.52-.27h0Z"/>
          </G>
        </Svg>

        {/* App name — same two-tone style as ScreenHeader */}
        <Text style={{ fontSize: 36, fontWeight: FontWeight.bold, letterSpacing: -1 }}>
          <Text style={{ color: '#FFFFFF' }}>Syndi</Text>
          <Text style={{ color: '#81ae45' }}>Com</Text>
        </Text>

        {/* Subtle tagline */}
        <Text style={{
          color: '#64748B',
          fontSize: 13,
          fontWeight: FontWeight.medium,
          letterSpacing: 0.5,
          marginTop: -8,
        }}>
          Gestion de syndic simplifiée
        </Text>
      </Animated.View>

      {/* Pulsing dots at bottom */}
      <View style={{
        position: 'absolute',
        bottom: 64,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
      }}>
        {[dotAnim1, dotAnim2, dotAnim3].map((anim, i) => (
          <Animated.View
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: '#4CAF50',
              opacity: anim,
            }}
          />
        ))}
      </View>
    </View>
  );
}

