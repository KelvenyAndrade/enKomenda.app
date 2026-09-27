import { useCallback, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { Botao } from '../../components/Botao';
import { cores } from '../../theme';

interface Props {
  /** false pausa a camera (aba fora de foco, app em segundo plano, folha aberta). */
  ativo: boolean;
  /** Recebe o caminho da foto recem-tirada. Deve retornar na hora (o processamento e em segundo plano). */
  onFoto: (caminho: string) => void;
}

/**
 * Camera de captura continua: um toque no botao = uma etiqueta. Sem telas intermediarias;
 * o retorno e so um flash branco e uma vibracao curta.
 */
export function CameraCaptura({ ativo, onFoto }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [pedido, setPedido] = useState<'nunca' | 'negado'>('nunca');
  const [capturando, setCapturando] = useState(false);
  const capturandoRef = useRef(false);
  const [erro, setErro] = useState<string | null>(null);
  const flash = useRef(new Animated.Value(0)).current;

  const pedirPermissao = useCallback(async () => {
    const ok = await requestPermission();
    if (!ok) setPedido('negado');
  }, [requestPermission]);

  const disparar = useCallback(async () => {
    // Uma captura por vez: toques durante a captura sao ignorados.
    if (capturandoRef.current || !camera.current) return;
    capturandoRef.current = true;
    setCapturando(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    try {
      const foto = await camera.current.takePhoto({ flash: 'off', enableShutterSound: false });
      setErro(null);
      onFoto(foto.path);
    } catch {
      setErro('Não foi possível tirar a foto. Tente de novo.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      capturandoRef.current = false;
      setCapturando(false);
    }
  }, [flash, onFoto]);

  if (!hasPermission) {
    return (
      <View style={[styles.area, styles.aviso]}>
        <Text style={styles.avisoTitulo}>Precisamos da câmera</Text>
        <Text style={styles.avisoTexto}>
          {pedido === 'negado'
            ? 'O acesso à câmera foi negado. Libere a permissão nas configurações do aparelho para fotografar as etiquetas.'
            : 'O enKomenda usa a câmera para fotografar as etiquetas das encomendas que chegam na portaria.'}
        </Text>
        {pedido === 'negado' ? (
          <Botao titulo="Abrir configurações" onPress={() => void Linking.openSettings()} />
        ) : (
          <Botao titulo="Permitir câmera" onPress={() => void pedirPermissao()} />
        )}
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.area, styles.aviso]}>
        <Text style={styles.avisoTitulo}>Câmera não encontrada</Text>
        <Text style={styles.avisoTexto}>Este aparelho não tem câmera traseira disponível.</Text>
      </View>
    );
  }

  return (
    <View style={styles.area}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={ativo}
        photo
        photoQualityBalance="speed"
        onError={(e) => setErro(e.message)}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
      {erro ? (
        <View style={styles.erro}>
          <Text style={styles.erroTexto}>{erro}</Text>
        </View>
      ) : null}
      <View style={styles.rodape}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fotografar etiqueta"
          onPress={() => void disparar()}
          disabled={!ativo}
          hitSlop={16}
          style={({ pressed }) => [styles.disparo, (pressed || capturando) && styles.disparoPressionado]}
        >
          <View style={styles.disparoMiolo} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  aviso: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: cores.texto },
  avisoTitulo: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  avisoTexto: { color: '#DDE3EA', fontSize: 15, textAlign: 'center', marginBottom: 8 },
  flash: { backgroundColor: '#fff' },
  erro: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: cores.erroFundo,
  },
  erroTexto: { color: cores.erro, fontSize: 14, textAlign: 'center' },
  rodape: { position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center' },
  disparo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  disparoPressionado: { transform: [{ scale: 0.92 }], opacity: 0.8 },
  disparoMiolo: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
});
