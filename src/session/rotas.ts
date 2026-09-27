import type { Perfil } from '../api/types';
import type { Sessao } from './storage';

/** Tela inicial de cada perfil (grupos do expo-router em src/app). */
export const ROTA_DO_PERFIL: Record<Perfil, '/receber' | '/encomendas' | '/resumo'> = {
  PORTEIRO: '/receber',
  MORADOR: '/encomendas',
  SINDICO: '/resumo',
};

/** Para onde o usuario deve ir de acordo com o estado da sessao. */
export function rotaPara(sessao: Sessao | null) {
  if (!sessao) return '/login' as const;
  if (sessao.escolhaPendente) return '/escolher-vinculo' as const;
  return ROTA_DO_PERFIL[sessao.contexto.perfil] ?? ('/login' as const);
}

export const NOME_DO_PERFIL: Record<Perfil, string> = {
  PORTEIRO: 'Porteiro',
  MORADOR: 'Morador',
  SINDICO: 'Síndico',
};
