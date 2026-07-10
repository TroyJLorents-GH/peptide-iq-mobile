import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from '../tw';
import { Banner, Card, Screen } from '../components/ui';
import EvidenceBadge from '../components/EvidenceBadge';
import { useAppContext } from '../context/AppContext';
import { useThemeMode } from '../context/ThemeModeContext';
import { getCurrentConcentration } from '../utils/serumModel';
import type { EvidenceTier } from '../types';

interface AlertItem {
  compoundName: string;
  color: string;
  type: 'warning' | 'info' | 'error';
  title: string;
  message: string;
  evidenceTier: EvidenceTier;
}

export default function AlertsScreen() {
  const { userCompounds, doseLogs, resolveCompound } = useAppContext();
  const { colors } = useThemeMode();

  const activeCompounds = userCompounds.filter(uc => uc.active);

  // Generates alerts based on active compounds and their safety data
  const alerts: AlertItem[] = activeCompounds.flatMap(uc => {
    const compound = resolveCompound(uc.compoundId);
    if (!compound) return [];

    const compoundDoses = doseLogs.filter(d => d.compoundId === uc.compoundId);
    const currentLevel = compoundDoses.length > 0
      ? getCurrentConcentration(compoundDoses, compound)
      : 0;

    const result: AlertItem[] = [];

    if (compound.safety.boxedWarning) {
      result.push({
        compoundName: compound.genericName,
        color: uc.color,
        type: 'error',
        title: 'Boxed Warning',
        message: compound.safety.boxedWarning,
        evidenceTier: compound.evidenceTier,
      });
    }

    if (compound.safety.hydrationWarning && currentLevel > 0) {
      result.push({
        compoundName: compound.genericName,
        color: uc.color,
        type: 'warning',
        title: 'Hydration Advisory',
        message: compound.safety.hydrationWarning,
        evidenceTier: compound.evidenceTier,
      });
    }

    compound.safety.majorWarnings.forEach(warning => {
      result.push({
        compoundName: compound.genericName,
        color: uc.color,
        type: 'warning',
        title: 'Major Warning',
        message: warning,
        evidenceTier: compound.evidenceTier,
      });
    });

    compound.safety.interactionNotes.forEach(note => {
      result.push({
        compoundName: compound.genericName,
        color: uc.color,
        type: 'info',
        title: 'Interaction Note',
        message: note,
        evidenceTier: compound.evidenceTier,
      });
    });

    compound.safety.foodEffectNotes.forEach(note => {
      result.push({
        compoundName: compound.genericName,
        color: uc.color,
        type: 'info',
        title: 'Food/Timing Note',
        message: note,
        evidenceTier: compound.evidenceTier,
      });
    });

    if (compound.safety.labMonitoringNotes.length > 0) {
      result.push({
        compoundName: compound.genericName,
        color: uc.color,
        type: 'info',
        title: 'Recommended Lab Monitoring',
        message: compound.safety.labMonitoringNotes.join(', '),
        evidenceTier: compound.evidenceTier,
      });
    }

    if (compound.approvalStatus === 'experimental') {
      result.push({
        compoundName: compound.genericName,
        color: uc.color,
        type: 'warning',
        title: 'Not FDA Approved',
        message: `${compound.genericName} is not FDA-approved. Limited human safety data is available. Consult a healthcare provider before use.`,
        evidenceTier: 'experimental',
      });
    }

    return result;
  });

  const criticalAlerts = alerts.filter(a => a.type === 'error');
  const warningAlerts = alerts.filter(a => a.type === 'warning');
  const infoAlerts = alerts.filter(a => a.type === 'info');

  return (
    <Screen>
      <Text className="text-[13px] text-muted mb-4">
        Safety information for your active compounds. All alerts are source-backed.
      </Text>

      {activeCompounds.length === 0 ? (
        <Banner tone="info">
          Add peptides from the My Peptides tab to see relevant alerts and warnings.
        </Banner>
      ) : null}

      {criticalAlerts.length > 0 ? (
        <AlertGroup
          title="Critical Warnings"
          icon={<MaterialIcons name="warning-amber" size={20} color={colors.error} />}
          titleClass="text-danger"
          alerts={criticalAlerts}
          tone="error"
        />
      ) : null}

      {warningAlerts.length > 0 ? (
        <AlertGroup
          title="Warnings"
          icon={<MaterialIcons name="warning-amber" size={20} color={colors.warning} />}
          titleClass="text-warn"
          alerts={warningAlerts}
          tone="warning"
        />
      ) : null}

      {infoAlerts.length > 0 ? (
        <AlertGroup
          title="Information"
          icon={<MaterialIcons name="info-outline" size={20} color={colors.info} />}
          titleClass="text-teal-text"
          alerts={infoAlerts}
          tone="info"
        />
      ) : null}

      <Card className="p-4 mt-2">
        <Text className="text-[11px] text-muted leading-4">
          This information is for educational purposes only and is not medical advice.
          Always consult a qualified healthcare provider before starting, stopping, or changing any peptide regimen.
          Emergency symptoms should prompt medical care, not app troubleshooting.
        </Text>
      </Card>
    </Screen>
  );
}

function AlertGroup({ title, icon, titleClass, alerts, tone }: {
  title: string;
  icon: React.ReactNode;
  titleClass: string;
  alerts: AlertItem[];
  tone: 'error' | 'warning' | 'info';
}) {
  const boxClass = {
    error: 'bg-danger-tint',
    warning: 'bg-warn-tint',
    info: 'bg-primary-tint',
  }[tone];
  const textClass = {
    error: 'text-danger',
    warning: 'text-warn',
    info: 'text-teal-text',
  }[tone];

  return (
    <View className="mb-5">
      <View className="flex-row items-center gap-2 mb-2">
        {icon}
        <Text className={`text-base font-semibold ${titleClass}`}>{title}</Text>
      </View>
      <View className="gap-2">
        {alerts.map((alert, i) => (
          <View key={i} className={`rounded-md px-3 py-2.5 ${boxClass}`}>
            <View className="flex-row items-center gap-1.5 flex-wrap mb-1">
              <Text className={`text-[13px] font-semibold ${textClass}`}>{alert.title}</Text>
              <View className="rounded-full border px-1.5 py-px" style={{ borderColor: alert.color }}>
                <Text className="text-[10px]" style={{ color: alert.color }}>{alert.compoundName}</Text>
              </View>
              <EvidenceBadge tier={alert.evidenceTier} />
            </View>
            <Text className="text-[13px] leading-5 text-ink">{alert.message}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
