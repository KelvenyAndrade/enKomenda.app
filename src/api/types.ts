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

// ---- Recebimento (API-Endpoints-Porteiro.md) ----

/** PENDENTE_IDENT = sem unidade (o porteiro resolve ou a IA tenta depois). */
export type StatusEncomenda = 'PENDENTE_IDENT' | 'AGUARDANDO' | 'RETIRADA' | 'CANCELADA';

/** Forma da baixa (retirada_metodo). */
export type MetodoRetirada = 'QR' | 'CODIGO' | 'MANUAL';

export type MetodoIdentificacao = 'REGEX' | 'NOME' | 'APRENDIZADO' | 'IA' | 'MANUAL';

/** Encomenda como o porteiro ve (sem codigo de retirada). */
export interface Encomenda {
  id: number;
  cliente_uuid: string;
  status: StatusEncomenda;
  /** null enquanto PENDENTE_IDENT. */
  unidade_id: number | null;
  unidade_descricao: string | null;
  nome_destinatario: string | null;
  transportadora: string | null;
  rastreio: string | null;
  /** 0 a 100, null se nao identificada. */
  confianca: number | null;
  metodo_ident: MetodoIdentificacao | null;
  recebida_em: string;
  recebida_por: string | null;
  /** Data/hora da baixa, ou null (campos da Fase 4; opcionais em respostas antigas). */
  retirada_em?: string | null;
  retirada_metodo?: MetodoRetirada | null;
  /** Nome do porteiro que deu a baixa, ou null. */
  retirada_por?: string | null;
}

/** `dados` de GET /encomendas/{id}: encomenda + URL assinada da foto (30 min) ou null. */
export interface EncomendaDetalhe extends Encomenda {
  foto_url: string | null;
}

/** Corpo de POST /encomendas. */
export interface NovaEncomendaRequisicao {
  cliente_uuid: string;
  /** JPEG em base64 (ate 1,5 MB decodificado). */
  foto_base64: string;
  texto_ocr?: string;
}

/** Corpo de PATCH /encomendas/{id}/unidade. */
export interface DefinirUnidadeRequisicao {
  unidade_id: number;
  nome_destinatario?: string;
}

/** Item de GET /unidades/busca?q= (autocomplete, maximo 20). */
export interface UnidadeBusca {
  id: number;
  descricao: string;
}

// ---- Retirada (API-Endpoints-Porteiro.md, "Retirada (baixa)") ----

/** `dados` de POST /encomendas/retirada/qr | /codigo | /manual. */
export interface RetiradaResposta {
  retiradas: Encomenda[];
  /** Codigos que nao estavam aguardando (ja retirados, invalidos ou de outra unidade). */
  nao_encontrados: string[];
}

/** Corpo de POST /encomendas/retirada/manual. */
export interface RetiradaManualRequisicao {
  /** 1 a 50 ids, todos AGUARDANDO no condominio. */
  encomenda_ids: number[];
  /** JPEG de quem retira (ate 1,5 MB decodificado). */
  foto_base64: string;
}
