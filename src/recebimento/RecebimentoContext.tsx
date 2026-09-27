import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';

import { definirUnidade, listarRecentes, registrarEncomenda } from '../api/encomendas';
import { useSession } from '../session/SessionContext';
import { arquivoExiste, lerBase64, paraUri, persistenciaAparelho } from './armazenamento';
import { FilaRecebimento, contarNaoEnviados, estaPendente, itensDoContexto } from './fila';
import { PreparadorFotos } from './processamentoFoto';
import { ProcessadorEnvio } from './processador';
import type { ContextoFila, ItemFila } from './tipos';

// Singletons do modulo: a fila e o envio sobrevivem a remontagens da tela/area.
const fila = new FilaRecebimento(persistenciaAparelho);
const processador = new ProcessadorEnvio(fila, {
  enviar: registrarEncomenda,
  lerBase64,
  arquivoExiste,
});
const preparador = new PreparadorFotos(fila, () => processador.acordar(false));

interface RecebimentoValue {
  /** Itens do usuario/condominio atual, mais recentes primeiro. */
  itens: ItemFila[];
  /** Itens ainda nao entregues a API. */
  naoEnviados: number;
  /** Enviados que continuam sem unidade (PENDENTE_IDENT). */
  pendentes: number;
  /** false quando o aparelho esta sem internet (NetInfo). */
  online: boolean;
  /** Registra a foto recem-tirada (caminho da camera) e devolve na hora; o resto roda em segundo plano. */
  registrarFoto: (caminho: string) => void;
  /** Tira o item da fila (erro definitivo) e apaga os arquivos. */
  descartar: (uuid: string) => void;
  /** PATCH /encomendas/{id}/unidade e atualiza o item. */
  resolverUnidade: (uuid: string, unidadeId: number, nomeDestinatario?: string) => Promise<void>;
  /** GET /encomendas/recentes e atualiza os itens enviados (IA do servidor pode ter resolvido). */
  atualizarRecentes: () => Promise<void>;
}

const RecebimentoContext = createContext<RecebimentoValue | null>(null);

/** Fila de recebimento da area do porteiro: carrega, processa e envia em segundo plano. */
export function RecebimentoProvider({ children }: { children: ReactNode }) {
  const { sessao } = useSession();
  const usuarioId = sessao?.usuario.id;
  const condominioId = sessao?.contexto.condominio_id;
  const ctx = useMemo<ContextoFila | null>(
    () => (usuarioId != null && condominioId != null ? { usuario_id: usuarioId, condominio_id: condominioId } : null),
    [usuarioId, condominioId],
  );

  const todos = useSyncExternalStore(fila.assinar, fila.obterTodos, fila.obterTodos);
  const [online, setOnline] = useState(true);

  // Carrega a fila salva, retoma o processamento e liga o envio para o contexto atual.
  useEffect(() => {
    let ativo = true;
    void fila.carregar().then(() => {
      if (!ativo) return;
      preparador.retomarPendentes();
      processador.definirContexto(ctx);
    });
    return () => {
      ativo = false;
      processador.definirContexto(null);
    };
  }, [ctx]);

  // Reconexao: reenvia na hora (sem esperar o backoff).
  useEffect(() => {
    let estavaOnline = true;
    return NetInfo.addEventListener((estado) => {
      const agora = estado.isConnected !== false && estado.isInternetReachable !== false;
      setOnline(agora);
      if (agora && !estavaOnline) processador.acordar();
      estavaOnline = agora;
    });
  }, []);

  // Voltou ao primeiro plano: reenvia na hora.
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') processador.acordar();
    });
    return () => assinatura.remove();
  }, []);

  const itens = useMemo(() => itensDoContexto(todos, ctx), [todos, ctx]);
  const naoEnviados = useMemo(() => contarNaoEnviados(todos, ctx), [todos, ctx]);
  const pendentes = useMemo(() => itens.filter(estaPendente).length, [itens]);

  const registrarFoto = useCallback(
    (caminho: string) => {
      if (!ctx) return;
      const uuid = Crypto.randomUUID();
      fila.adicionar({
        uuid,
        usuario_id: ctx.usuario_id,
        condominio_id: ctx.condominio_id,
        arquivo: paraUri(caminho),
        miniatura: null,
        texto_ocr: '',
        criado_em: new Date().toISOString(),
        estado: 'processando',
        tentativas: 0,
        ultimo_erro: null,
        resposta: null,
      });
      preparador.agendar(uuid);
    },
    [ctx],
  );

  const descartar = useCallback((uuid: string) => {
    const item = fila.obter(uuid);
    // Nao descarta o que ja esta no meio do envio.
    if (!item || item.estado === 'enviando') return;
    fila.remover(uuid);
  }, []);

  const resolverUnidade = useCallback(async (uuid: string, unidadeId: number, nomeDestinatario?: string) => {
    const item = fila.obter(uuid);
    if (!item?.resposta) throw new Error('Esta encomenda ainda não foi enviada.');
    const nome = nomeDestinatario?.trim();
    const encomenda = await definirUnidade(item.resposta.id, {
      unidade_id: unidadeId,
      ...(nome && nome !== (item.resposta.nome_destinatario ?? '') ? { nome_destinatario: nome } : {}),
    });
    fila.atualizar(uuid, { resposta: encomenda });
    if (encomenda.status !== 'PENDENTE_IDENT') fila.liberarFoto(uuid);
  }, []);

  const atualizarRecentes = useCallback(async () => {
    if (!ctx) return;
    const encomendas = await listarRecentes();
    for (const resolvido of fila.aplicarRecentes(encomendas, ctx)) fila.liberarFoto(resolvido.uuid);
  }, [ctx]);

  const valor = useMemo(
    () => ({ itens, naoEnviados, pendentes, online, registrarFoto, descartar, resolverUnidade, atualizarRecentes }),
    [itens, naoEnviados, pendentes, online, registrarFoto, descartar, resolverUnidade, atualizarRecentes],
  );

  return <RecebimentoContext.Provider value={valor}>{children}</RecebimentoContext.Provider>;
}

export function useRecebimento(): RecebimentoValue {
  const ctx = useContext(RecebimentoContext);
  if (!ctx) throw new Error('useRecebimento deve ser usado dentro de <RecebimentoProvider>.');
  return ctx;
}
