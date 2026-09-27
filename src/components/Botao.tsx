import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { cores } from '../theme';

interface Props {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  desabilitado?: boolean;
  variante?: 'primario' | 'secundario';
}

export function Botao({ titulo, onPress, carregando, desabilitado, variante = 'primario' }: Props) {
  const inativo = desabilitado || carregando;
  const secundario = variante === 'secundario';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        secundario ? styles.secundario : styles.primario,
        pressed && !inativo && (secundario ? styles.secundarioPressionado : styles.primarioPressionado),
        inativo && styles.inativo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={secundario ? cores.primaria : '#fff'} />
      ) : (
        <Text style={[styles.texto, secundario && styles.textoSecundario]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primario: { backgroundColor: cores.primaria },
  primarioPressionado: { backgroundColor: cores.primariaEscura },
  secundario: { backgroundColor: 'transparent', borderWidth: 1, borderColor: cores.primaria },
  secundarioPressionado: { backgroundColor: '#E8EFFA' },
  inativo: { opacity: 0.6 },
  texto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  textoSecundario: { color: cores.primaria },
});
