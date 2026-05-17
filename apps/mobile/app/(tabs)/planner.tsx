import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PlannerScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Classroom Planner</Text>
      <Text style={styles.subtitle}>Plan lessons, track readiness, and monitor completion.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>This Week Plan</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Math - Fractions</Text>
          <Text style={styles.badge}>Mon 09:00</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Science - Matter</Text>
          <Text style={styles.badge}>Wed 10:30</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>English - Reading Drill</Text>
          <Text style={styles.badge}>Fri 11:15</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Planning Metrics</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>18</Text>
            <Text style={styles.metricLabel}>Lessons</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>92%</Text>
            <Text style={styles.metricLabel}>Coverage</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>6</Text>
            <Text style={styles.metricLabel}>Pending</Text>
          </View>
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
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  badge: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
  },
});
