import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../components/Screen';
import { useTheme } from '../context/ThemeContext';
import {
  addAlertSightingMobile,
  createCommunityAlertMobile,
  listCommunityAlertsMobile,
  listCommunityEventsMobile,
  listCommunityGroupsMobile,
  listBroadcastsMobile,
} from '../services/FirebaseCallables';

/**
 * Tenant Community hub — groups, lean events, community alerts, official broadcasts.
 * Progressive disclosure; fails softly when modules/auth unavailable.
 */
export default function CommunityHubScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [broadcasts, setBroadcasts] = useState<Array<Record<string, unknown>>>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState('dog');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [g, e, a, b] = await Promise.allSettled([
        listCommunityGroupsMobile(),
        listCommunityEventsMobile(),
        listCommunityAlertsMobile({}),
        listBroadcastsMobile(),
      ]);
      if (g.status === 'fulfilled') {
        setGroups(((g.value as any).groups || []) as Array<Record<string, unknown>>);
      }
      if (e.status === 'fulfilled') {
        setEvents(((e.value as any).events || []) as Array<Record<string, unknown>>);
      }
      if (a.status === 'fulfilled') {
        setAlerts(((a.value as any).alerts || []) as Array<Record<string, unknown>>);
      }
      if (b.status === 'fulfilled') {
        setBroadcasts(((b.value as any).broadcasts || []) as Array<Record<string, unknown>>);
      }
      if (
        g.status === 'rejected' &&
        e.status === 'rejected' &&
        a.status === 'rejected' &&
        b.status === 'rejected'
      ) {
        setError('Community features require organization membership and enabled modules.');
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitMissingPet() {
    try {
      await createCommunityAlertMobile({
        type: 'MISSING_PET',
        title: title || `Missing ${petType}: ${petName}`,
        description,
        details: {
          petName,
          petType,
          // Forbidden keys intentionally omitted — privacy strip on server
        },
      });
      setComposeOpen(false);
      setPetName('');
      setTitle('');
      setDescription('');
      await load();
      Alert.alert('Alert posted', 'Your missing pet alert is visible to org members.');
    } catch (err) {
      Alert.alert(
        'Could not post',
        err instanceof Error ? err.message : 'Unable to create alert'
      );
    }
  }

  async function reportSighting(alertId: string) {
    try {
      await addAlertSightingMobile({
        alertId,
        note: 'Possible sighting reported from mobile',
      });
      Alert.alert('Sighting sent', 'The reporter has been notified.');
    } catch (err) {
      Alert.alert(
        'Could not report',
        err instanceof Error ? err.message : 'Unable to add sighting'
      );
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <Text style={[styles.heading, { color: theme.text }]}>Community</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          Groups, events, and neighbor alerts for your organization.
        </Text>

        {error ? (
          <Text style={[styles.error, { color: theme.danger || '#c0392b' }]}>{error}</Text>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={[styles.section, { color: theme.text }]}>Official broadcasts</Text>
        </View>
        {broadcasts.length === 0 ? (
          <Text style={{ color: theme.textSecondary }}>No official broadcasts.</Text>
        ) : (
          broadcasts.map(b => (
            <View
              key={String(b.id)}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Text style={[styles.cardTitle, { color: theme.text }]}>{String(b.title)}</Text>
              <Text style={{ color: theme.textSecondary }}>{String(b.body)}</Text>
              <Text style={styles.meta}>official_broadcast · {String(b.severity || 'info')}</Text>
            </View>
          ))
        )}

        <View style={styles.sectionHead}>
          <Text style={[styles.section, { color: theme.text }]}>Community alerts</Text>
          <TouchableOpacity onPress={() => setComposeOpen(true)}>
            <Text style={{ color: theme.primary, fontWeight: '600' }}>Missing Pet</Text>
          </TouchableOpacity>
        </View>
        {alerts.length === 0 ? (
          <Text style={{ color: theme.textSecondary }}>No community alerts.</Text>
        ) : (
          alerts.map(a => (
            <View
              key={String(a.id)}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Text style={[styles.cardTitle, { color: theme.text }]}>{String(a.title)}</Text>
              <Text style={{ color: theme.textSecondary }}>{String(a.description)}</Text>
              <Text style={styles.meta}>
                {String(a.type)} · {String(a.status)}
              </Text>
              {a.status === 'open' ? (
                <TouchableOpacity onPress={() => reportSighting(String(a.id))}>
                  <Text style={{ color: theme.primary, marginTop: 8 }}>Report sighting</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}

        <Text style={[styles.section, { color: theme.text }]}>Groups</Text>
        {groups.length === 0 ? (
          <Text style={{ color: theme.textSecondary }}>No groups yet.</Text>
        ) : (
          groups.map(g => (
            <View
              key={String(g.id)}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Text style={[styles.cardTitle, { color: theme.text }]}>{String(g.name)}</Text>
              <Text style={{ color: theme.textSecondary }}>{String(g.description || '')}</Text>
            </View>
          ))
        )}

        <Text style={[styles.section, { color: theme.text }]}>Events</Text>
        {events.length === 0 ? (
          <Text style={{ color: theme.textSecondary }}>No upcoming events.</Text>
        ) : (
          events.map(e => (
            <View
              key={String(e.id)}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Text style={[styles.cardTitle, { color: theme.text }]}>{String(e.title)}</Text>
              <Text style={{ color: theme.textSecondary }}>
                {e.startsAt ? new Date(Number(e.startsAt)).toLocaleString() : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={composeOpen} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Missing Pet alert</Text>
            <TextInput
              placeholder="Pet name"
              placeholderTextColor={theme.textSecondary}
              value={petName}
              onChangeText={setPetName}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <TextInput
              placeholder="Pet type (dog, cat…)"
              placeholderTextColor={theme.textSecondary}
              value={petType}
              onChangeText={setPetType}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <TextInput
              placeholder="Title (optional)"
              placeholderTextColor={theme.textSecondary}
              value={title}
              onChangeText={setTitle}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <TextInput
              placeholder="Description / last seen"
              placeholderTextColor={theme.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, minHeight: 90 },
              ]}
            />
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8 }}>
              Email and phone are never auto-published. Add a contact method only if you choose.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setComposeOpen(false)}>
                <Text style={{ color: theme.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitMissingPet}>
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Post alert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  heading: { fontSize: 24, fontWeight: '700' },
  sub: { fontSize: 14, marginBottom: 16, marginTop: 4 },
  error: { marginBottom: 12, fontSize: 13 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  meta: { marginTop: 6, fontSize: 11, opacity: 0.7 },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
});
