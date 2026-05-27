import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import Screen from '../components/Screen';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../context/ThemeContext';
import { AuthError, loginCitizen } from '../services/AuthService';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'> & {
  onAuthenticate: (role: 'client') => void;
};

export default function LoginScreen({ navigation, onAuthenticate }: Props) {
  const { theme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    try {
      if (!validateForm()) return;

      setIsLoading(true);
      await loginCitizen(email.trim(), password);
      onAuthenticate('client');
    } catch (error) {
      console.error('Login error:', error);
      const message =
        error instanceof AuthError
          ? error.message
          : 'Failed to log in';
      const hint =
        error instanceof AuthError && error.code === 'NETWORK'
          ? '\n\nStart the server: npm run server'
          : '';
      Alert.alert('Sign in failed', message + hint);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <LinearGradient
        colors={theme.gradient}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <TouchableOpacity
              style={styles.backLink}
              onPress={() => navigation.navigate('AuthEntry')}
            >
              <Ionicons name="arrow-back" size={20} color={theme.contact} />
              <Text style={[styles.backText, { color: theme.contact }]}>All sign-in options</Text>
            </TouchableOpacity>
            {/* Header */}
            <View style={styles.header}>
              <GlassCard style={styles.logoCard}>
                <View style={[styles.logoContainer, { backgroundColor: theme.sosButton }]}>
                  <Ionicons name="shield-checkmark" size={48} color="#fff" />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>Safe Alert</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Welcome back! Sign in to continue
                </Text>
              </GlassCard>
            </View>

            {/* Login Form */}
            <GlassCard style={styles.formCard}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Citizen sign in</Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address</Text>
                <View style={[styles.inputContainer, { 
                  backgroundColor: theme.glassBg,
                  borderColor: theme.liquidBorder,
                }]}>
                  <Ionicons name="mail" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Enter your email"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
                <View style={[styles.inputContainer, { 
                  backgroundColor: theme.glassBg,
                  borderColor: theme.liquidBorder,
                }]}>
                  <Ionicons name="lock-closed" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off" : "eye"} 
                      size={20} 
                      color={theme.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={isLoading}
              >
                <Text style={[styles.forgotPasswordText, { color: theme.contact }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  { backgroundColor: theme.sosButton },
                  isLoading && { opacity: 0.7 }
                ]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="log-in" size={20} color="#fff" />
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  </>
                )}
              </TouchableOpacity>
            </GlassCard>

            <GlassCard style={styles.registerCard}>
              <Text style={[styles.registerText, { color: theme.textSecondary }]}>
                Don't have an account?
              </Text>
              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => navigation.navigate('Register')}
                disabled={isLoading}
              >
                <Text style={[styles.registerButtonText, { color: theme.contact }]}>
                  Create citizen account
                </Text>
                <Ionicons name="arrow-forward" size={16} color={theme.contact} />
              </TouchableOpacity>
            </GlassCard>

            {/* Features */}
            <GlassCard style={styles.featuresCard}>
              <Text style={[styles.featuresTitle, { color: theme.text }]}>
                Why Choose Safe Alert?
              </Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: theme.location }]}>
                    <Ionicons name="shield-checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                    Emergency SOS with GPS tracking
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: theme.contact }]}>
                    <Ionicons name="people" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                    Emergency contacts management
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: theme.hospital }]}>
                    <Ionicons name="medical" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>
                    Medical information sharing
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  backText: { fontSize: 15, fontWeight: '600' },
  header: {
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  logoCard: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#DC143C',
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
    textAlign: 'center',
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  formCard: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  modeChipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modeHint: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    padding: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#DC143C',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  registerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  registerText: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  featuresCard: {
    paddingVertical: 24,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
}); 