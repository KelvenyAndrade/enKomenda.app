import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { retirarManual, retirarPorCodigo, retirarPorQR } from '../../api/encomendas';
import { useRecebimento } from '../../recebimento/RecebimentoContext';
import { fotoRetiradaBase64 } from '../../retirada/foto';
import { FiltroRepeticao, decidirQR, lerPayloadQR } from '../../retirada/qr';
import { MENSAGEM_SEM_CONEXAO, podeDesfazer, textoVolumes } from '../../retirada/regras';
import { useRetirada } from '../../retirada/useRetirada';
import { CardResultado } from '../../retirada/ui/CardResultado';
import { LeitorQR } from '../../retirada/ui/LeitorQR';
import { ModoCodigo } from '../../retirada/ui/ModoCodigo';
import { ModoManual } from '../../retirada/ui/ModoManual';
import { useSession } from '../../session/SessionContext';
import { cores } from '../../theme';

type Modo = 'qr' | 'codigo' | 'manual';

const MODOS: { chave: Modo; titulo: string }[] = [
  { chave: 'qr', titulo: 'QR' },
  { chave: 'codigo', titulo: 'Código' },
  { chave: 'manual', titulo: 'Manual' },
];

/** Tempo do aviso "QR nao e do enKomenda" sobre a camera. */
const AVISO_MS = 2_500;

/** Retirada (baixa): QR do morador (padrao), codigo de 6 digitos ou manual com foto. Sempre online. */
export default function Retirada() {
  const { sessao } = useSession();
  const { online } = useRecebimento();
  const retirada = useRetirada(online);
  const { card, enviando, ultima, executar, recusar, repetir, desfazer, fechar, reabrirUltima } = retirada;

  const [modo, setModo] = useState<Modo>('qr');
  /** Muda em "Nova retirada": remonta os modos (limpa codigo, unidade e foto). */
  const [rodada, setRodada] = useState(0);
  /** Muda a cada card fechado: a lista manual recarrega. */
  const [versao, setVersao] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const timerAviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtro = useRef(new FiltroRepeticao()).current;

  const focada = useIsFocused();
  const [appAtivo, setAppAtivo] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => setAppAtivo(estado === 'active'));
    return () => assinatura.remove();
  }, []);
  useEffect(() => () => {
    if (timerAviso.current) clearTimeout(timerAviso.current);
  }, []);

  const visivel = focada && appAtivo;
  const condominioId = sessao?.contexto.condominio_id;

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    if (timerAviso.current) clearTimeout(timerAviso.current);
    timerAviso.current = setTimeout(() => setAviso(null), AVISO_MS);
  }, []);

  // Caminho critico (meta: QR na camera -> resultado em ate 3 s): sem telas nem esperas no meio.
  const aoLerQR = useCallback(
    (valor: string) => {
      if (!filtro.aceitar(valor)) return;
      const decisao = decidirQR(lerPayloadQR(valor), condominioId);
      if (decisao.acao === 'avisar') {
        mostrarAviso(decisao.mensagem);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (decisao.acao === 'recusar') {
        recusar('QR', decisao.mensagem);
      } else {
        setAviso(null);
        void executar('QR', () => retirarPorQR(decisao.qr));
      }
    },
    [filtro, condominioId, mostrarAviso, recusar, executar],
  );

  const enviarCodigo = useCallback((codigo: string) => executar('CODIGO', () => retirarPorCodigo(codigo)), [executar]);

  const confirmarManual = useCallback(
    (ids: number[], fotoCaminho: string) =>
      executar('MANUAL', async () => {
        let foto: string;
        try {
          foto = await fotoRetiradaBase64(fotoCaminho);
        } catch {
          throw new Error('Não foi possível preparar a foto. Fotografe de novo.');
        }
        return retirarManual({ encomenda_ids: ids, foto_base64: foto });
      }),
    [executar],
  );

  const fecharCard = useCallback(() => {
    // O QR ainda pode estar na frente da camera: so aceita de novo depois de 5 s sem ve-lo.
    filtro.renovar();
    setVersao((v) => v + 1);
    fechar();
  }, [filtro, fechar]);

  const novaRetirada = useCallback(() => {
    setRodada((r) => r + 1);
    fecharCard();
  }, [fecharCard]);

  const repetirChamada = useCallback(() => {
    filtro.limpar();
    void repetir();
  }, [filtro, repetir]);

  const mostrarUltima =
    !card &&
    ultima !== null &&
    ultima.ids.length > 0 &&
    ultima.desfazer.fase !== 'desfeita' &&
    podeDesfazer(ultima.instante);

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.seletor} accessibilityRole="tablist">
        {MODOS.map((m) => {
          const ativo = modo === m.chave;
          return (
            <Pressable
              key={m.chave}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo, disabled: !!enviando }}
              disabled={!!enviando}
              onPress={() => setModo(m.chave)}
              style={[styles.opcao, ativo && styles.opcaoAtiva]}
            >
              <Text style={[styles.opcaoTexto, ativo && styles.opcaoTextoAtivo]}>{m.titulo}</Text>
            </Pressable>
          );
        })}
      </View>

      {!online ? (
        <View style={styles.offline}>
          <Text style={styles.offlineTexto}>{MENSAGEM_SEM_CONEXAO}</Text>
        </View>
      ) : null}

      {mostrarUltima && ultima ? (
        <Pressable accessibilityRole="button" onPress={reabrirUltima} style={styles.ultima}>
          <Text style={styles.ultimaTexto} numberOfLines={1}>
            Última: {ultima.resumo.unidades.join(' · ') || 'unidade'} · {textoVolumes(ultima.ids.length)}
          </Text>
          <Text style={styles.ultimaAcao}>Ver / desfazer</Text>
        </Pressable>
      ) : null}

      <View style={styles.conteudo}>
        {modo === 'qr' ? (
          <LeitorQR
            ativo={visivel && !card}
            onLeitura={aoLerQR}
            aviso={aviso}
            enviando={enviando === 'QR'}
          />
        ) : modo === 'codigo' ? (
          <ModoCodigo key={`codigo-${rodada}`} onEnviar={enviarCodigo} ocupado={!!enviando} />
        ) : (
          <ModoManual
            key={`manual-${rodada}`}
            visivel={visivel && !card}
            ocupado={!!enviando}
            versao={versao}
            onConfirmar={confirmarManual}
          />
        )}
      </View>

      {card ? (
        <CardResultado
          card={card}
          onNova={novaRetirada}
          onFechar={fecharCard}
          onRepetir={repetirChamada}
          onDesfazer={() => void desfazer()}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  seletor: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: cores.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  opcao: {
    flex: 1,
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcaoAtiva: { backgroundColor: cores.primaria },
  opcaoTexto: { fontSize: 18, fontWeight: '700', color: cores.primaria },
  opcaoTextoAtivo: { color: '#fff' },
  offline: { padding: 10, backgroundColor: cores.erroFundo },
  offlineTexto: { color: cores.erro, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  ultima: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: cores.sucessoFundo,
  },
  ultimaTexto: { flex: 1, fontSize: 15, color: cores.sucesso, fontWeight: '600' },
  ultimaAcao: { fontSize: 15, color: cores.primaria, fontWeight: '700' },
  conteudo: { flex: 1 },
});
