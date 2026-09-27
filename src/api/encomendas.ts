import { api } from './client';
import type {
  DefinirUnidadeRequisicao,
  Encomenda,
  EncomendaDetalhe,
  NovaEncomendaRequisicao,
  RetiradaManualRequisicao,
  RetiradaResposta,
  UnidadeBusca,
} from './types';

/** POST /encomendas - registra a encomenda (idempotente pelo cliente_uuid: 201 nova, 200 ja enviada). */
export function registrarEncomenda(corpo: NovaEncomendaRequisicao): Promise<Encomenda> {
  return api.post<Encomenda>('/encomendas', corpo);
}

/** GET /encomendas/recentes - lista do turno (pendentes primeiro). */
export async function listarRecentes(horas = 12): Promise<Encomenda[]> {
  return (await api.get<Encomenda[] | null>(`/encomendas/recentes?horas=${horas}`)) ?? [];
}

/** GET /encomendas/{id} - detalhe com foto_url (assinada, 30 min) ou null. */
export function obterEncomenda(id: number): Promise<EncomendaDetalhe> {
  return api.get<EncomendaDetalhe>(`/encomendas/${id}`);
}

/** PATCH /encomendas/{id}/unidade - resolucao manual (a API aprende nome -> unidade). */
export function definirUnidade(id: number, corpo: DefinirUnidadeRequisicao): Promise<Encomenda> {
  return api.patch<Encomenda>(`/encomendas/${id}/unidade`, corpo);
}

/** GET /unidades/busca?q= - autocomplete de unidades ativas (maximo 20). */
export async function buscarUnidades(q: string): Promise<UnidadeBusca[]> {
  return (await api.get<UnidadeBusca[] | null>(`/unidades/busca?q=${encodeURIComponent(q.trim())}`)) ?? [];
}

// ---- Retirada (baixa) ----

/** Normaliza a resposta da baixa (listas ausentes viram []). */
function respostaRetirada(r: RetiradaResposta | null): RetiradaResposta {
  return { retiradas: r?.retiradas ?? [], nao_encontrados: r?.nao_encontrados ?? [] };
}

/** POST /encomendas/retirada/qr - baixa todas as encomendas do QR do morador (404 se nenhuma aguardando). */
export async function retirarPorQR(qr: string): Promise<RetiradaResposta> {
  return respostaRetirada(await api.post<RetiradaResposta | null>('/encomendas/retirada/qr', { qr }));
}

/** POST /encomendas/retirada/codigo - baixa pelo codigo de 6 digitos ditado pelo morador. */
export async function retirarPorCodigo(codigo: string): Promise<RetiradaResposta> {
  return respostaRetirada(await api.post<RetiradaResposta | null>('/encomendas/retirada/codigo', { codigo }));
}

/** GET /encomendas/aguardando?unidade_id= - encomendas AGUARDANDO da unidade, mais antigas primeiro. */
export async function listarAguardando(unidadeId: number): Promise<Encomenda[]> {
  return (await api.get<Encomenda[] | null>(`/encomendas/aguardando?unidade_id=${unidadeId}`)) ?? [];
}

/** POST /encomendas/retirada/manual - baixa sem codigo, com foto de quem retira (409: nada e baixado). */
export async function retirarManual(corpo: RetiradaManualRequisicao): Promise<RetiradaResposta> {
  return respostaRetirada(await api.post<RetiradaResposta | null>('/encomendas/retirada/manual', corpo));
}

/** POST /encomendas/{id}/desfazer-retirada - volta a AGUARDANDO (ate 15 min, so quem deu a baixa ou o sindico). */
export function desfazerRetirada(id: number): Promise<Encomenda> {
  return api.post<Encomenda>(`/encomendas/${id}/desfazer-retirada`);
}
