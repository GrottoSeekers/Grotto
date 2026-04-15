import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GrottoTokens, FontFamily } from '@/constants/theme';
import { Layout } from '@/constants/layout';
import { useSessionStore } from '@/store/session-store';

export default function TabLayout() {
  const { currentUser } = useSessionStore();
  const isOwner = currentUser?.role === 'owner';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: GrottoTokens.gold,
        tabBarInactiveTintColor: GrottoTokens.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: GrottoTokens.white,
          borderTopColor: GrottoTokens.borderSubtle,
          borderTopWidth: 1,
          height: Layout.tabBarHeight,
          paddingBottom: 20,
        },
        tabBarLabelStyle: {
          fontFamily: FontFamily.sansMedium,
          fontSize: 10,
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="map.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: isOwner ? 'My Listings' : 'My Sits',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="calendar.badge.checkmark" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
