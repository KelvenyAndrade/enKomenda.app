import { useCallback, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  useCameraDevice,
  useCameraDevices,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';

import { Botao } from '../../components/Botao';
import { cores } from '../../theme';

interface Props {
  /** false pausa a camera (aba fora de foco, app em segundo plano, folha aberta). */
  ativo: boolean;
  /** Recebe o caminho da foto recem-tirada. Deve retornar na hora (o processamento e em segundo plano). */
  onFoto: (caminho: string) => void;
  /** Rotulo de acessibilidade do disparo. Padrao: "Fotografar etiqueta". */
  rotuloDisparo?: string;
  /** Explicacao antes de pedir a permissao. Padrao: texto das etiquetas. */
  motivoPermissao?: string;
}

/**
 * Camera de captura continua: um toque no botao = uma etiqueta. Sem telas intermediarias;
 * o retorno e so um flash branco e uma vibracao curta.
 */
export function CameraCaptura({
  ativo,
  onFoto,
  rotuloDisparo = 'Fotografar etiqueta',
  motivoPermissao = 'O enKomenda usa a câmera para fotografar as etiquetas das encomendas que chegam na portaria.',
}: Props) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  // A lista de cameras carrega de forma assincrona na v5: lista vazia = ainda carregando.
  const cameras = useCameraDevices();
  const device = useCameraDevice('back');
  // JPEG explicito (o 'native' do iOS seria HEIC; a fila grava .jpg). 'speed' = disparo rapido em rajada.
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg', qualityPrioritization: 'speed' });
  // Sem permissao e sem poder pedir de novo (negada de vez / restrita): so pelas configuracoes.
  const negado = !canRequestPermission;
  const [capturando, setCapturando] = useState(false);
  const capturandoRef = useRef(false);
  const [erro, setErro] = useState<string | null>(null);
  const flash = useRef(new Animated.Value(0)).current;

  const disparar = useCallback(async () => {
    // Uma captura por vez: toques durante a captura sao ignorados.
    if (capturandoRef.current) return;
    capturandoRef.current = true;
    setCapturando(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    try {
      const foto = await photoOutput.capturePhotoToFile({ flashMode: 'off', enableShutterSound: false }, {});
      setErro(null);
      onFoto(foto.filePath);
    } catch {
      setErro('Não foi possível tirar a foto. Tente de novo.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      capturandoRef.current = false;
      setCapturando(false);
    }
  }, [flash, onFoto, photoOutput]);

  if (!hasPermission) {
    return (
      <View style={[styles.area, styles.aviso]}>
        <Text style={styles.avisoTitulo}>Precisamos da câmera</Text>
        <Text style={styles.avisoTexto}>
          {negado
            ? 'O acesso à câmera foi negado. Libere a permissão nas configurações do aparelho.'
            : motivoPermissao}
        </Text>
        {negado ? (
          <Botao titulo="Abrir configurações" onPress={() => void Linking.openSettings()} />
        ) : (
          <Botao titulo="Permitir câmera" onPress={() => void requestPermission()} />
        )}
      </View>
    );
  }

  if (cameras.length === 0) {
    return <View style={styles.area} />;
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
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={ativo}
        outputs={[photoOutput]}
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
          accessibilityLabel={rotuloDisparo}
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
