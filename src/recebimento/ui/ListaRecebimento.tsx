import { memo } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { cores } from '../../theme';
import { estaPendente } from '../fila';
import type { ItemFila } from '../tipos';

const COR_ALERTA = '#B26A00';
const FUNDO_ALERTA = '#FFF4E0';
const COR_OK = '#1E7D32';

interface Props {
  itens: ItemFila[];
  online: boolean;
  /** Toque num item enviado (pendente: informar unidade; identificado: corrigir). */
  onAbrir: (item: ItemFila) => void;
  onDescartar: (item: ItemFila) => void;
}

/** Lista compacta das etiquetas do turno, sob a camera. */
export function ListaRecebimento({ itens, online, onAbrir, onDescartar }: Props) {
  return (
    <FlatList
      data={itens}
      keyExtractor={(i) => i.uuid}
      renderItem={({ item }) => <Linha item={item} online={online} onAbrir={onAbrir} onDescartar={onDescartar} />}
      ItemSeparatorComponent={Separador}
      ListEmptyComponent={
        <Text style={styles.vazio}>As etiquetas fotografadas aparecem aqui. Aponte a câmera e toque no botão.</Text>
      }
      contentContainerStyle={itens.length === 0 ? styles.listaVazia : undefined}
      keyboardShouldPersistTaps="handled"
    />
  );
}

function Separador() {
  return <View style={styles.separador} />;
}

function hora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Situacao {
  titulo: string;
  detalhe?: string | null;
  cor: string;
  fundo?: string;
  ocupado?: boolean;
}

function situacao(item: ItemFila, online: boolean): Situacao {
  switch (item.estado) {
    case 'processando':
      return { titulo: 'Lendo etiqueta…', cor: cores.textoSecundario, ocupado: true };
    case 'enviando':
      return { titulo: 'Enviando…', cor: cores.primaria, ocupado: true };
    case 'na_fila':
      if (!online) return { titulo: 'Na fila (offline)', cor: cores.textoSecundario };
      return item.ultimo_erro
        ? { titulo: 'Na fila — tentando de novo', detalhe: item.ultimo_erro, cor: cores.textoSecundario }
        : { titulo: 'Na fila', cor: cores.textoSecundario };
    case 'erro':
      return { titulo: 'Erro no envio', detalhe: item.ultimo_erro, cor: cores.erro, fundo: cores.erroFundo };
    case 'enviado': {
      const e = item.resposta;
      if (!e || estaPendente(item)) {
        return {
          titulo: 'Pendente — toque para informar a unidade',
          detalhe: e?.nome_destinatario ?? e?.transportadora ?? null,
          cor: COR_ALERTA,
          fundo: FUNDO_ALERTA,
        };
      }
      if (e.status === 'CANCELADA') return { titulo: 'Cancelada', cor: cores.textoSecundario };
      const unidade = [e.unidade_descricao, e.transportadora].filter(Boolean).join(' · ');
      return {
        titulo: unidade || 'Identificada',
        detalhe: e.status === 'RETIRADA' ? 'Retirada' : e.nome_destinatario,
        cor: COR_OK,
      };
    }
  }
}

const Linha = memo(function Linha({
  item,
  online,
  onAbrir,
  onDescartar,
}: {
  item: ItemFila;
  online: boolean;
  onAbrir: (item: ItemFila) => void;
  onDescartar: (item: ItemFila) => void;
}) {
  const s = situacao(item, online);
  const tocavel = item.estado === 'enviado' && !!item.resposta && item.resposta.status !== 'RETIRADA' && item.resposta.status !== 'CANCELADA';
  const miniatura = item.miniatura ?? (item.estado === 'processando' ? null : item.arquivo);

  return (
    <Pressable
      disabled={!tocavel}
      onPress={() => onAbrir(item)}
      accessibilityRole={tocavel ? 'button' : undefined}
      style={({ pressed }) => [styles.linha, s.fundo ? { backgroundColor: s.fundo } : null, pressed && styles.pressionada]}
    >
      {miniatura ? (
        <Image source={{ uri: miniatura }} style={styles.miniatura} />
      ) : (
        <View style={[styles.miniatura, styles.semMiniatura]} />
      )}
      <View style={styles.textos}>
        <Text style={[styles.titulo, { color: s.cor }]} numberOfLines={1}>
          {s.titulo}
        </Text>
        {s.detalhe ? (
          <Text style={styles.detalhe} numberOfLines={2}>
            {s.detalhe}
          </Text>
        ) : null}
      </View>
      {s.ocupado ? <ActivityIndicator size="small" color={s.cor} /> : null}
      {item.estado === 'erro' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onDescartar(item)}
          hitSlop={8}
          style={({ pressed }) => [styles.descartar, pressed && styles.pressionada]}
        >
          <Text style={styles.descartarTexto}>Descartar</Text>
        </Pressable>
      ) : (
        <Text style={styles.hora}>{hora(item.criado_em)}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: cores.superficie,
    minHeight: 60,
  },
  pressionada: { opacity: 0.6 },
  miniatura: { width: 44, height: 44, borderRadius: 6, backgroundColor: cores.borda },
  semMiniatura: { opacity: 0.5 },
  textos: { flex: 1, gap: 2 },
  titulo: { fontSize: 15, fontWeight: '600' },
  detalhe: { fontSize: 13, color: cores.textoSecundario },
  hora: { fontSize: 12, color: cores.textoSecundario },
  descartar: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: cores.erro,
  },
  descartarTexto: { color: cores.erro, fontSize: 13, fontWeight: '600' },
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: cores.borda },
  vazio: { color: cores.textoSecundario, fontSize: 14, textAlign: 'center', padding: 20 },
  listaVazia: { flexGrow: 1, justifyContent: 'center' },
});
