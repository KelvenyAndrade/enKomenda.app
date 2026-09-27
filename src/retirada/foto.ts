import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { apagarArquivo, lerBase64, paraUri, tamanhoArquivo } from '../recebimento/armazenamento';

/** Mesmo padrao do recebimento: ~1280 px, JPEG 70% (a API aceita ate 1,5 MB). */
const LARGURA_FOTO = 1280;
const QUALIDADE_FOTO = 0.7;
const TAMANHO_MAXIMO = 1_400_000;

/**
 * Foto de quem retira (comprovante da baixa manual) em base64: redimensiona no nativo,
 * le o conteudo e apaga o arquivo temporario. A foto original fica com quem chamou.
 */
export async function fotoRetiradaBase64(caminho: string): Promise<string> {
  const imagem = await ImageManipulator.manipulate(paraUri(caminho)).resize({ width: LARGURA_FOTO }).renderAsync();
  let temporario: string | null = null;
  try {
    let foto = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE_FOTO });
    temporario = foto.uri;
    if (tamanhoArquivo(foto.uri) > TAMANHO_MAXIMO) {
      apagarArquivo(foto.uri);
      foto = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.5 });
      temporario = foto.uri;
    }
    return await lerBase64(foto.uri);
  } finally {
    imagem.release();
    apagarArquivo(temporario);
  }
}

/** Apaga a foto tirada pela camera (sem lancar). */
export function descartarFoto(caminho: string | null | undefined): void {
  if (caminho) apagarArquivo(paraUri(caminho));
}
