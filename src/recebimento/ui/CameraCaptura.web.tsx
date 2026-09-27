import { StyleSheet, Text, View } from 'react-native';

import { cores } from '../../theme';

interface Props {
  ativo: boolean;
  onFoto: (caminho: string) => void;
}

/** Na web (so desenvolvimento) nao ha vision-camera: mostra um aviso no lugar da camera. */
export function CameraCaptura(_props: Props) {
  return (
    <View style={styles.area}>
      <Text style={styles.titulo}>Câmera indisponível no navegador</Text>
      <Text style={styles.texto}>Use o development build no Android ou iOS para fotografar etiquetas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8, backgroundColor: cores.texto },
  titulo: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  texto: { color: '#DDE3EA', fontSize: 15, textAlign: 'center' },
});
