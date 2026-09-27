import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { mensagemDeErro } from '../api/client';
import type { Contexto, Vinculo } from '../api/types';
import { Botao } from '../components/Botao';
import { useSession } from '../session/SessionContext';
import { NOME_DO_PERFIL, rotaPara } from '../session/rotas';
import { cores } from '../theme';

const chaveDoVinculo = (v: Vinculo) => `${v.condominio_id}-${v.unidade_id}-${v.perfil}`;

function ehContextoAtual(v: Vinculo, ctx: Contexto): boolean {
  return v.condominio_id === ctx.condominio_id && v.perfil === ctx.perfil && v.unidade_id === ctx.unidade_id;
}

/**
 * Escolha de condominio/unidade/perfil: apos um login com mais de um vinculo ou pela acao
 * "Trocar condominio/perfil". Chama POST /auth/contexto e grava a sessao com o token novo.
 */
export default function EscolherVinculo() {
  const { sessao, escolherVinculo, cancelarTrocaDeVinculo, sair } = useSession();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!sessao || !sessao.escolhaPendente) return <Redirect href={rotaPara(sessao)} />;

  const salvando = escolhido !== null;
  const troca = !!sessao.trocaVoluntaria;

  async function escolher(v: Vinculo) {
    setErro(null);
    setEscolhido(chaveDoVinculo(v));
    try {
      await escolherVinculo(v);
      // O redirecionamento acontece pelo Redirect acima quando a sessao muda.
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEscolhido(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        {troca
          ? 'Escolha o condomínio e o perfil que deseja usar.'
          : `Olá, ${sessao.usuario.nome}. Você tem acesso a mais de um local. Qual deseja usar?`}
      </Text>

      {erro ? (
        <View style={styles.erroCaixa} accessibilityLiveRegion="polite">
          <Text style={styles.erroTexto}>{erro}</Text>
        </View>
      ) : null}

      <FlatList
        data={sessao.vinculos}
        keyExtractor={chaveDoVinculo}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => {
          const carregandoItem = escolhido === chaveDoVinculo(item);
          const atual = troca && ehContextoAtual(item, sessao.contexto);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: salvando, busy: carregandoItem }}
              disabled={salvando}
              onPress={() => escolher(item)}
              style={({ pressed }) => [
                styles.item,
                atual && styles.itemAtual,
                pressed && styles.itemPressionado,
                salvando && !carregandoItem && styles.itemInativo,
              ]}
            >
              <View style={styles.itemTextos}>
                <Text style={styles.itemTitulo}>{item.condominio_nome}</Text>
                <Text style={styles.itemSub}>
                  {NOME_DO_PERFIL[item.perfil]}
                  {item.unidade_descricao ? ` · ${item.unidade_descricao}` : ''}
                  {atual ? ' · atual' : ''}
                </Text>
              </View>
              {carregandoItem ? <ActivityIndicator color={cores.primaria} /> : null}
            </Pressable>
          );
        }}
      />

      {troca ? (
        <Botao
          titulo="Cancelar"
          variante="secundario"
          desabilitado={salvando}
          onPress={() => void cancelarTrocaDeVinculo()}
        />
      ) : null}
      <Botao titulo="Sair" variante="secundario" desabilitado={salvando} onPress={() => void sair()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, backgroundColor: cores.fundo },
  intro: { fontSize: 15, color: cores.texto },
  lista: { gap: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 16,
  },
  itemAtual: { borderColor: cores.primaria },
  itemPressionado: { backgroundColor: '#E8EFFA' },
  itemInativo: { opacity: 0.6 },
  itemTextos: { flex: 1, gap: 4 },
  itemTitulo: { fontSize: 16, fontWeight: '700', color: cores.texto },
  itemSub: { fontSize: 14, color: cores.textoSecundario },
  erroCaixa: { backgroundColor: cores.erroFundo, borderRadius: 8, padding: 12 },
  erroTexto: { color: cores.erro, fontSize: 14 },
});
