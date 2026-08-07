import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { palette, fonts } from '@/constants/theme';

// Simple icon components (can be replaced with proper icons later)
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
    <View style={styles.iconContainer}>
        <Text style={[styles.icon, focused && styles.iconFocused]}>
            {name === 'timetable' ? '📅' : name === 'planner' ? '✏️' : '⚙️'}
        </Text>
    </View>
);

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: palette.accent,
                tabBarInactiveTintColor: palette.textSecondary,
                tabBarLabelStyle: styles.tabBarLabel,
            }}
        >
            <Tabs.Screen
                name="timetable"
                options={{
                    title: 'Órarend',
                    tabBarIcon: ({ focused }) => <TabIcon name="timetable" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="planner"
                options={{
                    title: 'Tervező',
                    tabBarIcon: ({ focused }) => <TabIcon name="planner" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Beállítások',
                    tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: palette.bgSurface,
        borderTopColor: palette.borderDefault,
        borderTopWidth: 1,
        paddingTop: 8,
        paddingBottom: 8,
        height: 65,
    },
    tabBarLabel: {
        fontSize: 12,
        fontWeight: '500',
        fontFamily: fonts.sansMedium,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 22,
        opacity: 0.6,
    },
    iconFocused: {
        opacity: 1,
    },
});
