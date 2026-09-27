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
  /** null quando nao cadastrado. */
  email: string | null;
  /** null quando nao cadastrado. */
  telefone: string | null;
}

/** Condominio/unidade/perfil ativos no token. */
export interface Contexto {
  condominio_id: number;
  condominio_nome: string;
  unidade_id: number;
  /** "Bloco - numero", so o numero, ou "" para sindico e porteiro. Opcional em sessoes antigas. */
  unidade_descricao?: string;
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

/** `dados` de POST /auth/login e POST /auth/contexto (sessao completa, com token). */
export interface LoginResposta {
  token: string;
  expira_em: string;
  usuario: Usuario;
  contexto: Contexto;
  vinculos: Vinculo[];
}

/** `dados` de GET /auth/eu: a sessao sem `token` e `expira_em`. */
export type EuResposta = Omit<LoginResposta, 'token' | 'expira_em'>;

/** Corpo de POST /auth/contexto. `unidade_id` so para MORADOR. */
export interface TrocaContextoRequisicao {
  condominio_id: number;
  perfil: Perfil;
  unidade_id?: number;
}
