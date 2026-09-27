import { Tabs } from 'expo-router/js-tabs';

import { GuardaPerfil } from '../../components/GuardaPerfil';
import { RecebimentoProvider } from '../../recebimento/RecebimentoContext';
import { cores } from '../../theme';

/** Area do porteiro: abas Receber e Retirada. A fila de recebimento envia em segundo plano em qualquer aba. */
export default function PorteiroLayout() {
  return (
    <GuardaPerfil perfil="PORTEIRO">
      <RecebimentoProvider>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: cores.primaria,
            tabBarInactiveTintColor: cores.textoSecundario,
            tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
            // Sem biblioteca de icones nesta fase: abas so com texto.
            tabBarIconStyle: { display: 'none' },
          }}
        >
          {/* Camera em tela cheia: a barra com condominio/Sair fica dentro da tela. */}
          <Tabs.Screen name="receber" options={{ title: 'Receber', headerShown: false }} />
          <Tabs.Screen name="retirada" options={{ title: 'Retirada' }} />
        </Tabs>
      </RecebimentoProvider>
    </GuardaPerfil>
  );
}
