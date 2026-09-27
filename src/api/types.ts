// Tipos do contrato da API enKomenda (PLANO_GLOBAL.md, secao 3).

/** Envelope padrao de todas as respostas da API. */
export interface Envelope<T> {
  sucesso: boolean;
  mensagem: string;
  dados: T | null;
}

export type Perfil = 'PORTEIRO' | 'MORADOR' | 'SINDICO';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  telefone: string;
}

/** Condominio/unidade/perfil ativos no token. */
export interface Contexto {
  condominio_id: number;
  condominio_nome: string;
  unidade_id: number;
  perfil: Perfil;
}

/** Um vinculo do usuario (condominio + unidade + perfil). */
export interface Vinculo {
  condominio_id: number;
  condominio_nome: string;
  unidade_id: number;
  unidade_descricao: string;
  perfil: Perfil;
}

/** `dados` de POST /auth/login. */
export interface LoginResposta {
  token: string;
  expira_em: string;
  usuario: Usuario;
  contexto: Contexto;
  vinculos: Vinculo[];
}
