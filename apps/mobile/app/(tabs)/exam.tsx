import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ExamSetupScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Exam & Question Setup</Text>
      <Text style={styles.subtitle}>Create exams and manage question quality by difficulty.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming Exams</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Unit Test - Grade 7</Text>
          <Text style={styles.badge}>24 May</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Midterm - Grade 8</Text>
          <Text style={styles.badge}>02 Jun</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Question Bank Mix</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Easy</Text>
          <Text style={styles.value}>35%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Medium</Text>
          <Text style={styles.value}>45%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Hard</Text>
          <Text style={styles.value}>20%</Text>
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
  badge: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
});
