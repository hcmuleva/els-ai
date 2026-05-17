import { Redirect } from 'expo-router';
import { Text } from 'react-native';

import { ScreenTemplate } from '../../src/components/ScreenTemplate';
import { useAuth } from '../../src/context/AuthContext';

export default function HomeScreen() {
  const { user } = useAuth();

  if (user.activeRole === 'teacher') {
    return <Redirect href="/(tabs)/planner" />;
  }

  return (
    <ScreenTemplate title="Home">
      <Text>Role-aware home dashboard.</Text>
    </ScreenTemplate>
  );
}
