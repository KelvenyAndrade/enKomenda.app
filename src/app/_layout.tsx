import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '../session/SessionContext';
import { cores } from '../theme';

function Navegacao() {
  const { carregando } = useSession();

  // Aguarda restaurar a sessao salva antes de decidir a rota.
  if (carregando) {
    return (
      <View style={styles.carregando}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen
        name="escolher-vinculo"
        options={{ headerShown: true, title: 'Escolha o condomínio', headerBackVisible: false }}
      />
      <Stack.Screen name="(porteiro)" />
      <Stack.Screen name="(morador)" />
      <Stack.Screen name="(sindico)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Navegacao />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo },
});
