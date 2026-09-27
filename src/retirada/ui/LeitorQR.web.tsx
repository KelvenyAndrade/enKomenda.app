import { StyleSheet, Text, View } from 'react-native';

import { cores } from '../../theme';

interface Props {
  ativo: boolean;
  onLeitura: (valor: string) => void;
  aviso?: string | null;
  enviando?: boolean;
}

/** Na web (so desenvolvimento) nao ha vision-camera: mostra um aviso no lugar do leitor. */
export function LeitorQR(_props: Props) {
  return (
    <View style={styles.area}>
      <Text style={styles.titulo}>Leitor de QR indisponível no navegador</Text>
      <Text style={styles.texto}>Use o development build no Android ou iOS, ou os modos Código e Manual.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8, backgroundColor: cores.texto },
  titulo: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  texto: { color: '#DDE3EA', fontSize: 15, textAlign: 'center' },
});
