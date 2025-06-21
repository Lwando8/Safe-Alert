import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import GlassCard from '../../components/GlassCard';
import { useTheme } from '../../context/ThemeContext';

// Fallback for LinearGradient in Expo Go
let LinearGradient: any;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = View; // Fallback to regular View
}

export default function PrivacyPolicyScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();

  const privacyData = [
    {
      title: 'Information We Collect',
      content: 'Safe Alert collects only essential information for emergency services: your name, phone number, emergency contacts, medical information (if provided), and location data during emergency situations.'
    },
    {
      title: 'How We Use Your Information',
      content: 'Your information is used exclusively for emergency services: contacting first responders, notifying emergency contacts, and providing your location during emergencies. We do not use your data for marketing or advertising.'
    },
    {
      title: 'Location Data',
      content: 'Location data is collected only during emergency situations or when you explicitly share your location. This data is immediately shared with emergency services and your emergency contacts to ensure rapid response.'
    },
    {
      title: 'Emergency Contacts',
      content: 'Emergency contact information is stored securely on your device and our servers. This information is only accessed during emergency situations to notify your contacts of your status.'
    },
    {
      title: 'Medical Information',
      content: 'Any medical information you provide (blood type, allergies, medications) is shared with first responders during emergencies to ensure appropriate medical care.'
    },
    {
      title: 'Data Storage and Security',
      content: 'Your data is encrypted in transit and at rest. We use industry-standard security measures to protect your information. Emergency data is stored for medical and legal purposes as required by law.'
    },
    {
      title: 'Data Sharing',
      content: 'We only share your data with emergency services, medical personnel, and your designated emergency contacts during emergency situations. We do not sell or share your data with third parties for any other purposes.'
    },
    {
      title: 'Your Rights',
      content: 'You can update or delete your information at any time through the app settings. However, some data may be retained for legal compliance and emergency service requirements.'
    },
    {
      title: 'Children\'s Privacy',
      content: 'Safe Alert is designed for users 13 years and older. If a child under 13 is using the app, parental consent is required, and parents control all emergency settings.'
    },
    {
      title: 'Changes to This Policy',
      content: 'We may update this privacy policy to reflect changes in our practices or for legal compliance. We will notify users of significant changes through the app.'
    }
  ];

  return (
    <Screen>
      <LinearGradient colors={theme.backgroundGradient} style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Title Card */}
            <GlassCard style={styles.titleCard}>
              <View style={[styles.iconContainer, { backgroundColor: theme.location }]}>
                <Ionicons name="shield-checkmark" size={32} color="#fff" />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Privacy Policy</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Your privacy and security are our top priority
              </Text>
            </GlassCard>

            {/* Last Updated */}
            <GlassCard style={styles.updateCard}>
              <Text style={[styles.updateText, { color: theme.textSecondary }]}>
                Last updated: {new Date().toLocaleDateString()}
              </Text>
            </GlassCard>

            {/* Privacy Notice */}
            <GlassCard style={styles.noticeCard}>
              <View style={styles.noticeHeader}>
                <View style={[styles.noticeIcon, { backgroundColor: theme.hospital }]}>
                  <Ionicons name="medical" size={20} color="#fff" />
                </View>
                <Text style={[styles.noticeTitle, { color: theme.text }]}>
                  Emergency Priority
                </Text>
              </View>
              <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
                During emergencies, your safety takes precedence over privacy concerns. Information will be shared with emergency services and contacts to ensure rapid response and appropriate care.
              </Text>
            </GlassCard>

            {/* Privacy Sections */}
            {privacyData.map((section, index) => (
              <GlassCard key={index} style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {index + 1}. {section.title}
                </Text>
                <Text style={[styles.sectionContent, { color: theme.textSecondary }]}>
                  {section.content}
                </Text>
              </GlassCard>
            ))}

            {/* Security Promise */}
            <GlassCard style={styles.securityCard}>
              <View style={styles.securityHeader}>
                <View style={[styles.securityIcon, { backgroundColor: theme.contact }]}>
                  <Ionicons name="lock-closed" size={24} color="#fff" />
                </View>
                <Text style={[styles.securityTitle, { color: theme.text }]}>
                  Our Security Promise
                </Text>
              </View>
              <Text style={[styles.securityText, { color: theme.textSecondary }]}>
                We are committed to protecting your personal information with enterprise-grade security measures. Your data is encrypted, access is strictly controlled, and we never sell your information to third parties.
              </Text>
            </GlassCard>

            {/* Contact */}
            <GlassCard style={styles.contactCard}>
              <Text style={[styles.contactTitle, { color: theme.text }]}>
                Privacy Questions?
              </Text>
              <Text style={[styles.contactText, { color: theme.textSecondary }]}>
                Contact our privacy team at: privacy@safealert.com
              </Text>
            </GlassCard>
          </ScrollView>
        </View>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  titleCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#32d74b',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  updateCard: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  updateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  noticeCard: {
    marginBottom: 20,
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  noticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  noticeText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  sectionCard: {
    marginBottom: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  sectionContent: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  },
  securityCard: {
    marginBottom: 16,
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: 'rgba(220, 20, 60, 0.3)',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  securityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  securityTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  securityText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  contactCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 40,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  contactText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 