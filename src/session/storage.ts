import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { Contexto, Usuario, Vinculo } from '../api/types';

/** Sessao persistida no aparelho. */
export interface Sessao {
  token: string;
  expira_em: string;
  usuario: Usuario;
  contexto: Contexto;
  vinculos: Vinculo[];
  /** true quando ha mais de um vinculo e o usuario ainda nao escolheu qual usar. */
  escolhaPendente: boolean;
  /** true quando a escolha foi aberta pelo usuario ("Trocar condominio/perfil") e pode ser cancelada. */
  trocaVoluntaria?: boolean;
}

// Token e demais dados em chaves separadas (SecureStore tem limite pratico de tamanho por item).
const CHAVE_TOKEN = 'enkomenda.token';
const CHAVE_DADOS = 'enkomenda.sessao';

// expo-secure-store nao existe na web: usa localStorage apenas para desenvolvimento no navegador.
const web = Platform.OS === 'web';

async function ler(chave: string): Promise<string | null> {
  if (web) return typeof localStorage !== 'undefined' ? localStorage.getItem(chave) : null;
  return SecureStore.getItemAsync(chave);
}

async function gravar(chave: string, valor: string): Promise<void> {
  if (web) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(chave, valor);
    return;
  }
  await SecureStore.setItemAsync(chave, valor);
}

async function apagar(chave: string): Promise<void> {
  if (web) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(chave);
    return;
  }
  await SecureStore.deleteItemAsync(chave);
}

export async function salvarSessao(sessao: Sessao): Promise<void> {
  const { token, ...dados } = sessao;
  await gravar(CHAVE_TOKEN, token);
  await gravar(CHAVE_DADOS, JSON.stringify(dados));
}

export async function carregarSessao(): Promise<Sessao | null> {
  try {
    const token = await ler(CHAVE_TOKEN);
    const bruto = await ler(CHAVE_DADOS);
    if (!token || !bruto) return null;
    const dados = JSON.parse(bruto) as Omit<Sessao, 'token'>;
    if (!dados?.usuario || !dados?.contexto) return null;
    // Token vencido: descarta (o servidor tambem responderia 401).
    const expira = Date.parse(dados.expira_em);
    if (!Number.isNaN(expira) && expira <= Date.now()) {
      await limparSessao();
      return null;
    }
    return { token, ...dados, vinculos: dados.vinculos ?? [] };
  } catch {
    return null;
  }
}

export async function limparSessao(): Promise<void> {
  try {
    await apagar(CHAVE_TOKEN);
    await apagar(CHAVE_DADOS);
  } catch {
    // ignora: nada a fazer se o armazenamento falhar ao apagar
  }
}
