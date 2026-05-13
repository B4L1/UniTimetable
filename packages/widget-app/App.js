import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { WidgetUI } from './WidgetUI';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('No database loaded');

  // On mount, check if DB exists
  React.useEffect(() => {
    AsyncStorage.getItem('@timetable_db').then((res) => {
      if (res) {
        setStatus('Database is loaded and ready.');
      }
    });
  }, []);

  const handleImport = async () => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);

        // Save imported file directly into Async Storage
        await AsyncStorage.setItem('@timetable_db', fileContent);
        await AsyncStorage.setItem('@widget_offset', '0'); // reset offset
        
        // Notify the widget to update using the parsed valid data
        try {
          // Calculate the correct offset/schedule exactly like task handler
          const parsed = JSON.parse(fileContent);
          let schedule = [];
          if (Array.isArray(parsed)) schedule = parsed;
          else if (parsed.timetableEntries) schedule = parsed.timetableEntries;
          
          schedule.sort((a, b) => {
              if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
              return (a.start_time || '').localeCompare(b.start_time || '');
          });

          requestWidgetUpdate({
            widgetName: 'UniWidget',
            renderWidget: () => <WidgetUI schedule={schedule} offset={0} />,
            widgetNotFound: () => console.log('Widget not added yet.'),
          });
        } catch (e) {
            console.log("Widget error", e);
        }

        setStatus('Database explicitly imported!');
        Alert.alert('Success', 'Database imported successfully. The widget will now update.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', `Failed to import the database. Details: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>UniTimetable Widget Setup</Text>
      <Text style={styles.subtitle}>{status}</Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleImport}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
           {loading ? 'Importing...' : 'Import DB (JSON)'}
        </Text>
      </TouchableOpacity>
      
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0b0',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  }
});
