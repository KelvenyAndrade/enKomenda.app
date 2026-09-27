import { Tabs } from 'expo-router/js-tabs';

import { GuardaPerfil } from '../../components/GuardaPerfil';
import { cores } from '../../theme';

/** Area do porteiro: abas Receber e Retirada. */
export default function PorteiroLayout() {
  return (
    <GuardaPerfil perfil="PORTEIRO">
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: cores.primaria,
          tabBarInactiveTintColor: cores.textoSecundario,
          tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
          // Sem biblioteca de icones nesta fase: abas so com texto.
          tabBarIconStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="receber" options={{ title: 'Receber' }} />
        <Tabs.Screen name="retirada" options={{ title: 'Retirada' }} />
      </Tabs>
    </GuardaPerfil>
  );
}
