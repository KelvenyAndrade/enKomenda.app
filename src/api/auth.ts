import { api } from './client';
import type { EuResposta, LoginResposta, TrocaContextoRequisicao, Vinculo } from './types';

/** POST /auth/login - login por e-mail ou telefone + senha (rota publica). */
export function login(loginInformado: string, senha: string): Promise<LoginResposta> {
  return api.post<LoginResposta>('/auth/login', { login: loginInformado, senha }, false);
}

/** GET /auth/eu - revalida a sessao (usuario, contexto do token e vinculos ativos). */
export function eu(): Promise<EuResposta> {
  return api.get<EuResposta>('/auth/eu');
}

/** POST /auth/contexto - troca condominio/unidade/perfil e devolve a sessao com token novo. */
export function trocarContexto(vinculo: Vinculo): Promise<LoginResposta> {
  const corpo: TrocaContextoRequisicao = {
    condominio_id: vinculo.condominio_id,
    perfil: vinculo.perfil,
  };
  if (vinculo.perfil === 'MORADOR') corpo.unidade_id = vinculo.unidade_id;
  return api.post<LoginResposta>('/auth/contexto', corpo);
}
