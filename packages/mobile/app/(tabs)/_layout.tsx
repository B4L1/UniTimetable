import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

// Simple icon components (can be replaced with proper icons later)
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
    <View style={styles.iconContainer}>
        <Text style={[styles.icon, focused && styles.iconFocused]}>
            {name === 'timetable' ? '📅' : name === 'planner' ? '✏️' : '⚙️'}
        </Text>
    </View>
);

export default function TabLayout() {
    console.log('Rendering TabLayout');
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: '#8be9fd',
                tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
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
        backgroundColor: 'rgba(15, 15, 35, 0.95)',
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        borderTopWidth: 1,
        paddingTop: 8,
        paddingBottom: 8,
        height: 65,
    },
    tabBarLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 22,
        opacity: 0.5,
    },
    iconFocused: {
        opacity: 1,
    },
});
