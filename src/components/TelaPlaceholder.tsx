import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../session/SessionContext';
import { NOME_DO_PERFIL } from '../session/rotas';
import { cores } from '../theme';
import { Botao } from './Botao';

interface Props {
  titulo: string;
  descricao: string;
  children?: ReactNode;
}

/** Tela provisoria da Fase 1: mostra o contexto ativo e o botao Sair. */
export function TelaPlaceholder({ titulo, descricao, children }: Props) {
  const { sessao, sair } = useSession();
  const ctx = sessao?.contexto;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.cartao}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.descricao}>{descricao}</Text>
        {children}
      </View>

      {sessao && ctx ? (
        <View style={styles.contexto}>
          <Text style={styles.contextoTexto}>{sessao.usuario.nome}</Text>
          <Text style={styles.contextoSub}>
            {NOME_DO_PERFIL[ctx.perfil]} · {ctx.condominio_nome}
          </Text>
        </View>
      ) : null}

      <Botao titulo="Sair" variante="secundario" onPress={() => void sair()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 16, backgroundColor: cores.fundo },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: cores.borda,
    gap: 8,
  },
  titulo: { fontSize: 20, fontWeight: '700', color: cores.texto },
  descricao: { fontSize: 15, color: cores.textoSecundario },
  contexto: { alignItems: 'center', gap: 2 },
  contextoTexto: { fontSize: 15, fontWeight: '600', color: cores.texto },
  contextoSub: { fontSize: 13, color: cores.textoSecundario },
});
