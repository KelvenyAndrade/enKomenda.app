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

// Token atual e callback de 401, registrados pelo SessionProvider.
let tokenAtual: string | null = null;
let aoNaoAutorizado: (() => void) | null = null;

export function definirToken(token: string | null): void {
  tokenAtual = token;
}

export function definirAoNaoAutorizado(fn: (() => void) | null): void {
  aoNaoAutorizado = fn;
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
 * Em 401 com token enviado, limpa a sessao (volta ao login).
 */
export async function requisicao<T>(metodo: Metodo, caminho: string, opcoes: Opcoes = {}): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError('EXPO_PUBLIC_API_URL não configurada. Veja o arquivo .env.example.', 0);
  }

  const autenticado = opcoes.autenticado ?? true;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opcoes.body !== undefined) headers['Content-Type'] = 'application/json';
  const enviouToken = autenticado && !!tokenAtual;
  if (enviouToken) headers.Authorization = `Bearer ${tokenAtual}`;

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

  if (resposta.status === 401 && enviouToken && aoNaoAutorizado) {
    aoNaoAutorizado();
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
