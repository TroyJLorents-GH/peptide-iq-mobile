import { Text, View } from '../tw';
import type { EvidenceTier } from '../types';

// Fixed accent colors (same in both modes) — mirror web EvidenceBadge.
const BADGE_CONFIG: Record<EvidenceTier, { label: string; color: string; bgColor: string }> = {
  'fda-label': { label: 'FDA Label', color: '#66BB6A', bgColor: 'rgba(102, 187, 106, 0.12)' },
  'clinical-trial': { label: 'Clinical Trial', color: '#29B6F6', bgColor: 'rgba(41, 182, 246, 0.12)' },
  'peer-reviewed': { label: 'Peer-Reviewed', color: '#AB47BC', bgColor: 'rgba(171, 71, 188, 0.12)' },
  'case-report': { label: 'Case Report', color: '#FFA726', bgColor: 'rgba(255, 167, 38, 0.12)' },
  'experimental': { label: 'Experimental', color: '#EF5350', bgColor: 'rgba(239, 83, 80, 0.12)' },
  'user-note': { label: 'User Note', color: '#78909C', bgColor: 'rgba(120, 144, 156, 0.12)' },
};

export default function EvidenceBadge({ tier }: { tier: EvidenceTier }) {
  const config = BADGE_CONFIG[tier];
  if (!config) return null;
  return (
    <View
      className="self-start rounded-full px-2 py-0.5 border"
      style={{ backgroundColor: config.bgColor, borderColor: `${config.color}30` }}
    >
      <Text className="text-[11px] font-semibold" style={{ color: config.color }}>
        {config.label}
      </Text>
    </View>
  );
}
