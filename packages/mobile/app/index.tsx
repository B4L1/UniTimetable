import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/appStore';
import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';

export default function Index() {
    const { selectedClass, isLoading } = useAppStore();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            // Use a small timeout to ensure navigation happens after mount stabilization
            const timer = setTimeout(() => {
                const href = selectedClass ? "/(tabs)/timetable" : "/onboarding";
                router.replace(href);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isLoading, selectedClass]);

    return (
        <View style={{ flex: 1, backgroundColor: '#0f0f23', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#818cf8" />
        </View>
    );
}
