import { api } from './client';
import type {
  DefinirUnidadeRequisicao,
  Encomenda,
  EncomendaDetalhe,
  NovaEncomendaRequisicao,
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
