import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';

import type { Perfil } from '../api/types';
import { useSession } from '../session/SessionContext';
import { rotaPara } from '../session/rotas';

/** So renderiza o grupo se a sessao ativa for do perfil informado; senao redireciona. */
export function GuardaPerfil({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  const { sessao } = useSession();
  if (!sessao || sessao.escolhaPendente || sessao.contexto.perfil !== perfil) {
    return <Redirect href={rotaPara(sessao)} />;
  }
  return <>{children}</>;
}
