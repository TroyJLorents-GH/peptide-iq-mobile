import { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from '../tw';
import { Banner, Button } from './ui';
import { useThemeMode } from '../context/ThemeModeContext';

const STORAGE_KEY = 'peptideiq_disclaimer_accepted_v1';

const POINTS = [
  'We do not provide medical advice, diagnosis, or treatment recommendations.',
  'All calculations, charts, and content are for educational and informational purposes only.',
  'Pharmacokinetic estimates are theoretical models — actual serum levels vary by individual.',
  'Always consult a licensed physician before starting, stopping, or adjusting any peptide, supplement, or medication.',
  'We do not sell, prescribe, or endorse any compound. Many peptides are research chemicals not approved by the FDA for human use.',
  'You are solely responsible for any decisions you make based on information from this app.',
  'In case of emergency or adverse reaction, call 911 or your local emergency services immediately.',
];

export default function DisclaimerModal() {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const { colors } = useThemeMode();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(accepted => {
      if (!accepted) setOpen(true);
    });
  }, []);

  const handleAccept = () => {
    AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  };

  return (
    /* Explicit palette colors: CSS variables don't reach native Modal content. */
    <Modal visible={open} transparent animationType="fade">
      <View className="flex-1 justify-center px-5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
        <View className="border rounded-lg max-h-[85%]" style={{ backgroundColor: colors.surface, borderColor: colors.cardBorder }}>
          <View className="flex-row items-center gap-2.5 px-4 pt-4 pb-2">
            <MaterialIcons name="warning-amber" size={26} color={colors.warning} />
            <Text className="text-base font-semibold" style={{ color: colors.text }}>Important Medical Disclaimer</Text>
          </View>
          <ScrollView contentContainerClassName="px-4 pb-2">
            <Banner tone="warning">
              PeptideIQ is not a medical device, pharmacy, or healthcare provider.
            </Banner>
            <Text className="text-[13px] mt-3 mb-2" style={{ color: colors.text }}>By using this app you acknowledge:</Text>
            {POINTS.map((p, i) => (
              <View key={i} className="flex-row gap-2 mb-2">
                <Text className="text-[13px]" style={{ color: colors.muted }}>{'•'}</Text>
                <Text className="flex-1 text-[13px] leading-5" style={{ color: colors.text }}>{p}</Text>
              </View>
            ))}
            <Pressable
              className="flex-row items-center gap-2.5 mt-2 mb-1"
              onPress={() => setAcknowledged(a => !a)}
            >
              <MaterialIcons
                name={acknowledged ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={acknowledged ? colors.warning : colors.muted}
              />
              <Text className="text-[13px]" style={{ color: colors.text }}>I understand and accept these terms.</Text>
            </Pressable>
          </ScrollView>
          <View className="px-4 pb-4 pt-2">
            <Button title="I Understand — Continue" onPress={handleAccept} disabled={!acknowledged} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
