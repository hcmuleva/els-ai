import { ScrollView } from 'react-native';

import { LogicopiccoloFrame } from '../modules/logicopiccolo/LogicopiccoloFrame';

export default function LogicopiccoloScreen() {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}>
      <LogicopiccoloFrame />
    </ScrollView>
  );
}
