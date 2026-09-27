import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao } from '../../components/Botao';
import { cores } from '../../theme';
import { minutosParaDesfazer, podeDesfazer, textoVolumes } from '../regras';
import type { Card } from '../useRetirada';

interface Props {
  card: Card;
  onNova: () => void;
  onFechar: () => void;
  onRepetir: () => void;
  onDesfazer: () => void;
}

const NOME_METODO = { QR: 'QR', CODIGO: 'código', MANUAL: 'retirada manual' } as const;

/** Resultado da baixa em letras grandes (legivel a distancia pelo morador). */
export function CardResultado({ card, onNova, onFechar, onRepetir, onDesfazer }: Props) {
  if (card.tipo === 'erro') {
    const f = card.dados;
    return (
      <View style={[styles.card, styles.cardErro]}>
        <Text style={[styles.titulo, styles.tituloErro]}>Retirada não registrada</Text>
        <Text style={styles.mensagemErro}>{f.mensagem}</Text>
        <View style={styles.botoes}>
          {f.podeRepetir ? <Botao titulo="Tentar de novo" onPress={onRepetir} /> : null}
          <Botao titulo="Fechar" variante={f.podeRepetir ? 'secundario' : 'primario'} onPress={onFechar} />
        </View>
      </View>
    );
  }

  const s = card.dados;
  const { resumo } = s;
  const desfeita = s.desfazer.fase === 'desfeita';
  return (
    <View style={[styles.card, desfeita ? styles.cardNeutro : styles.cardSucesso]}>
      <ScrollView contentContainerStyle={styles.conteudo}>
        <Text style={[styles.titulo, desfeita ? styles.tituloNeutro : styles.tituloSucesso]}>
          {desfeita ? 'Retirada desfeita' : 'Retirada registrada'}
        </Text>
        <Text style={styles.unidade} numberOfLines={2} adjustsFontSizeToFit>
          {resumo.unidades.join(' · ') || 'Unidade'}
        </Text>
        <Text style={styles.volumes}>
          {textoVolumes(resumo.volumes)} · {NOME_METODO[s.metodo]}
        </Text>
        {desfeita ? (
          <Text style={styles.textoDesfeita}>As encomendas voltaram para “aguardando retirada”.</Text>
        ) : null}

        <View style={styles.itens}>
          {resumo.itens.map((i) => (
            <View key={i.id} style={styles.item}>
              <Text style={styles.itemTransportadora}>{i.transportadora}</Text>
              <Text style={styles.itemDestinatario}>{i.destinatario}</Text>
            </View>
          ))}
        </View>

        {resumo.naoEncontrados.length > 0 ? (
          <View style={styles.aviso}>
            <Text style={styles.avisoTitulo}>Não encontrados: {resumo.naoEncontrados.join(', ')}</Text>
            <Text style={styles.avisoTexto}>Já retirados, inválidos ou de outra unidade.</Text>
          </View>
        ) : null}

        {s.desfazer.fase === 'falhou' ? <Text style={styles.erroDesfazer}>{s.desfazer.mensagem}</Text> : null}
      </ScrollView>

      <View style={styles.botoes}>
        <Botao titulo="Nova retirada" onPress={onNova} />
        {!desfeita ? (
          <BotaoDesfazer
            instante={s.instante}
            desfazendo={s.desfazer.fase === 'desfazendo'}
            disponivel={s.ids.length > 0}
            onDesfazer={onDesfazer}
          />
        ) : null}
      </View>
    </View>
  );
}

/** "Desfazer" some sozinho quando o prazo de 15 min acaba. */
function BotaoDesfazer({
  instante,
  desfazendo,
  disponivel,
  onDesfazer,
}: {
  instante: number;
  desfazendo: boolean;
  disponivel: boolean;
  onDesfazer: () => void;
}) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  if (!disponivel || !podeDesfazer(instante, agora)) return null;
  const minutos = minutosParaDesfazer(instante, agora);
  return (
    <Botao
      titulo={`Desfazer (${minutos} min)`}
      variante="secundario"
      carregando={desfazendo}
      onPress={() =>
        Alert.alert('Desfazer retirada?', 'As encomendas voltam para "aguardando retirada".', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Desfazer', style: 'destructive', onPress: onDesfazer },
        ])
      }
    />
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    gap: 16,
    borderTopWidth: 10,
    backgroundColor: cores.superficie,
  },
  cardSucesso: { borderTopColor: cores.sucesso },
  cardErro: { borderTopColor: cores.erro, backgroundColor: cores.erroFundo, justifyContent: 'center' },
  cardNeutro: { borderTopColor: cores.textoSecundario },
  conteudo: { gap: 12, paddingBottom: 8 },
  titulo: { fontSize: 24, fontWeight: '800' },
  tituloSucesso: { color: cores.sucesso },
  tituloErro: { color: cores.erro, textAlign: 'center' },
  tituloNeutro: { color: cores.textoSecundario },
  mensagemErro: { fontSize: 24, fontWeight: '600', color: cores.erro, textAlign: 'center' },
  unidade: { fontSize: 44, fontWeight: '800', color: cores.texto },
  volumes: { fontSize: 22, fontWeight: '600', color: cores.texto },
  textoDesfeita: { fontSize: 16, color: cores.textoSecundario },
  itens: { gap: 10 },
  item: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: cores.fundo,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  itemTransportadora: { fontSize: 20, fontWeight: '700', color: cores.texto },
  itemDestinatario: { fontSize: 17, color: cores.textoSecundario },
  aviso: { padding: 12, borderRadius: 10, backgroundColor: cores.avisoFundo, gap: 2 },
  avisoTitulo: { fontSize: 18, fontWeight: '700', color: cores.aviso },
  avisoTexto: { fontSize: 15, color: cores.aviso },
  erroDesfazer: { fontSize: 16, fontWeight: '600', color: cores.erro },
  botoes: { gap: 10 },
});
