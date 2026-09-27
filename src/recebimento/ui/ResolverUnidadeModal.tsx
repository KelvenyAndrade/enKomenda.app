import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mensagemDeErro } from '../../api/client';
import { buscarUnidades, obterEncomenda } from '../../api/encomendas';
import type { UnidadeBusca } from '../../api/types';
import { cores } from '../../theme';
import { arquivoExiste } from '../armazenamento';
import type { ItemFila } from '../tipos';

const DEBOUNCE_MS = 250;

interface Props {
  /** Item aberto (null = folha fechada). */
  item: ItemFila | null;
  onFechar: () => void;
  onResolver: (uuid: string, unidadeId: number, nomeDestinatario?: string) => Promise<void>;
}

/**
 * Resolucao manual em 2 toques: a folha abre ja com sugestoes de unidade; tocar numa unidade
 * grava (PATCH /encomendas/{id}/unidade) e fecha.
 */
export function ResolverUnidadeModal({ item, onFechar, onResolver }: Props) {
  return (
    <Modal
      visible={!!item}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onFechar}
    >
      {item ? <Conteudo key={item.uuid} item={item} onFechar={onFechar} onResolver={onResolver} /> : null}
    </Modal>
  );
}

function Conteudo({ item, onFechar, onResolver }: { item: ItemFila } & Omit<Props, 'item'>) {
  const encomenda = item.resposta;
  const pendente = encomenda?.status === 'PENDENTE_IDENT';

  const [q, setQ] = useState('');
  const [nome, setNome] = useState(encomenda?.nome_destinatario ?? '');
  const [unidades, setUnidades] = useState<UnidadeBusca[]>([]);
  const [buscando, setBuscando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [foto, setFoto] = useState<string | null>(() => (arquivoExiste(item.arquivo) ? item.arquivo : null));
  const sequencia = useRef(0);

  // Sem a foto local (ja apagada): busca a URL assinada no servidor.
  useEffect(() => {
    if (foto || !encomenda) return;
    let ativo = true;
    obterEncomenda(encomenda.id)
      .then((d) => {
        if (ativo && d.foto_url) setFoto(d.foto_url);
      })
      .catch(() => {
        // Sem foto: fica a miniatura.
      });
    return () => {
      ativo = false;
    };
    // So ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autocomplete com debounce; q vazio ja traz sugestoes ao abrir.
  useEffect(() => {
    const minha = ++sequencia.current;
    setBuscando(true);
    const timer = setTimeout(
      () => {
        buscarUnidades(q)
          .then((r) => {
            if (minha !== sequencia.current) return;
            setUnidades(r);
            setErro(null);
          })
          .catch((e) => {
            if (minha === sequencia.current) setErro(mensagemDeErro(e));
          })
          .finally(() => {
            if (minha === sequencia.current) setBuscando(false);
          });
      },
      q ? DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [q]);

  async function escolher(u: UnidadeBusca) {
    if (salvando !== null) return;
    setSalvando(u.id);
    setErro(null);
    try {
      await onResolver(item.uuid, u.id, nome);
      onFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(null);
    }
  }

  const imagem = foto ?? item.miniatura;
  const subtitulo = [encomenda?.transportadora, encomenda?.rastreio].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.cabecalho}>
          <View style={styles.cabecalhoTextos}>
            <Text style={styles.titulo}>{pendente ? 'Informe a unidade' : 'Corrigir unidade'}</Text>
            {!pendente && encomenda?.unidade_descricao ? (
              <Text style={styles.subtitulo}>Atual: {encomenda.unidade_descricao}</Text>
            ) : subtitulo ? (
              <Text style={styles.subtitulo}>{subtitulo}</Text>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" onPress={onFechar} hitSlop={12}>
            <Text style={styles.fechar}>Fechar</Text>
          </Pressable>
        </View>

        <View style={styles.foto}>
          {imagem ? (
            <Image source={{ uri: imagem }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </View>

        <View style={styles.campos}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar unidade (ex.: 101 ou A 101)"
            placeholderTextColor={cores.desabilitado}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="characters"
            returnKeyType="search"
          />
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Destinatário (opcional)"
            placeholderTextColor={cores.desabilitado}
            style={[styles.input, styles.inputNome]}
            autoCorrect={false}
            autoCapitalize="characters"
          />
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
        </View>

        <FlatList
          style={styles.lista}
          data={unidades}
          keyExtractor={(u) => String(u.id)}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separador} />}
          ListEmptyComponent={
            buscando ? (
              <ActivityIndicator style={styles.carregando} color={cores.primaria} />
            ) : (
              <Text style={styles.vazio}>Nenhuma unidade encontrada.</Text>
            )
          }
          renderItem={({ item: u }) => {
            const atual = !pendente && u.id === encomenda?.unidade_id;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={salvando !== null}
                onPress={() => void escolher(u)}
                style={({ pressed }) => [styles.unidade, pressed && styles.unidadePressionada]}
              >
                <Text style={[styles.unidadeTexto, atual && styles.unidadeAtual]}>{u.descricao}</Text>
                {salvando === u.id ? <ActivityIndicator color={cores.primaria} /> : null}
              </Pressable>
            );
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: cores.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  cabecalhoTextos: { flex: 1, gap: 2 },
  titulo: { fontSize: 18, fontWeight: '700', color: cores.texto },
  subtitulo: { fontSize: 13, color: cores.textoSecundario },
  fechar: { fontSize: 16, fontWeight: '600', color: cores.primaria },
  foto: { height: '34%', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  campos: { padding: 12, gap: 8 },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    paddingHorizontal: 14,
    fontSize: 17,
    color: cores.texto,
  },
  inputNome: { minHeight: 40, fontSize: 14 },
  erro: { color: cores.erro, fontSize: 14 },
  lista: { flex: 1, backgroundColor: cores.superficie },
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: cores.borda },
  unidade: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unidadePressionada: { backgroundColor: '#E8EFFA' },
  unidadeTexto: { fontSize: 18, fontWeight: '600', color: cores.texto },
  unidadeAtual: { color: cores.primaria },
  carregando: { marginTop: 24 },
  vazio: { textAlign: 'center', color: cores.textoSecundario, padding: 20 },
});
