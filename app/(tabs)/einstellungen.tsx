import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Image,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { Switch, Alert, Appearance } from 'react-native';
import { ChevronRight, X, PenLine, Upload, Download, Trash2, AlertTriangle, Bell, Moon } from 'lucide-react-native';
import { useThemeColors, typography, spacing, radii, shadows } from '@/theme';
import { getAllSettings, setSetting, deleteAllTrips, clearAllData } from '@/db/queries';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { exportData, readBackupFile, importData, type ImportPreview } from '@/utils/backup';
import { DrumColumn } from '@/components/ui/DrumColumn';
import { parseTime, formatTime } from '@/utils/format';
import { updateReminders } from '@/utils/notifications';
import type { Settings } from '@/db/types';

type EditingField = {
  key: keyof Settings;
  label: string;
  value: string;
  type: 'text' | 'time' | 'toggle';
  placeholder: string;
};

const FIELD_META: Partial<Record<keyof Settings, { label: string; type: 'text' | 'time' | 'toggle'; placeholder: string }>> = {
  fahrerName: { label: 'Name, Vorname', type: 'text', placeholder: 'z. B. Mustermann, Max' },
  defaultTour: { label: 'Standard Tour-Nr.', type: 'text', placeholder: 'z. B. 12' },
  defaultBeginn: { label: 'Standard Beginn', type: 'time', placeholder: '07:00' },
  defaultAnkunft: { label: 'Standard Ankunft', type: 'time', placeholder: '07:30' },
  defaultAbfahrt: { label: 'Standard Abfahrt', type: 'time', placeholder: '07:45' },
  defaultEnde: { label: 'Standard Ende', type: 'time', placeholder: '09:00' },
  reminderEnabled: { label: 'Erinnerung aktivieren', type: 'toggle', placeholder: '' },
  reminderTime: { label: 'Erinnerungszeit', type: 'time', placeholder: '17:00' },
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

export default function EinstellungenScreen() {
  const db = useSQLiteContext();
  const colors = useThemeColors();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editing, setEditing] = useState<EditingField | null>(null);
  const [draft, setDraft] = useState('');
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [resetModal, setResetModal] = useState<'trips' | 'all' | null>(null);

  const sectionLabel = {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  } as const;

  const load = useCallback(async () => {
    setSettings(await getAllSettings(db));
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEdit = (key: keyof Settings) => {
    const meta = FIELD_META[key];
    if (!meta) return;
    const val = settings?.[key];
    const stringVal = typeof val === 'boolean' ? String(val) : (val ?? '');
    setDraft(stringVal);
    setEditing({ key, label: meta.label, value: stringVal, type: meta.type, placeholder: meta.placeholder });
  };

  const handleSave = async () => {
    if (!editing) return;
    await setSetting(db, editing.key, draft.trim());
    
    // If we updated the reminder time, reschedule it
    if (editing.key === 'reminderTime' && settings?.reminderEnabled) {
      await updateReminders(true, draft.trim());
    }
    
    setEditing(null);
    load();
  };

  const handleReminderToggle = async (enabled: boolean) => {
    const value = enabled ? 'true' : 'false';
    await setSetting(db, 'reminderEnabled', value);
    await updateReminders(enabled, settings?.reminderTime ?? '17:00');
    load();
  };

  const handleThemeToggle = async () => {
    if (!settings) return;
    const current = settings.theme;
    let next: 'light' | 'dark' | 'system' = 'system';
    if (current === 'system') next = 'light';
    else if (current === 'light') next = 'dark';
    
    await setSetting(db, 'theme', next);
    Appearance.setColorScheme(next === 'system' ? null : next);
    load();
  };

  const handleSignatureSave = async (dataUrl: string) => {
    await setSetting(db, 'unterschrift', dataUrl);
    setSignaturePadOpen(false);
    load();
  };

  const handleSignatureClear = async () => {
    await setSetting(db, 'unterschrift', '');
    load();
  };

  const handleExport = async () => {
    setBackupBusy(true);
    try {
      await exportData(db);
    } catch {
      Alert.alert('Fehler', 'Export fehlgeschlagen.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handlePickImport = async () => {
    try {
      const preview = await readBackupFile();
      setImportPreview(preview);
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'CANCELLED') {
        Alert.alert('Fehler', e.message);
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setBackupBusy(true);
    setImportPreview(null);
    try {
      await importData(db, importPreview.raw);
      load();
    } catch {
      Alert.alert('Fehler', 'Import fehlgeschlagen.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetModal) return;
    try {
      if (resetModal === 'trips') {
        await deleteAllTrips(db);
      } else {
        await clearAllData(db);
      }
      setResetModal(null);
      load();
    } catch {
      Alert.alert('Fehler', 'Aktion fehlgeschlagen.');
    }
  };

  if (!settings) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.screen, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.screen }} contentContainerStyle={{ padding: spacing.base, gap: spacing.lg }}>

      {/* Fahrer section */}
      <View>
        <Text style={sectionLabel}>Fahrer</Text>
        <SettingRow
          label={FIELD_META.fahrerName!.label}
          value={settings.fahrerName}
          placeholder="Nicht festgelegt"
          onPress={() => openEdit('fahrerName')}
        />
      </View>

      {/* Standard-Zeiten section */}
      <View>
        <Text style={sectionLabel}>Standard-Werte (für neue Einträge)</Text>
        <View style={{ borderRadius: radii.md, overflow: 'hidden', ...shadows.card }}>
          <SettingRow
            label={FIELD_META.defaultTour!.label}
            value={settings.defaultTour}
            placeholder="Nicht festgelegt"
            onPress={() => openEdit('defaultTour')}
            bordered
          />
          <SettingRow
            label={FIELD_META.defaultBeginn!.label}
            value={settings.defaultBeginn}
            placeholder="07:00"
            onPress={() => openEdit('defaultBeginn')}
            bordered
          />
          <SettingRow
            label={FIELD_META.defaultAnkunft!.label}
            value={settings.defaultAnkunft}
            placeholder="07:30"
            onPress={() => openEdit('defaultAnkunft')}
            bordered
          />
          <SettingRow
            label={FIELD_META.defaultAbfahrt!.label}
            value={settings.defaultAbfahrt}
            placeholder="07:45"
            onPress={() => openEdit('defaultAbfahrt')}
            bordered
          />
          <SettingRow
            label={FIELD_META.defaultEnde!.label}
            value={settings.defaultEnde}
            placeholder="09:00"
            onPress={() => openEdit('defaultEnde')}
          />
        </View>
      </View>

      {/* Reminder section */}
      <View>
        <Text style={sectionLabel}>Erinnerung</Text>
        <View style={{ borderRadius: radii.md, overflow: 'hidden', ...shadows.card }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              minHeight: 64,
              backgroundColor: colors.bg.card,
              borderBottomWidth: settings.reminderEnabled ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
                Tägliche Erinnerung
              </Text>
              <Text style={{ fontSize: typography.sizes.base, color: colors.text.primary }}>
                {settings.reminderEnabled ? 'Aktiviert' : 'Deaktiviert'}
              </Text>
            </View>
            <Switch
              value={settings.reminderEnabled}
              onValueChange={handleReminderToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          {settings.reminderEnabled && (
            <SettingRow
              label="Erinnerungszeit"
              value={settings.reminderTime}
              placeholder="17:00"
              onPress={() => openEdit('reminderTime')}
            />
          )}
        </View>
      </View>

      {/* Appearance section */}
      <View>
        <Text style={sectionLabel}>Erscheinungsbild</Text>
        <View style={{ borderRadius: radii.md, overflow: 'hidden', ...shadows.card }}>
          <Pressable
            onPress={handleThemeToggle}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              minHeight: 64,
              backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
                Farbmodus
              </Text>
              <Text style={{ fontSize: typography.sizes.base, color: colors.text.primary, textTransform: 'capitalize' }}>
                {settings.theme === 'system' ? 'Geräte-Standard' : (settings.theme === 'light' ? 'Hell' : 'Dunkel')}
              </Text>
            </View>
            <Moon size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Unterschrift section */}
      <View>
        <Text style={sectionLabel}>Unterschrift</Text>
        <Pressable
          onPress={() => setSignaturePadOpen(true)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
            borderRadius: radii.md,
            padding: spacing.base,
            minHeight: 80,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: settings?.unterschrift ? 'solid' : 'dashed',
            ...shadows.card,
          })}
        >
          {settings?.unterschrift ? (
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <View style={{ backgroundColor: 'white', padding: spacing.xs, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border }}>
                <Image
                  source={{ uri: settings.unterschrift }}
                  style={{ width: 200, height: 60 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.primary }}>
                Tippen zum Ändern
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <PenLine size={28} color={colors.text.disabled} />
              <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
                Unterschrift hinzufügen
              </Text>
            </View>
          )}
        </Pressable>
        {settings?.unterschrift ? (
          <Pressable onPress={handleSignatureClear} style={{ marginTop: spacing.sm, alignSelf: 'center' }}>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.error }}>
              Unterschrift entfernen
            </Text>
          </Pressable>
        ) : null}
      </View>

      <SignaturePad
        visible={signaturePadOpen}
        onSave={handleSignatureSave}
        onClose={() => setSignaturePadOpen(false)}
      />

      {/* Daten section */}
      <View>
        <Text style={sectionLabel}>Daten</Text>
        <View style={{ borderRadius: radii.md, overflow: 'hidden', ...shadows.card }}>

          {/* Export */}
          <Pressable
            onPress={handleExport}
            disabled={backupBusy}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              minHeight: 64,
              backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            })}
          >
            <Upload size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.sizes.base, color: colors.text.primary }}>
                Daten exportieren
              </Text>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
                Alle Fahrten und Einstellungen als Datei teilen
              </Text>
            </View>
            {backupBusy && <ActivityIndicator color={colors.primary} />}
          </Pressable>

          {/* Import */}
          <Pressable
            onPress={handlePickImport}
            disabled={backupBusy}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              minHeight: 64,
              backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
            })}
          >
            <Download size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.sizes.base, color: colors.text.primary }}>
                Daten importieren
              </Text>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
                Backup-Datei auswählen und wiederherstellen
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Import confirmation modal */}
      <Modal visible={importPreview !== null} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View
            style={{
              backgroundColor: colors.bg.card,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary, textAlign: 'center' }}>
              Daten importieren?
            </Text>

            {importPreview && (
              <View style={{ backgroundColor: colors.bg.subtle, borderRadius: radii.md, padding: spacing.base, gap: spacing.xs }}>
                <Row label="Fahrer" value={importPreview.fahrerName} />
                <Row label="Fahrten" value={String(importPreview.tripCount)} />
                <Row
                  label="Erstellt am"
                  value={new Date(importPreview.exportedAt).toLocaleDateString('de-DE')}
                />
              </View>
            )}

            <Text style={{ fontSize: typography.sizes.sm, color: colors.error, textAlign: 'center' }}>
              Alle bestehenden Daten werden unwiderruflich ersetzt.
            </Text>

            <Pressable
              onPress={handleConfirmImport}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radii.sm,
                backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.text.inverse }}>
                Importieren
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setImportPreview(null)}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radii.sm,
                backgroundColor: pressed ? colors.bg.subtle : colors.bg.screen,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ fontSize: typography.sizes.base, color: colors.text.secondary }}>
                Abbrechen
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={editing !== null} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={{
              backgroundColor: colors.bg.card,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            {/* Sheet header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary }}>
                {editing?.label}
              </Text>
              <Pressable onPress={() => setEditing(null)} hitSlop={12}>
                <X size={22} color={colors.text.secondary} />
              </Pressable>
            </View>

            {editing?.type === 'time' ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.bg.card,
                  paddingVertical: spacing.md,
                }}
              >
                <DrumColumn
                  items={HOURS}
                  value={parseTime(draft).hours}
                  onChange={(h) => setDraft(formatTime(h, parseTime(draft).minutes))}
                  formatter={pad}
                  width={100}
                />
                <Text
                  style={{
                    fontSize: typography.sizes.xxl,
                    fontWeight: typography.weights.bold,
                    color: colors.text.primary,
                    marginHorizontal: spacing.sm,
                    marginBottom: 4,
                  }}
                >
                  :
                </Text>
                <DrumColumn
                  items={MINUTES}
                  value={Math.round(parseTime(draft).minutes / 5) * 5 % 60}
                  onChange={(m) => setDraft(formatTime(parseTime(draft).hours, m))}
                  formatter={pad}
                  width={100}
                />
              </View>
            ) : (
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                placeholder={editing?.placeholder}
                placeholderTextColor={colors.text.disabled}
                style={{
                  fontSize: typography.sizes.base,
                  color: colors.text.primary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.sm,
                  backgroundColor: colors.bg.input,
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.md,
                  minHeight: 56,
                }}
              />
            )}

            <Pressable
              onPress={handleSave}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radii.sm,
                backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.text.inverse }}>
                Speichern
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Danger Zone section */}
      <View style={{ marginTop: spacing.md }}>
        <Text style={[sectionLabel, { color: colors.error }]}>Gefahrenzone</Text>
        <View style={{ borderRadius: radii.md, overflow: 'hidden', ...shadows.card }}>
          
          <Pressable
            onPress={() => setResetModal('trips')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              minHeight: 64,
              backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            })}
          >
            <Trash2 size={22} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.sizes.base, color: colors.error }}>
                Alle Fahrten löschen
              </Text>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
                Löscht alle Log-Einträge, behält Einstellungen
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setResetModal('all')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              minHeight: 64,
              backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
            })}
          >
            <AlertTriangle size={22} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.sizes.base, color: colors.error }}>
                App zurücksetzen
              </Text>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
                Löscht ALLES und setzt die App zurück
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Reset confirmation modal */}
      <Modal visible={resetModal !== null} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View
            style={{
              backgroundColor: colors.bg.card,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary, textAlign: 'center' }}>
              {resetModal === 'trips' ? 'Alle Fahrten löschen?' : 'Vollständiger Reset?'}
            </Text>

            <Text style={{ fontSize: typography.sizes.base, color: colors.text.secondary, textAlign: 'center' }}>
              {resetModal === 'trips' 
                ? 'Dies löscht alle aufgezeichneten Fahrten. Dieser Schritt kann nicht rückgängig gemacht werden.'
                : 'Dies löscht alle Fahrten, Namen, Signaturen und Standard-Zeiten. Die App wird vollständig geleert.'
              }
            </Text>

            <Pressable
              onPress={handleConfirmReset}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radii.sm,
                backgroundColor: pressed ? '#b91c1c' : colors.error,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: spacing.sm,
              })}
            >
              <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.text.inverse }}>
                {resetModal === 'trips' ? 'Ja, Fahrten löschen' : 'Ja, alles löschen'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setResetModal(null)}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radii.sm,
                backgroundColor: pressed ? colors.bg.subtle : colors.bg.screen,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ fontSize: typography.sizes.base, color: colors.text.primary }}>
                Abbrechen
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SettingRow({
  label, value, placeholder, onPress, bordered,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  bordered?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        minHeight: 64,
        backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
        borderBottomWidth: bordered ? 1 : 0,
        borderBottomColor: colors.border,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>{label}</Text>
        <Text style={{ fontSize: typography.sizes.base, color: value ? colors.text.primary : colors.text.disabled }}>
          {value || placeholder}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.text.disabled} />
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>{label}</Text>
      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.text.primary }}>{value}</Text>
    </View>
  );
}
