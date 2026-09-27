import { api } from './client';
import type { LoginResposta } from './types';

/** POST /auth/login - login por e-mail ou telefone + senha (rota publica). */
export function login(loginInformado: string, senha: string): Promise<LoginResposta> {
  return api.post<LoginResposta>('/auth/login', { login: loginInformado, senha }, false);
}

// TODO (fase seguinte): POST /auth/contexto para trocar condominio/unidade no servidor
// e receber um novo token. Hoje a troca de vinculo e apenas local (ver SessionContext).
