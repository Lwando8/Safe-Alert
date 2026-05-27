import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface NewEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

const RELATIONSHIPS = ['Family', 'Friend', 'Doctor', 'Neighbor', 'Emergency Contact'] as const;

type Props = {
  visible: boolean;
  value: NewEmergencyContact;
  onChange: (value: NewEmergencyContact) => void;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
};

export default function AddEmergencyContactModal({
  visible,
  value,
  onChange,
  onClose,
  onSave,
  saving = false,
}: Props) {
  const { theme } = useTheme();
  const canSave = value.name.trim().length > 0 && value.phone.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            <View style={styles.sheetHeader}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primaryGlass }]}>
                <Ionicons name="person-add" size={22} color={theme.primary} />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.text }]}>Add emergency contact</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  They appear in My Community and receive alerts.
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close"
              >
                <Ionicons name="close-circle" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.label, { color: theme.text }]}>Full name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={value.name}
                onChangeText={text => onChange({ ...value, name: text })}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />

              <Text style={[styles.label, { color: theme.text }]}>Phone number</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={value.phone}
                onChangeText={text => onChange({ ...value, phone: text })}
                placeholder="e.g. +27 82 000 0000"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />

              <Text style={[styles.label, { color: theme.text }]}>Relationship</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {RELATIONSHIPS.map(rel => {
                  const selected = value.relationship === rel;
                  return (
                    <TouchableOpacity
                      key={rel}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? theme.primary : theme.surface,
                          borderColor: selected ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => onChange({ ...value, relationship: rel })}
                    >
                      <Text
                        style={{
                          color: selected ? theme.textOnPrimary : theme.text,
                          fontWeight: selected ? '600' : '500',
                          fontSize: 13,
                        }}
                      >
                        {rel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: theme.surface }]}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={[styles.footerBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.footerBtn,
                  styles.saveBtn,
                  {
                    backgroundColor: canSave ? theme.primary : theme.border,
                    opacity: saving ? 0.7 : 1,
                  },
                ]}
                onPress={onSave}
                disabled={!canSave || saving}
              >
                <Text style={[styles.footerBtnText, { color: theme.textOnPrimary }]}>
                  {saving ? 'Adding…' : 'Add contact'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  form: { paddingHorizontal: 20, maxHeight: 340 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtn: {},
  footerBtnText: { fontSize: 16, fontWeight: '600' },
});
