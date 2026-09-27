import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { PersistenciaFila } from './fila';
import type { ItemFila } from './tipos';

/** Indice da fila no AsyncStorage (as fotos ficam em arquivos, nunca no indice). */
const CHAVE_FILA = 'enkomenda.recebimento.fila.v1';

/** Prefixo gravado no indice para arquivos da pasta da fila (o caminho absoluto muda no iOS entre atualizacoes). */
const PREFIXO_RELATIVO = 'fila:';

let pasta: Directory | null = null;

/** documentDirectory/recebimento - fotos e miniaturas da fila (sobrevivem a fechar o app). */
export function pastaDaFila(): Directory {
  if (!pasta) {
    pasta = new Directory(Paths.document, 'recebimento');
    if (!pasta.exists) pasta.create({ intermediates: true, idempotent: true });
  }
  return pasta;
}

/** Garante o esquema file:// (a vision-camera v5 devolve caminho puro, sem file://, nas duas plataformas). */
export function paraUri(caminho: string): string {
  return caminho.startsWith('file://') || caminho.includes('://') ? caminho : `file://${caminho}`;
}

/** Move um arquivo para a pasta da fila com o nome informado e devolve o novo file://. */
export function moverParaFila(origemUri: string, nome: string): string {
  const destino = new File(pastaDaFila(), nome);
  const origem = new File(origemUri);
  if (origem.uri === destino.uri) return origem.uri;
  if (destino.exists) destino.delete();
  origem.move(destino);
  return origem.uri;
}

/** Apaga o arquivo sem lancar (ja apagado, caminho invalido etc.). */
export function apagarArquivo(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignora
  }
}

export function arquivoExiste(uri: string | null | undefined): boolean {
  if (!uri) return false;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/** Conteudo do arquivo em base64 (para o foto_base64 do POST). */
export function lerBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

export function tamanhoArquivo(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

function paraIndice(uri: string | null): string | null {
  if (!uri) return null;
  const base = pastaDaFila().uri.replace(/\/?$/, '/');
  return uri.startsWith(base) ? PREFIXO_RELATIVO + uri.slice(base.length) : uri;
}

function doIndice(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (!valor.startsWith(PREFIXO_RELATIVO)) return valor;
  return new File(pastaDaFila(), valor.slice(PREFIXO_RELATIVO.length)).uri;
}

/** Persistencia real da fila: indice no AsyncStorage + arquivos no documentDirectory. */
export const persistenciaAparelho: PersistenciaFila = {
  async carregar() {
    const bruto = await AsyncStorage.getItem(CHAVE_FILA);
    if (!bruto) return [];
    const lidos = JSON.parse(bruto) as ItemFila[];
    if (!Array.isArray(lidos)) return [];
    return lidos
      .filter((i) => i && typeof i.uuid === 'string')
      .map((i) => ({ ...i, arquivo: doIndice(i.arquivo), miniatura: doIndice(i.miniatura) }));
  },

  async salvar(itens) {
    const indice = itens.map((i) => ({ ...i, arquivo: paraIndice(i.arquivo), miniatura: paraIndice(i.miniatura) }));
    await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(indice));
  },

  apagarArquivos({ arquivo, miniatura }) {
    apagarArquivo(arquivo);
    apagarArquivo(miniatura);
  },
};
