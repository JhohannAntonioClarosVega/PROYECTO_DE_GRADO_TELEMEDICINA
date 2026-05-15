import { StyleSheet, View } from 'react-native';
import TriageMonitor from '@/components/TriageMonitor';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <TriageMonitor />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6', // Match the monitor's background
  },
});
