import type { Encomenda } from '../api/types';

/**
 * Ciclo de vida de uma etiqueta no aparelho:
 * processando (redimensiona + OCR) -> na_fila -> enviando -> enviado | erro (definitivo).
 * Erro de rede/5xx volta para na_fila e e reenviado com backoff.
 */
export type EstadoItem = 'processando' | 'na_fila' | 'enviando' | 'enviado' | 'erro';

/** Um item da fila local de recebimento (persistido). */
export interface ItemFila {
  /** cliente_uuid enviado a API (idempotencia). */
  uuid: string;
  /** Dono do item: so e enviado/mostrado com a sessao do mesmo usuario e condominio. */
  usuario_id: number;
  condominio_id: number;
  /**
   * file:// da foto. Em 'processando' pode ser a foto original da camera; depois, o JPEG
   * ~1280 px no documentDirectory. null depois de apagada.
   */
  arquivo: string | null;
  /** file:// da miniatura usada na lista. Apagada quando o item sai da fila. */
  miniatura: string | null;
  /** Texto lido pelo ML Kit ('' se o OCR falhou). */
  texto_ocr: string;
  /** ISO 8601. */
  criado_em: string;
  estado: EstadoItem;
  /** Tentativas de envio ja feitas. */
  tentativas: number;
  ultimo_erro: string | null;
  /** Encomenda devolvida pela API (POST, polling de /recentes ou PATCH). */
  resposta: Encomenda | null;
}

/** Usuario + condominio da sessao ativa. */
export interface ContextoFila {
  usuario_id: number;
  condominio_id: number;
}
