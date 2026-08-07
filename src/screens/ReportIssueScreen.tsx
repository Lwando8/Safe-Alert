import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../components/Screen';
import { useTheme } from '../context/ThemeContext';
import { createOperationalRequestMobile } from '../services/FirebaseCallables';

const CATEGORIES = [
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'it', label: 'IT' },
  { id: 'building_maintenance', label: 'Building maintenance' },
  { id: 'other', label: 'Other' },
];

/**
 * Report an Issue — facilities / operations path (not SOS).
 * Writes via Firebase callable; tenant stamped server-side.
 */
export default function ReportIssueScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState('plumbing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => title.trim().length > 2 && description.trim().length > 5 && !submitting,
    [title, description, submitting]
  );

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      let location: { latitude: number; longitude: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          location = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
        }
      } catch {
        // location optional for facilities
      }

      await createOperationalRequestMobile({
        category,
        title: title.trim(),
        description: description.trim(),
        priority,
        location,
      });

      Alert.alert('Request submitted', 'Facilities will review your request.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to submit request. Try again later.';
      Alert.alert('Could not submit', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <Text style={[styles.heading, { color: theme.text }]}>Report an Issue</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          Facilities and maintenance requests — separate from emergency SOS.
        </Text>

        <Text style={[styles.label, { color: theme.textSecondary }]}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setCategory(c.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: category === c.id ? theme.primary : theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: category === c.id ? '#fff' : theme.text,
                  fontSize: 13,
                }}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Short summary"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
          ]}
        />

        <Text style={[styles.label, { color: theme.textSecondary }]}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What needs attention?"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[
            styles.input,
            styles.area,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
          ]}
        />

        <Text style={[styles.label, { color: theme.textSecondary }]}>Priority</Text>
        <View style={styles.chips}>
          {['low', 'normal', 'high', 'urgent'].map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setPriority(p)}
              style={[
                styles.chip,
                {
                  backgroundColor: priority === p ? theme.primary : theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={{ color: priority === p ? '#fff' : theme.text, fontSize: 13 }}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          disabled={!canSubmit}
          onPress={submit}
          style={[
            styles.submit,
            { backgroundColor: canSubmit ? theme.primary : theme.border },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  sub: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  area: { minHeight: 110, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  submit: {
    marginTop: 28,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
