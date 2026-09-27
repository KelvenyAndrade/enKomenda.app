import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mensagemDeErro } from '../../api/client';
import { buscarUnidades, listarAguardando } from '../../api/encomendas';
import type { Encomenda, UnidadeBusca } from '../../api/types';
import { Botao } from '../../components/Botao';
import { paraUri } from '../../recebimento/armazenamento';
import { CameraCaptura } from '../../recebimento/ui/CameraCaptura';
import { cores } from '../../theme';
import { descartarFoto } from '../foto';
import { MAXIMO_MANUAL, formatarChegada, reconciliarSelecao } from '../regras';

const DEBOUNCE_MS = 250;

interface Props {
  /** false quando a aba/tela nao esta visivel (pausa a camera da foto). */
  visivel: boolean;
  ocupado: boolean;
  /** Muda a cada card fechado: recarrega a lista da unidade (ex.: depois de um 409). */
  versao: number;
  /** Faz a baixa. Retorna false se ja havia outra em andamento. */
  onConfirmar: (ids: number[], fotoCaminho: string) => Promise<boolean>;
}

/** Retirada sem codigo: unidade -> encomendas aguardando (todas marcadas) -> foto de quem retira -> confirmar. */
export function ModoManual({ visivel, ocupado, versao, onConfirmar }: Props) {
  const [unidade, setUnidade] = useState<UnidadeBusca | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [cameraAberta, setCameraAberta] = useState(false);
  const fotoRef = useRef<string | null>(null);

  // A foto e so um comprovante temporario: apaga ao trocar, ao sair do modo e depois da baixa.
  const trocarFoto = useCallback((nova: string | null) => {
    if (fotoRef.current && fotoRef.current !== nova) descartarFoto(fotoRef.current);
    fotoRef.current = nova;
    setFoto(nova);
  }, []);
  useEffect(() => () => descartarFoto(fotoRef.current), []);

  const aoFotografar = useCallback(
    (caminho: string) => {
      trocarFoto(caminho);
      setCameraAberta(false);
    },
    [trocarFoto],
  );

  return (
    <View style={styles.tela}>
      {unidade ? (
        <ListaUnidade
          unidade={unidade}
          foto={foto}
          ocupado={ocupado}
          versao={versao}
          onTrocarUnidade={() => {
            setUnidade(null);
            trocarFoto(null);
          }}
          onFotografar={() => setCameraAberta(true)}
          onConfirmar={onConfirmar}
        />
      ) : (
        <BuscaUnidade onEscolher={setUnidade} />
      )}

      <Modal visible={cameraAberta} animationType="slide" onRequestClose={() => setCameraAberta(false)}>
        <SafeAreaView style={styles.camera} edges={['top', 'bottom']}>
          <View style={styles.cameraBarra}>
            <Text style={styles.cameraTitulo}>Fotografe quem retira</Text>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={() => setCameraAberta(false)}>
              <Text style={styles.cameraCancelar}>Cancelar</Text>
            </Pressable>
          </View>
          <View style={styles.cameraArea}>
            <CameraCaptura
              ativo={cameraAberta && visivel}
              onFoto={aoFotografar}
              rotuloDisparo="Fotografar quem retira"
              motivoPermissao="A foto de quem retira fica como comprovante da retirada manual."
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function BuscaUnidade({ onEscolher }: { onEscolher: (u: UnidadeBusca) => void }) {
  const [q, setQ] = useState('');
  const [unidades, setUnidades] = useState<UnidadeBusca[]>([]);
  const [buscando, setBuscando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const sequencia = useRef(0);

  // Autocomplete com debounce; q vazio ja traz sugestoes.
  useEffect(() => {
    const minha = ++sequencia.current;
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

  return (
    <View style={styles.tela}>
      <View style={styles.campos}>
        <TextInput
          value={q}
          onChangeText={(t) => {
            setQ(t);
            setBuscando(true);
          }}
          placeholder="Buscar unidade (ex.: 101 ou A 101)"
          placeholderTextColor={cores.desabilitado}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="characters"
          returnKeyType="search"
        />
        {erro ? <Text style={styles.erro}>{erro}</Text> : null}
      </View>
      <FlatList
        style={styles.lista}
        data={unidades}
        keyExtractor={(u) => String(u.id)}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={Separador}
        ListEmptyComponent={
          buscando ? (
            <ActivityIndicator style={styles.carregando} color={cores.primaria} />
          ) : (
            <Text style={styles.vazio}>Nenhuma unidade encontrada.</Text>
          )
        }
        renderItem={({ item: u }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => onEscolher(u)}
            style={({ pressed }) => [styles.linha, pressed && styles.linhaPressionada]}
          >
            <Text style={styles.unidadeTexto}>{u.descricao}</Text>
            <Text style={styles.seta}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

interface ListaProps {
  unidade: UnidadeBusca;
  foto: string | null;
  ocupado: boolean;
  versao: number;
  onTrocarUnidade: () => void;
  onFotografar: () => void;
  onConfirmar: (ids: number[], fotoCaminho: string) => Promise<boolean>;
}

function ListaUnidade({ unidade, foto, ocupado, versao, onTrocarUnidade, onFotografar, onConfirmar }: ListaProps) {
  const [encomendas, setEncomendas] = useState<Encomenda[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const anteriores = useRef<Encomenda[] | null>(null);

  const carregar = useCallback(() => {
    let ativo = true;
    listarAguardando(unidade.id)
      .then((lista) => {
        if (!ativo) return;
        // Todas marcadas por padrao; numa recarga mantem o que o porteiro desmarcou.
        const antes = anteriores.current;
        setSelecionados((sel) => reconciliarSelecao(antes, sel, lista));
        anteriores.current = lista;
        setEncomendas(lista);
        setErro(null);
      })
      .catch((e) => {
        if (ativo) setErro(mensagemDeErro(e));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [unidade.id]);

  // Recarga silenciosa a cada card fechado (ex.: 409 porque outra portaria ja deu baixa).
  useEffect(() => carregar(), [carregar, versao]);

  const puxarParaAtualizar = useCallback(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  function alternar(id: number) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const ids = (encomendas ?? []).filter((e) => selecionados.has(e.id)).map((e) => e.id);
  const acimaDoLimite = ids.length > MAXIMO_MANUAL;

  return (
    <View style={styles.tela}>
      <View style={styles.cabecalho}>
        <View style={styles.cabecalhoTextos}>
          <Text style={styles.unidadeEscolhida}>{unidade.descricao}</Text>
          <Text style={styles.subtitulo}>
            {encomendas ? `${encomendas.length} aguardando retirada` : 'Carregando encomendas…'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onTrocarUnidade} disabled={ocupado}>
          <Text style={styles.acao}>Trocar unidade</Text>
        </Pressable>
      </View>
      {erro ? <Text style={[styles.erro, styles.erroLista]}>{erro}</Text> : null}

      <FlatList
        style={styles.lista}
        data={encomendas ?? []}
        keyExtractor={(e) => String(e.id)}
        ItemSeparatorComponent={Separador}
        onRefresh={puxarParaAtualizar}
        refreshing={carregando && !!encomendas}
        ListEmptyComponent={
          carregando ? (
            <ActivityIndicator style={styles.carregando} color={cores.primaria} />
          ) : (
            <Text style={styles.vazio}>Nenhuma encomenda aguardando nesta unidade.</Text>
          )
        }
        renderItem={({ item: e }) => {
          const marcado = selecionados.has(e.id);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marcado, disabled: ocupado }}
              disabled={ocupado}
              onPress={() => alternar(e.id)}
              style={({ pressed }) => [styles.linha, pressed && styles.linhaPressionada]}
            >
              <View style={[styles.caixa, marcado && styles.caixaMarcada]}>
                {marcado ? <Text style={styles.marca}>✓</Text> : null}
              </View>
              <View style={styles.encomendaTextos}>
                <Text style={styles.transportadora} numberOfLines={1}>
                  {e.transportadora || 'Transportadora não identificada'}
                </Text>
                <Text style={styles.detalhe} numberOfLines={1}>
                  {e.nome_destinatario || 'Destinatário não informado'} · chegou {formatarChegada(e.recebida_em)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.rodape}>
        <View style={styles.fotoLinha}>
          {foto ? <Image source={{ uri: paraUri(foto) }} style={styles.miniatura} /> : null}
          <View style={styles.fotoBotao}>
            <Botao
              titulo={foto ? 'Refazer foto' : 'Fotografar quem retira'}
              variante={foto ? 'secundario' : 'primario'}
              onPress={onFotografar}
              desabilitado={ocupado || ids.length === 0}
            />
          </View>
        </View>
        {acimaDoLimite ? (
          <Text style={styles.erro}>No máximo {MAXIMO_MANUAL} encomendas por retirada.</Text>
        ) : null}
        <Botao
          titulo={ids.length > 0 ? `Confirmar retirada (${ids.length})` : 'Selecione as encomendas'}
          onPress={() => {
            if (foto) void onConfirmar(ids, foto);
          }}
          carregando={ocupado}
          desabilitado={!foto || ids.length === 0 || acimaDoLimite}
        />
      </View>
    </View>
  );
}

function Separador() {
  return <View style={styles.separador} />;
}

const styles = StyleSheet.create({
  tela: { flex: 1 },
  campos: { padding: 12, gap: 8 },
  input: {
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    paddingHorizontal: 14,
    fontSize: 18,
    color: cores.texto,
  },
  erro: { color: cores.erro, fontSize: 14 },
  erroLista: { paddingHorizontal: 16, paddingTop: 8 },
  lista: { flex: 1, backgroundColor: cores.superficie },
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: cores.borda },
  linha: { minHeight: 60, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 14 },
  linhaPressionada: { backgroundColor: '#E8EFFA' },
  unidadeTexto: { flex: 1, fontSize: 19, fontWeight: '600', color: cores.texto },
  seta: { fontSize: 24, color: cores.textoSecundario },
  carregando: { marginTop: 24 },
  vazio: { textAlign: 'center', color: cores.textoSecundario, padding: 20, fontSize: 15 },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: cores.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  cabecalhoTextos: { flex: 1 },
  unidadeEscolhida: { fontSize: 22, fontWeight: '700', color: cores.texto },
  subtitulo: { fontSize: 13, color: cores.textoSecundario },
  acao: { fontSize: 15, fontWeight: '600', color: cores.primaria },
  caixa: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaMarcada: { backgroundColor: cores.primaria },
  marca: { color: '#fff', fontSize: 18, fontWeight: '700' },
  encomendaTextos: { flex: 1, gap: 2 },
  transportadora: { fontSize: 17, fontWeight: '600', color: cores.texto },
  detalhe: { fontSize: 14, color: cores.textoSecundario },
  rodape: {
    padding: 12,
    gap: 10,
    backgroundColor: cores.fundo,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
  },
  fotoLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniatura: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#000' },
  fotoBotao: { flex: 1 },
  camera: { flex: 1, backgroundColor: '#000' },
  cameraBarra: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cameraTitulo: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  cameraCancelar: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cameraArea: { flex: 1 },
});
