import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { login as apiLogin } from '../api/auth';
import { definirAoNaoAutorizado, definirToken } from '../api/client';
import type { Vinculo } from '../api/types';
import { carregarSessao, limparSessao, salvarSessao, type Sessao } from './storage';

interface SessionValue {
  /** true enquanto a sessao salva esta sendo restaurada na abertura do app. */
  carregando: boolean;
  sessao: Sessao | null;
  entrar: (login: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  escolherVinculo: (vinculo: Vinculo) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Sessao | null>(null);

  const aplicar = useCallback(async (nova: Sessao | null) => {
    definirToken(nova?.token ?? null);
    setSessao(nova);
    if (nova) await salvarSessao(nova);
    else await limparSessao();
  }, []);

  const sair = useCallback(() => aplicar(null), [aplicar]);

  // Restaura a sessao salva ao abrir o app.
  useEffect(() => {
    let ativo = true;
    carregarSessao().then((salva) => {
      if (!ativo) return;
      definirToken(salva?.token ?? null);
      setSessao(salva);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  // 401 em rota autenticada: limpa a sessao; o roteamento volta para o login.
  useEffect(() => {
    definirAoNaoAutorizado(() => {
      void sair();
    });
    return () => definirAoNaoAutorizado(null);
  }, [sair]);

  const entrar = useCallback(
    async (loginInformado: string, senha: string) => {
      const r = await apiLogin(loginInformado, senha);
      const vinculos = r.vinculos ?? [];
      await aplicar({
        token: r.token,
        expira_em: r.expira_em,
        usuario: r.usuario,
        contexto: r.contexto,
        vinculos,
        escolhaPendente: vinculos.length > 1,
      });
    },
    [aplicar],
  );

  const escolherVinculo = useCallback(
    async (v: Vinculo) => {
      if (!sessao) return;
      // TODO (fase seguinte): chamar POST /auth/contexto com o vinculo escolhido e usar o
      // novo token devolvido. Nesta fase a troca e apenas local: o token continua sendo o
      // do contexto padrao do login, entao chamadas a API ainda usarao aquele contexto.
      await aplicar({
        ...sessao,
        contexto: {
          condominio_id: v.condominio_id,
          condominio_nome: v.condominio_nome,
          unidade_id: v.unidade_id,
          perfil: v.perfil,
        },
        escolhaPendente: false,
      });
    },
    [sessao, aplicar],
  );

  const valor = useMemo(
    () => ({ carregando, sessao, entrar, sair, escolherVinculo }),
    [carregando, sessao, entrar, sair, escolherVinculo],
  );

  return <SessionContext.Provider value={valor}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession deve ser usado dentro de <SessionProvider>.');
  return ctx;
}
