import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCameraDevices, useCameraPermission } from 'react-native-vision-camera';

import { Botao } from '../../components/Botao';
import { cores } from '../../theme';
import { escolherValor } from '../qr';
import { useSaidaQR } from './useSaidaQR';

interface Props {
  /** false pausa a camera (aba fora de foco, app em segundo plano, card aberto). */
  ativo: boolean;
  /** Texto de cada QR lido (a tela aplica a trava de repeticao e decide o que fazer). */
  onLeitura: (valor: string) => void;
  /** Aviso curto sobre a camera (ex.: QR que nao e do enKomenda). */
  aviso?: string | null;
  /** Mostra "Registrando retirada..." sobre a camera. */
  enviando?: boolean;
}

/** Camera traseira com leitor de QR (ML Kit no Android, AVFoundation no iOS; ver useSaidaQR). Sem foto: sessao mais leve. */
export function LeitorQR({ ativo, onLeitura, aviso, enviando }: Props) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  // Sem permissao e sem poder pedir de novo (negada de vez / restrita): so pelas configuracoes.
  const negado = !canRequestPermission;
  // A lista de cameras carrega de forma assincrona na v5: lista vazia = ainda carregando.
  const cameras = useCameraDevices();
  const device = useCameraDevice('back');
  const [erro, setErro] = useState<string | null>(null);
  const aoErro = useCallback((e: Error) => setErro(e.message), []);
  // useSaidaQR guarda o callback num ref: trocar onLeitura nao reconstroi a sessao da camera.
  const saidaQR = useSaidaQR((valores) => {
    const valor = escolherValor(valores);
    if (valor) onLeitura(valor);
  }, aoErro);

  if (!hasPermission) {
    return (
      <View style={[styles.area, styles.centro]}>
        <Text style={styles.avisoTitulo}>Precisamos da câmera</Text>
        <Text style={styles.avisoTexto}>
          {negado
            ? 'O acesso à câmera foi negado. Libere a permissão nas configurações do aparelho para ler o QR do morador.'
            : 'A câmera lê o QR de retirada que o morador mostra no celular.'}
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
      <View style={[styles.area, styles.centro]}>
        <Text style={styles.avisoTitulo}>Câmera não encontrada</Text>
        <Text style={styles.avisoTexto}>Use o código de 6 dígitos ou a retirada manual.</Text>
      </View>
    );
  }

  return (
    <View style={styles.area}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={ativo}
        outputs={[saidaQR]}
        onError={aoErro}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centro]}>
        <View style={styles.mira} />
        <Text style={styles.dica}>Aponte para o QR do morador</Text>
      </View>
      {aviso || erro ? (
        <View style={styles.faixa}>
          <Text style={styles.faixaTexto}>{aviso ?? erro}</Text>
        </View>
      ) : null}
      {enviando ? (
        <View style={[StyleSheet.absoluteFill, styles.centro, styles.enviando]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.enviandoTexto}>Registrando retirada…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  avisoTitulo: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  avisoTexto: { color: '#DDE3EA', fontSize: 15, textAlign: 'center', marginBottom: 8 },
  mira: {
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  dica: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  faixa: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: cores.avisoFundo,
  },
  faixaTexto: { color: cores.aviso, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  enviando: { backgroundColor: 'rgba(0,0,0,0.55)' },
  enviandoTexto: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
