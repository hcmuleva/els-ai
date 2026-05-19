import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AssessmentDashboardScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Student Assessment Dashboard</Text>
      <Text style={styles.subtitle}>Track performance, submissions, and intervention needs.</Text>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>87%</Text>
          <Text style={styles.metricLabel}>Avg Score</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>42</Text>
          <Text style={styles.metricLabel}>Submissions</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>5</Text>
          <Text style={styles.metricLabel}>At Risk</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Gaps</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Fractions</Text>
          <Text style={styles.value}>31% incorrect</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Reading Inference</Text>
          <Text style={styles.value}>26% incorrect</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Chemical Changes</Text>
          <Text style={styles.value}>22% incorrect</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  value: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '700',
  },
});
