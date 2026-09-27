import TextRecognition from '@react-native-ml-kit/text-recognition';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { apagarArquivo, arquivoExiste, moverParaFila, tamanhoArquivo } from './armazenamento';
import type { FilaRecebimento } from './fila';

/** Largura enviada a API (sugestao do contrato: ~1280 px, JPEG 70%). */
const LARGURA_FOTO = 1280;
const QUALIDADE_FOTO = 0.7;
/** Se passar disso, regrava com qualidade menor (a API aceita ate 1,5 MB). */
const TAMANHO_MAXIMO = 1_400_000;
const LARGURA_MINIATURA = 160;
/** Limite do campo texto_ocr na API. */
const MAX_TEXTO_OCR = 10_000;

/**
 * Redimensiona a foto (JPEG ~1280 px, 70%) e gera a miniatura, ambas na pasta da fila.
 * O trabalho pesado roda no nativo (expo-image-manipulator), fora da thread de UI.
 */
export async function redimensionar(origemUri: string, uuid: string): Promise<{ arquivo: string; miniatura: string }> {
  const imagem = await ImageManipulator.manipulate(origemUri).resize({ width: LARGURA_FOTO }).renderAsync();
  try {
    let foto = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE_FOTO });
    if (tamanhoArquivo(foto.uri) > TAMANHO_MAXIMO) {
      apagarArquivo(foto.uri);
      foto = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.5 });
    }
    const mini = await ImageManipulator.manipulate(foto.uri).resize({ width: LARGURA_MINIATURA }).renderAsync();
    let miniatura: { uri: string };
    try {
      miniatura = await mini.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });
    } finally {
      mini.release();
    }
    return {
      arquivo: moverParaFila(foto.uri, `${uuid}.jpg`),
      miniatura: moverParaFila(miniatura.uri, `${uuid}.mini.jpg`),
    };
  } finally {
    imagem.release();
  }
}

/** OCR on-device (ML Kit, alfabeto latino). Em qualquer falha devolve ''. */
export async function lerTexto(arquivoUri: string): Promise<string> {
  try {
    const resultado = await TextRecognition.recognize(arquivoUri);
    return (resultado?.text ?? '').trim().slice(0, MAX_TEXTO_OCR);
  } catch {
    return '';
  }
}

/**
 * Processa as fotos capturadas, uma de cada vez e em segundo plano (a camera nunca espera):
 * redimensiona, le o texto e passa o item de 'processando' para 'na_fila'.
 */
export class PreparadorFotos {
  private cadeia: Promise<void> = Promise.resolve();
  private readonly agendados = new Set<string>();

  constructor(
    private readonly fila: FilaRecebimento,
    /** Chamado quando um item fica pronto para envio. */
    private readonly aoFicarPronto: () => void,
  ) {}

  /** Coloca o item na cadeia de processamento (ignora se ja estiver agendado). */
  agendar(uuid: string): void {
    if (this.agendados.has(uuid)) return;
    this.agendados.add(uuid);
    this.cadeia = this.cadeia.then(() => this.processar(uuid)).finally(() => this.agendados.delete(uuid));
  }

  /** Retoma itens que ficaram em 'processando' (app fechado no meio). */
  retomarPendentes(): void {
    for (const item of this.fila.obterTodos()) {
      if (item.estado === 'processando') this.agendar(item.uuid);
    }
  }

  private async processar(uuid: string): Promise<void> {
    const item = this.fila.obter(uuid);
    if (!item || item.estado !== 'processando') return;

    if (!item.arquivo || !arquivoExiste(item.arquivo)) {
      this.fila.atualizar(uuid, { estado: 'erro', ultimo_erro: 'A foto não foi encontrada no aparelho. Fotografe de novo.' });
      return;
    }

    const original = item.arquivo;
    let arquivo = original;
    let miniatura = item.miniatura;
    try {
      const r = await redimensionar(original, uuid);
      arquivo = r.arquivo;
      miniatura = r.miniatura;
      if (original !== arquivo) apagarArquivo(original);
    } catch {
      // Sem redimensionar: segue com a foto original, levada para a pasta da fila (a API
      // recusa acima de 1,5 MB e o item fica em erro com a mensagem dela).
      try {
        arquivo = moverParaFila(original, `${uuid}.jpg`);
      } catch {
        arquivo = original;
      }
    }

    // Item descartado durante o processamento.
    if (!this.fila.obter(uuid)) {
      apagarArquivo(arquivo);
      apagarArquivo(miniatura);
      return;
    }
    this.fila.atualizar(uuid, { arquivo, miniatura });

    const texto = await lerTexto(arquivo);
    const atualizado = this.fila.atualizar(uuid, (i) =>
      i.estado === 'processando' ? { texto_ocr: texto, estado: 'na_fila' } : { texto_ocr: texto },
    );
    if (atualizado?.estado === 'na_fila') this.aoFicarPronto();
  }
}
