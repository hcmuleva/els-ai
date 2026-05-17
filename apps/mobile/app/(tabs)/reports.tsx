import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ReportsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Teacher Reports</Text>
      <Text style={styles.subtitle}>Class performance and topic-level insights.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Class Performance</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Grade 7-A</Text>
          <Text style={styles.value}>84% avg</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Grade 7-B</Text>
          <Text style={styles.value}>79% avg</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Grade 8-A</Text>
          <Text style={styles.value}>88% avg</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Topic Insights</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Fractions</Text>
          <Text style={styles.warn}>Needs review</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Grammar - Tenses</Text>
          <Text style={styles.good}>Strong</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Matter & Materials</Text>
          <Text style={styles.warn}>Needs review</Text>
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
  value: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  good: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  warn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
});
