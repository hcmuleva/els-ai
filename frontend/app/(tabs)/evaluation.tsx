import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ContentEvaluationScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Content Evaluation (AI vs Manual)</Text>
      <Text style={styles.subtitle}>Review AI-generated items against manual quality checks.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Evaluation Summary</Text>
        <View style={styles.row}>
          <Text style={styles.label}>AI Accepted</Text>
          <Text style={styles.aiValue}>74%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Manual Rework</Text>
          <Text style={styles.manualValue}>26%</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Reviews</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Algebra worksheet set</Text>
          <Text style={styles.statusPass}>AI Pass</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Comprehension quiz</Text>
          <Text style={styles.statusWarn}>Manual Edit</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Science lab prompts</Text>
          <Text style={styles.statusPass}>AI Pass</Text>
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
    fontWeight: '600',
    color: '#1e293b',
  },
  aiValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  manualValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
  statusPass: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  statusWarn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
});
