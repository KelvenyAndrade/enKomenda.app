import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import type { Vinculo } from '../api/types';
import { Botao } from '../components/Botao';
import { useSession } from '../session/SessionContext';
import { NOME_DO_PERFIL, rotaPara } from '../session/rotas';
import { cores } from '../theme';

/**
 * Escolha de condominio/unidade quando o login devolve mais de um vinculo.
 * TODO (fase seguinte): a troca deve chamar POST /auth/contexto e usar o novo token;
 * nesta fase so troca o contexto local (ver SessionContext.escolherVinculo).
 */
export default function EscolherVinculo() {
  const { sessao, escolherVinculo, sair } = useSession();
  const [salvando, setSalvando] = useState(false);

  if (!sessao || !sessao.escolhaPendente) return <Redirect href={rotaPara(sessao)} />;

  async function escolher(v: Vinculo) {
    setSalvando(true);
    try {
      await escolherVinculo(v);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>Olá, {sessao.usuario.nome}. Você tem acesso a mais de um local. Qual deseja usar?</Text>
      <FlatList
        data={sessao.vinculos}
        keyExtractor={(v) => `${v.condominio_id}-${v.unidade_id}-${v.perfil}`}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            disabled={salvando}
            onPress={() => escolher(item)}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressionado]}
          >
            <Text style={styles.itemTitulo}>{item.condominio_nome}</Text>
            <Text style={styles.itemSub}>
              {NOME_DO_PERFIL[item.perfil]}
              {item.unidade_descricao ? ` · ${item.unidade_descricao}` : ''}
            </Text>
          </Pressable>
        )}
      />
      <Botao titulo="Sair" variante="secundario" onPress={() => void sair()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, backgroundColor: cores.fundo },
  intro: { fontSize: 15, color: cores.texto },
  lista: { gap: 10 },
  item: {
    backgroundColor: cores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 16,
    gap: 4,
  },
  itemPressionado: { backgroundColor: '#E8EFFA' },
  itemTitulo: { fontSize: 16, fontWeight: '700', color: cores.texto },
  itemSub: { fontSize: 14, color: cores.textoSecundario },
});
