import { Stack } from 'expo-router';

import { GuardaPerfil } from '../../components/GuardaPerfil';

export default function SindicoLayout() {
  return (
    <GuardaPerfil perfil="SINDICO">
      <Stack>
        <Stack.Screen name="resumo" options={{ title: 'Resumo' }} />
      </Stack>
    </GuardaPerfil>
  );
}
