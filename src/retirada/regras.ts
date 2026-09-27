// Regras da retirada sem dependencia de React/nativo (testaveis isoladamente).

import type { Encomenda, RetiradaResposta } from '../api/types';

export const TAMANHO_CODIGO = 6;

/** Prazo da API para desfazer uma baixa. */
export const PRAZO_DESFAZER_MS = 15 * 60 * 1000;

/** Limite da API por baixa manual. */
export const MAXIMO_MANUAL = 50;

export const MENSAGEM_SEM_CONEXAO = 'Sem conexão — a retirada precisa de internet';

/** Acrescenta um digito ao codigo (ignora nao-digitos e o que passar de 6). */
export function acrescentarDigito(codigo: string, digito: string): string {
  if (!/^\d$/.test(digito) || codigo.length >= TAMANHO_CODIGO) return codigo;
  return codigo + digito;
}

export function codigoCompleto(codigo: string): boolean {
  return new RegExp(`^\\d{${TAMANHO_CODIGO}}$`).test(codigo);
}

/** true enquanto a baixa feita em `instante` ainda pode ser desfeita. */
export function podeDesfazer(instante: number, agora: number = Date.now()): boolean {
  return agora - instante < PRAZO_DESFAZER_MS;
}

/** Minutos restantes (arredondado para cima) para desfazer; 0 quando expirou. */
export function minutosParaDesfazer(instante: number, agora: number = Date.now()): number {
  const resta = PRAZO_DESFAZER_MS - (agora - instante);
  return resta > 0 ? Math.ceil(resta / 60_000) : 0;
}

export interface ItemResumo {
  id: number;
  transportadora: string;
  destinatario: string;
}

export interface ResumoRetirada {
  /** Descricoes distintas das unidades (normalmente uma so). */
  unidades: string[];
  volumes: number;
  itens: ItemResumo[];
  naoEncontrados: string[];
}

/** Dados do card de resultado. */
export function resumirRetirada(r: RetiradaResposta): ResumoRetirada {
  const unidades: string[] = [];
  for (const e of r.retiradas) {
    const u = e.unidade_descricao?.trim();
    if (u && !unidades.includes(u)) unidades.push(u);
  }
  return {
    unidades,
    volumes: r.retiradas.length,
    itens: r.retiradas.map((e) => ({
      id: e.id,
      transportadora: e.transportadora?.trim() || 'Transportadora não identificada',
      destinatario: e.nome_destinatario?.trim() || 'Destinatário não informado',
    })),
    naoEncontrados: r.nao_encontrados,
  };
}

export function textoVolumes(n: number): string {
  return n === 1 ? '1 volume' : `${n} volumes`;
}

/** "27/09 14:05" (hora local do aparelho). Texto original se a data for invalida. */
export function formatarChegada(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  const hora = `${p(d.getHours())}:${p(d.getMinutes())}`;
  const mesmoDia =
    d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() === agora.getDate();
  return mesmoDia ? `hoje ${hora}` : `${p(d.getDate())}/${p(d.getMonth() + 1)} ${hora}`;
}

/** Mantem so as selecoes que continuam na lista; itens novos entram marcados. */
export function reconciliarSelecao(
  anteriores: Encomenda[] | null,
  selecionados: ReadonlySet<number>,
  novos: Encomenda[],
): Set<number> {
  const conhecidos = new Set((anteriores ?? []).map((e) => e.id));
  const r = new Set<number>();
  for (const e of novos) {
    if (!conhecidos.has(e.id) || selecionados.has(e.id)) r.add(e.id);
  }
  return r;
}

export interface ResultadoDesfazer {
  desfeitas: number[];
  erros: { id: number; mensagem: string }[];
}

/** Chama `desfazer` para cada id (um por vez, para nao estourar a API) e junta os resultados. */
export async function desfazerTodas(
  ids: number[],
  desfazer: (id: number) => Promise<unknown>,
  mensagem: (e: unknown) => string,
): Promise<ResultadoDesfazer> {
  const r: ResultadoDesfazer = { desfeitas: [], erros: [] };
  for (const id of ids) {
    try {
      await desfazer(id);
      r.desfeitas.push(id);
    } catch (e) {
      r.erros.push({ id, mensagem: mensagem(e) });
    }
  }
  return r;
}
