import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../components/Screen';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../context/ThemeContext';
import {
  getMyServicesMobile,
  listMyOperationalRequestsMobile,
} from '../services/FirebaseCallables';

type ServiceItem = {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  route: string;
  icon: string;
  entitled: boolean;
  source?: string;
};

type MyRequestRow = {
  id: string;
  title?: string;
  category?: string;
  status?: string;
  priority?: string;
  slaTargetAt?: number | null;
  createdAt?: number;
};

/**
 * Person-first My Services hub (Phase F).
 * Routes to existing surfaces — does not reimplement SOS Home.
 */
export default function MyServicesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [terminologyOrg, setTerminologyOrg] = useState('Organisation');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequestRow[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const payload = (await getMyServicesMobile()) as {
        organizationId?: string;
        terminology?: { organization?: string; request?: string };
        services?: ServiceItem[];
      };
      setOrganizationId(payload.organizationId || '');
      setTerminologyOrg(payload.terminology?.organization || 'Organisation');
      const list = payload.services || [];
      setServices(list);

      const hasOps = list.some(s => s.moduleId === 'OPERATIONS' && s.entitled);
      if (hasOps) {
        try {
          const reqs = (await listMyOperationalRequestsMobile()) as {
            requests?: MyRequestRow[];
          };
          setMyRequests(reqs.requests || []);
        } catch {
          setMyRequests([]);
        }
      } else {
        setMyRequests([]);
      }
    } catch (err) {
      setServices([]);
      setMyRequests([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Services require organisation membership. SOS Home remains available.'
      );
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openService(item: ServiceItem) {
    const tabNav = navigation.getParent?.();
    const citizenNav = tabNav?.getParent?.() || tabNav;

    switch (item.route) {
      case 'home_sos':
        tabNav?.navigate?.('Home');
        break;
      case 'report_issue':
        citizenNav?.navigate?.('ReportIssue');
        break;
      case 'my_requests':
        setShowRequests(true);
        break;
      case 'community_hub':
      case 'broadcasts':
        tabNav?.navigate?.('Community');
        break;
      case 'ride_safety':
        Alert.alert(
          'Ride safety',
          'Escort requests are available when RIDE_SAFETY is enabled for your organisation. Full matching UX is coming later — this is not emergency SOS.'
        );
        break;
      default:
        break;
    }
  }

  function iconFor(name: string): keyof typeof Ionicons.glyphMap {
    const map: Record<string, keyof typeof Ionicons.glyphMap> = {
      warning: 'warning',
      construct: 'construct',
      list: 'list',
      people: 'people',
      paw: 'paw',
      'people-circle': 'people-circle',
      calendar: 'calendar',
      megaphone: 'megaphone',
      car: 'car',
    };
    return map[name] || 'apps';
  }

  return (
    <Screen>
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.background }]}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={theme.primary} />
        }
      >
        <Text style={[styles.title, { color: theme.text }]}>My Services</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Person-first services for{' '}
          {organizationId ? `${terminologyOrg} · ${organizationId}` : 'your membership'}.
          Emergency SOS still lives on Home.
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={theme.primary} />
        ) : null}

        {error ? (
          <GlassCard style={styles.card}>
            <Text style={{ color: theme.textSecondary }}>{error}</Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              You can still use Home SOS without this catalog.
            </Text>
          </GlassCard>
        ) : null}

        {!loading && !error && services.length === 0 ? (
          <GlassCard style={styles.card}>
            <Text style={{ color: theme.text }}>No entitled services yet</Text>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Join an organisation with modules enabled, or use Home for SOS.
            </Text>
          </GlassCard>
        ) : null}

        {services.map(item => (
          <TouchableOpacity key={item.id} onPress={() => openService(item)} activeOpacity={0.8}>
            <GlassCard style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: theme.primaryGlass }]}>
                  <Ionicons name={iconFor(item.icon)} size={22} color={theme.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.itemDesc, { color: theme.textSecondary }]}>
                    {item.description}
                  </Text>
                  {item.source ? (
                    <Text style={[styles.source, { color: theme.textSecondary }]}>
                      {item.moduleId} · {item.source}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </View>
            </GlassCard>
          </TouchableOpacity>
        ))}

        {(showRequests || myRequests.length > 0) &&
        services.some(s => s.route === 'my_requests') ? (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.section, { color: theme.text }]}>My requests</Text>
            {myRequests.length === 0 ? (
              <GlassCard style={styles.card}>
                <Text style={{ color: theme.textSecondary }}>No requests yet.</Text>
              </GlassCard>
            ) : (
              myRequests.slice(0, 20).map(r => (
                <GlassCard key={r.id} style={styles.card}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>
                    {r.title || r.id}
                  </Text>
                  <Text style={[styles.itemDesc, { color: theme.textSecondary }]}>
                    {r.category || 'general'} · {r.status || 'submitted'} ·{' '}
                    {r.priority || 'normal'}
                  </Text>
                </GlassCard>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  section: { fontSize: 18, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  card: { marginBottom: 10, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  itemDesc: { fontSize: 13, marginTop: 2 },
  source: { fontSize: 11, marginTop: 4, textTransform: 'uppercase' },
  hint: { fontSize: 13, marginTop: 8 },
});
