import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRecebimento } from '../../recebimento/RecebimentoContext';
import type { ItemFila } from '../../recebimento/tipos';
import { CameraCaptura } from '../../recebimento/ui/CameraCaptura';
import { ListaRecebimento } from '../../recebimento/ui/ListaRecebimento';
import { ResolverUnidadeModal } from '../../recebimento/ui/ResolverUnidadeModal';
import { useSession } from '../../session/SessionContext';
import { cores } from '../../theme';

/** Intervalo do polling de GET /encomendas/recentes enquanto houver pendente. */
const POLLING_MS = 3_000;

/** Recebimento: camera em captura continua em cima, lista das etiquetas do turno embaixo. */
export default function Receber() {
  const { sessao, sair, iniciarTrocaDeVinculo } = useSession();
  const { itens, naoEnviados, pendentes, online, registrarFoto, descartar, resolverUnidade, atualizarRecentes } =
    useRecebimento();
  const focada = useIsFocused();
  const [appAtivo, setAppAtivo] = useState(AppState.currentState === 'active');
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => setAppAtivo(estado === 'active'));
    return () => assinatura.remove();
  }, []);

  const visivel = focada && appAtivo;

  // Enquanto houver pendente e a tela estiver visivel, a IA do servidor pode resolver: consulta a cada 3 s.
  const consultando = useRef(false);
  useEffect(() => {
    if (!visivel || pendentes === 0) return;
    const timer = setInterval(() => {
      if (consultando.current) return;
      consultando.current = true;
      atualizarRecentes()
        .catch(() => {
          // Offline/erro: tenta no proximo ciclo.
        })
        .finally(() => {
          consultando.current = false;
        });
    }, POLLING_MS);
    return () => clearInterval(timer);
  }, [visivel, pendentes, atualizarRecentes]);

  const itemAberto = aberto ? (itens.find((i) => i.uuid === aberto) ?? null) : null;

  const abrir = useCallback((item: ItemFila) => setAberto(item.uuid), []);
  const fechar = useCallback(() => setAberto(null), []);

  const confirmarDescarte = useCallback(
    (item: ItemFila) => {
      Alert.alert('Descartar etiqueta?', item.ultimo_erro ?? 'A foto será apagada do aparelho.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => descartar(item.uuid) },
      ]);
    },
    [descartar],
  );

  const confirmarSaida = useCallback(() => {
    if (naoEnviados === 0) {
      void sair();
      return;
    }
    Alert.alert(
      'Há etiquetas não enviadas',
      `${naoEnviados} etiqueta(s) ainda não chegaram ao servidor. Elas ficam guardadas no aparelho e serão enviadas quando você entrar de novo neste condomínio.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair mesmo assim', style: 'destructive', onPress: () => void sair() },
      ],
    );
  }, [naoEnviados, sair]);

  const resumo = [
    naoEnviados > 0 ? `${naoEnviados} a enviar` : null,
    pendentes > 0 ? `${pendentes} pendente(s)` : null,
    !online ? 'offline' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.tela} edges={['top']}>
      <View style={styles.barra}>
        <View style={styles.barraTextos}>
          <Text style={styles.condominio} numberOfLines={1}>
            {sessao?.contexto.condominio_nome ?? ''}
          </Text>
          <Text style={[styles.resumo, !online && styles.offline]} numberOfLines={1}>
            {resumo || 'Tudo enviado'}
          </Text>
        </View>
        {sessao && sessao.vinculos.length > 1 ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void iniciarTrocaDeVinculo()}>
            <Text style={styles.acao}>Trocar</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" hitSlop={8} onPress={confirmarSaida}>
          <Text style={styles.acao}>Sair</Text>
        </Pressable>
      </View>

      <View style={styles.camera}>
        <CameraCaptura ativo={visivel && !itemAberto} onFoto={registrarFoto} />
      </View>

      <View style={styles.lista}>
        <ListaRecebimento itens={itens} online={online} onAbrir={abrir} onDescartar={confirmarDescarte} />
      </View>

      <ResolverUnidadeModal item={itemAberto} onFechar={fechar} onResolver={resolverUnidade} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: cores.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  barraTextos: { flex: 1 },
  condominio: { fontSize: 15, fontWeight: '700', color: cores.texto },
  resumo: { fontSize: 12, color: cores.textoSecundario },
  offline: { color: cores.erro },
  acao: { fontSize: 15, fontWeight: '600', color: cores.primaria },
  camera: { flex: 11 },
  lista: { flex: 9, backgroundColor: cores.superficie },
});
