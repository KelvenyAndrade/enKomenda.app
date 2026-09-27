import type { Envelope } from './types';

/** Base da API, ex.: https://api.kds.com.br:9210/api/v1 (sem barra final). */
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

const TIMEOUT_MS = 20000;

/** Erro de API com a `mensagem` legivel devolvida pelo servidor. */
export class ApiError extends Error {
  readonly status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Mensagem padrao quando a API revoga o acesso (vinculo/usuario/condominio bloqueado). */
export const MENSAGEM_ACESSO_REVOGADO = 'Seu acesso foi revogado pelo síndico. Entre novamente.';

/**
 * Chamado quando a sessao deixa de valer no servidor: 401 com token ou 403 "Acesso revogado".
 * `aviso` e a mensagem para a tela de login (null no 401).
 */
export type AoSessaoInvalida = (aviso: string | null) => void;

// Token atual e callback de sessao invalida, registrados pelo SessionProvider.
let tokenAtual: string | null = null;
let aoSessaoInvalida: AoSessaoInvalida | null = null;

export function definirToken(token: string | null): void {
  tokenAtual = token;
}

export function definirAoSessaoInvalida(fn: AoSessaoInvalida | null): void {
  aoSessaoInvalida = fn;
}

/** 403 da API para vinculo bloqueado: "Acesso revogado. Entre novamente." */
function ehAcessoRevogado(status: number, mensagem: string | undefined): boolean {
  if (status !== 403 || !mensagem) return false;
  const normalizada = mensagem
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalizada.includes('acesso revogado');
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Opcoes {
  body?: unknown;
  /** false para rotas publicas (ex.: /auth/login). Padrao: true. */
  autenticado?: boolean;
}

/**
 * Faz a requisicao, valida o envelope `{sucesso, mensagem, dados}` e devolve `dados`.
 * Lanca ApiError com a `mensagem` quando `sucesso=false` ou status >= 400.
 * Em 401 com token enviado, ou 403 "Acesso revogado", encerra a sessao (volta ao login).
 * Outros 403 (ex.: "Vinculo nao encontrado ou inativo") apenas lancam o erro.
 */
export async function requisicao<T>(metodo: Metodo, caminho: string, opcoes: Opcoes = {}): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError('EXPO_PUBLIC_API_URL não configurada. Veja o arquivo .env.example.', 0);
  }

  const autenticado = opcoes.autenticado ?? true;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opcoes.body !== undefined) headers['Content-Type'] = 'application/json';
  const tokenEnviado = autenticado ? tokenAtual : null;
  if (tokenEnviado) headers.Authorization = `Bearer ${tokenEnviado}`;

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_URL}${caminho.startsWith('/') ? caminho : `/${caminho}`}`, {
      method: metodo,
      headers,
      body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined,
      signal: controle.signal,
    });
  } catch (e) {
    const abortado = e instanceof Error && e.name === 'AbortError';
    throw new ApiError(
      abortado
        ? 'O servidor demorou para responder. Tente novamente.'
        : 'Não foi possível conectar ao servidor. Verifique sua internet.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await resposta.json()) as Envelope<T>;
  } catch {
    envelope = null;
  }

  // So encerra se o token enviado ainda for o atual (ignora respostas atrasadas de um token
  // ja substituido por login ou troca de contexto).
  if (tokenEnviado && tokenEnviado === tokenAtual && aoSessaoInvalida) {
    if (resposta.status === 401) {
      aoSessaoInvalida(null);
    } else if (ehAcessoRevogado(resposta.status, envelope?.mensagem)) {
      aoSessaoInvalida(envelope?.mensagem || MENSAGEM_ACESSO_REVOGADO);
    }
  }

  if (!envelope || typeof envelope.sucesso !== 'boolean') {
    throw new ApiError(`Resposta inválida do servidor (HTTP ${resposta.status}).`, resposta.status);
  }

  if (!envelope.sucesso || resposta.status >= 400) {
    throw new ApiError(envelope.mensagem || `Erro na requisição (HTTP ${resposta.status}).`, resposta.status);
  }

  return envelope.dados as T;
}

export const api = {
  get: <T>(caminho: string) => requisicao<T>('GET', caminho),
  post: <T>(caminho: string, body?: unknown, autenticado = true) =>
    requisicao<T>('POST', caminho, { body, autenticado }),
  put: <T>(caminho: string, body?: unknown) => requisicao<T>('PUT', caminho, { body }),
  patch: <T>(caminho: string, body?: unknown) => requisicao<T>('PATCH', caminho, { body }),
  delete: <T>(caminho: string) => requisicao<T>('DELETE', caminho),
};

/** Texto amigavel para qualquer erro capturado. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'Ocorreu um erro inesperado.';
}
