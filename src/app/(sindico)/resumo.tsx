import { StyleSheet, Text, View } from 'react-native';

import { TelaPlaceholder } from '../../components/TelaPlaceholder';
import { cores } from '../../theme';

const INDICADORES = ['Pendentes', 'Vencidas', 'Taxas do mês'];

export default function Resumo() {
  return (
    <TelaPlaceholder
      titulo="Resumo do condomínio"
      descricao="Os indicadores serão carregados da API nas próximas fases. A gestão completa fica no painel web."
    >
      <View style={styles.grade}>
        {INDICADORES.map((nome) => (
          <View key={nome} style={styles.indicador}>
            <Text style={styles.valor}>—</Text>
            <Text style={styles.nome}>{nome}</Text>
          </View>
        ))}
      </View>
    </TelaPlaceholder>
  );
}

const styles = StyleSheet.create({
  grade: { flexDirection: 'row', gap: 10, marginTop: 8 },
  indicador: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: cores.fundo,
    gap: 4,
  },
  valor: { fontSize: 22, fontWeight: '700', color: cores.texto },
  nome: { fontSize: 13, color: cores.textoSecundario, textAlign: 'center' },
});
