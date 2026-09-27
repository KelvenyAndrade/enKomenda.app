// Android (e padrao): leitor de QR do VisionCamera v5 com ML Kit (react-native-vision-camera-barcode-scanner).
// No iOS o Metro usa useSaidaQR.ios.ts (deteccao nativa AVFoundation), e o pacote do ML Kit
// fica fora do autolinking do iOS (package.json > expo.autolinking.ios.exclude) para nao
// conflitar com o GoogleMLKit do @react-native-ml-kit/text-recognition.
import { useBarcodeScannerOutput, type TargetBarcodeFormat } from 'react-native-vision-camera-barcode-scanner';
import type { CameraOutput } from 'react-native-vision-camera';

// Constante de modulo: o hook recria a saida (e reconfigura a sessao) se a referencia mudar.
const FORMATOS: TargetBarcodeFormat[] = ['qr-code'];

/**
 * Saida de camera que entrega os textos dos QRs lidos em cada quadro.
 * Os callbacks ficam em refs dentro do hook: trocar `onValores`/`onErro` nao reconstroi a sessao.
 */
export function useSaidaQR(
  onValores: (valores: (string | undefined)[]) => void,
  onErro: (erro: Error) => void,
): CameraOutput {
  return useBarcodeScannerOutput({
    barcodeFormats: FORMATOS,
    onBarcodeScanned: (codigos) => onValores(codigos.map((c) => c.rawValue ?? c.displayValue)),
    onError: onErro,
  });
}
