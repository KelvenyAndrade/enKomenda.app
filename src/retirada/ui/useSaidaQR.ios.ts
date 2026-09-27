// iOS: deteccao nativa de QR do VisionCamera v5 (CameraObjectOutput / AVFoundation), como na v4.
// CameraObjectOutput so existe no iOS; o Android usa useSaidaQR.ts (ML Kit).
import { useEffect, useRef } from 'react';
import {
  isScannedCode,
  useObjectOutput,
  type CameraOutput,
  type ScannedObject,
  type ScannedObjectType,
} from 'react-native-vision-camera';

// Constante de modulo: o hook recria a saida (e reconfigura a sessao) se a referencia mudar.
const TIPOS: ScannedObjectType[] = ['qr'];

/**
 * Saida de camera que entrega os textos dos QRs lidos em cada quadro.
 * Os callbacks ficam em refs: trocar `onValores` nao reconstroi a sessao.
 * `onErro` nao se aplica aqui (erros da sessao chegam pelo onError da <Camera>).
 */
export function useSaidaQR(
  onValores: (valores: (string | undefined)[]) => void,
  _onErro: (erro: Error) => void,
): CameraOutput {
  const ref = useRef(onValores);
  useEffect(() => {
    ref.current = onValores;
  }, [onValores]);

  const receber = useRef((objetos: ScannedObject[]) => {
    ref.current(objetos.filter(isScannedCode).map((c) => c.value));
  }).current;

  return useObjectOutput({ types: TIPOS, onObjectsScanned: receber });
}
