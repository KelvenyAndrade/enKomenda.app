import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { eu as apiEu, login as apiLogin, trocarContexto as apiTrocarContexto } from '../api/auth';
import { definirAoSessaoInvalida, definirToken } from '../api/client';
import type { Vinculo } from '../api/types';
import { carregarSessao, limparSessao, salvarSessao, type Sessao } from './storage';

/** Intervalo minimo entre duas revalidacoes (GET /auth/eu). */
const INTERVALO_REVALIDACAO_MS = 30_000;

interface SessionValue {
  /** true enquanto a sessao salva esta sendo restaurada na abertura do app. */
  carregando: boolean;
  sessao: Sessao | null;
  /** Mensagem para a tela de login quando a sessao foi encerrada pelo servidor (ex.: acesso revogado). */
  aviso: string | null;
  entrar: (login: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  /** POST /auth/contexto com o vinculo escolhido; grava a sessao com o token novo. */
  escolherVinculo: (vinculo: Vinculo) => Promise<void>;
  /** Abre a escolha de vinculo a partir de uma tela do perfil (pode ser cancelada). */
  iniciarTrocaDeVinculo: () => Promise<void>;
  /** Fecha a escolha aberta por iniciarTrocaDeVinculo, mantendo o contexto atual. */
  cancelarTrocaDeVinculo: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Copia sincrona da sessao para callbacks assincronos (revalidacao, AppState).
  const sessaoRef = useRef<Sessao | null>(null);
  const revalidandoRef = useRef<Promise<void> | null>(null);
  const ultimaRevalidacaoRef = useRef(0);

  const definirSessao = useCallback((nova: Sessao | null) => {
    sessaoRef.current = nova;
    definirToken(nova?.token ?? null);
    setSessao(nova);
  }, []);

  const aplicar = useCallback(
    async (nova: Sessao | null) => {
      definirSessao(nova);
      if (nova) await salvarSessao(nova);
      else await limparSessao();
    },
    [definirSessao],
  );

  const sair = useCallback(async () => {
    setAviso(null);
    await aplicar(null);
  }, [aplicar]);

  /**
   * GET /auth/eu: atualiza usuario, contexto e vinculos. No maximo 1 chamada a cada 30 s e
   * nunca duas ao mesmo tempo. Falha de rede nao derruba a sessao (o porteiro pode estar
   * offline); 401/403 de acesso revogado ja encerram a sessao no cliente HTTP.
   */
  const revalidar = useCallback(async () => {
    const atual = sessaoRef.current;
    if (!atual || revalidandoRef.current) return;
    if (Date.now() - ultimaRevalidacaoRef.current < INTERVALO_REVALIDACAO_MS) return;
    ultimaRevalidacaoRef.current = Date.now();

    const tokenUsado = atual.token;
    const tarefa = (async () => {
      try {
        const r = await apiEu();
        const agora = sessaoRef.current;
        // Sessao trocada (login, troca de contexto ou saida) durante a chamada: descarta.
        if (!agora || agora.token !== tokenUsado) return;
        const vinculos = r.vinculos ?? [];
        await aplicar({
          ...agora,
          usuario: r.usuario,
          contexto: r.contexto,
          vinculos,
          escolhaPendente: agora.escolhaPendente && vinculos.length > 1,
          trocaVoluntaria: agora.trocaVoluntaria && vinculos.length > 1,
        });
      } catch {
        // Offline/timeout/erro do servidor: mantem a sessao local.
      } finally {
        revalidandoRef.current = null;
      }
    })();
    revalidandoRef.current = tarefa;
    await tarefa;
  }, [aplicar]);

  // Restaura a sessao salva ao abrir o app e revalida no servidor.
  useEffect(() => {
    let ativo = true;
    carregarSessao().then((salva) => {
      if (!ativo) return;
      definirSessao(salva);
      setCarregando(false);
      if (salva) void revalidar();
    });
    return () => {
      ativo = false;
    };
  }, [definirSessao, revalidar]);

  // Revalida sempre que o app volta ao primeiro plano.
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void revalidar();
    });
    return () => assinatura.remove();
  }, [revalidar]);

  // 401 ou 403 "Acesso revogado": limpa a sessao; o roteamento volta para o login.
  useEffect(() => {
    definirAoSessaoInvalida((mensagem) => {
      setAviso(mensagem);
      void aplicar(null);
    });
    return () => definirAoSessaoInvalida(null);
  }, [aplicar]);

  const entrar = useCallback(
    async (loginInformado: string, senha: string) => {
      const r = await apiLogin(loginInformado, senha);
      const vinculos = r.vinculos ?? [];
      setAviso(null);
      // Sessao acabou de vir do servidor: nao precisa revalidar logo em seguida.
      ultimaRevalidacaoRef.current = Date.now();
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
      const tokenUsado = sessaoRef.current?.token;
      if (!tokenUsado) return;
      const r = await apiTrocarContexto(v);
      // Sessao encerrada ou substituida enquanto a troca estava em andamento.
      if (sessaoRef.current?.token !== tokenUsado) return;
      ultimaRevalidacaoRef.current = Date.now();
      await aplicar({
        token: r.token,
        expira_em: r.expira_em,
        usuario: r.usuario,
        contexto: r.contexto,
        vinculos: r.vinculos ?? [],
        escolhaPendente: false,
        trocaVoluntaria: false,
      });
    },
    [aplicar],
  );

  const iniciarTrocaDeVinculo = useCallback(async () => {
    const atual = sessaoRef.current;
    if (!atual || atual.vinculos.length < 2) return;
    await aplicar({ ...atual, escolhaPendente: true, trocaVoluntaria: true });
  }, [aplicar]);

  const cancelarTrocaDeVinculo = useCallback(async () => {
    const atual = sessaoRef.current;
    if (!atual?.trocaVoluntaria) return;
    await aplicar({ ...atual, escolhaPendente: false, trocaVoluntaria: false });
  }, [aplicar]);

  const valor = useMemo(
    () => ({
      carregando,
      sessao,
      aviso,
      entrar,
      sair,
      escolherVinculo,
      iniciarTrocaDeVinculo,
      cancelarTrocaDeVinculo,
    }),
    [carregando, sessao, aviso, entrar, sair, escolherVinculo, iniciarTrocaDeVinculo, cancelarTrocaDeVinculo],
  );

  return <SessionContext.Provider value={valor}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession deve ser usado dentro de <SessionProvider>.');
  return ctx;
}
