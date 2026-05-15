import TriageEvaluation from '@/components/TriageEvaluation';
import { router, useLocalSearchParams } from 'expo-router';

export default function EvaluationScreen() {
  const { data } = useLocalSearchParams();
  const parsedData = data && typeof data === 'string' ? JSON.parse(data) : null;

  return <TriageEvaluation onBack={() => router.back()} triage={parsedData} />;
}
