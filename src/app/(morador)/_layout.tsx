import { Stack } from 'expo-router';

import { GuardaPerfil } from '../../components/GuardaPerfil';

export default function MoradorLayout() {
  return (
    <GuardaPerfil perfil="MORADOR">
      <Stack>
        <Stack.Screen name="encomendas" options={{ title: 'Minhas encomendas' }} />
      </Stack>
    </GuardaPerfil>
  );
}
