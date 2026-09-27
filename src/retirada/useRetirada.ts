import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { ApiError, mensagemDeErro } from '../api/client';
import { desfazerRetirada } from '../api/encomendas';
import type { MetodoRetirada, RetiradaResposta } from '../api/types';
import { MENSAGEM_SEM_CONEXAO, desfazerTodas, podeDesfazer, resumirRetirada, type ResumoRetirada } from './regras';

export type EstadoDesfazer =
  | { fase: 'nao' }
  | { fase: 'desfazendo' }
  | { fase: 'desfeita' }
  /** Alguma (ou todas) falhou: mensagem da API (os ids que voltaram saem de `ids`). */
  | { fase: 'falhou'; mensagem: string };

export interface Sucesso {
  metodo: MetodoRetirada;
  resumo: ResumoRetirada;
  /** Ids ainda retirados (desfazer tira daqui os que voltaram a AGUARDANDO). */
  ids: number[];
  /** Instante local da resposta (base do prazo de 15 min para desfazer). */
  instante: number;
  desfazer: EstadoDesfazer;
}

export interface Falha {
  metodo: MetodoRetirada;
  mensagem: string;
  /** HTTP da API (0 = sem resposta: rede, timeout). */
  status: number;
  /** true quando vale repetir a mesma chamada (sem resposta do servidor). */
  podeRepetir: boolean;
}

export type Card = { tipo: 'sucesso'; dados: Sucesso } | { tipo: 'erro'; dados: Falha };

type Chamada = () => Promise<RetiradaResposta>;

/**
 * Estado da baixa (online, nunca enfileirada): uma chamada por vez, card de resultado,
 * repetir apos falha de rede e desfazer em ate 15 min. Feedback haptico em cada desfecho.
 */
export function useRetirada(online: boolean) {
  const [enviando, setEnviando] = useState<MetodoRetirada | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  /** Ultima baixa com sucesso (continua acessivel depois de fechar o card, para desfazer). */
  const [ultima, setUltima] = useState<Sucesso | null>(null);
  const ocupado = useRef(false);
  const ultimaChamada = useRef<{ metodo: MetodoRetirada; chamada: Chamada; aoSucesso?: () => void } | null>(null);

  const falhar = useCallback((metodo: MetodoRetirada, mensagem: string, status: number, podeRepetir: boolean) => {
    setCard({ tipo: 'erro', dados: { metodo, mensagem, status, podeRepetir } });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  /** Mostra um erro sem chamar a API (ex.: QR de outro condominio). */
  const recusar = useCallback(
    (metodo: MetodoRetirada, mensagem: string) => {
      if (ocupado.current) return;
      ultimaChamada.current = null;
      falhar(metodo, mensagem, 400, false);
    },
    [falhar],
  );

  /** Executa a baixa. Retorna false se ja havia uma em andamento (a nova e ignorada). */
  const executar = useCallback(
    async (metodo: MetodoRetirada, chamada: Chamada, aoSucesso?: () => void): Promise<boolean> => {
      if (ocupado.current) return false;
      ultimaChamada.current = { metodo, chamada, aoSucesso };
      if (!online) {
        falhar(metodo, MENSAGEM_SEM_CONEXAO, 0, true);
        return true;
      }
      ocupado.current = true;
      setEnviando(metodo);
      try {
        const resposta = await chamada();
        const resumo = resumirRetirada(resposta);
        const sucesso: Sucesso = {
          metodo,
          resumo,
          ids: resposta.retiradas.map((e) => e.id),
          instante: Date.now(),
          desfazer: { fase: 'nao' },
        };
        setUltima(sucesso);
        setCard({ tipo: 'sucesso', dados: sucesso });
        void Haptics.notificationAsync(
          resumo.naoEncontrados.length > 0
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success,
        );
        aoSucesso?.();
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        falhar(metodo, status === 0 && !online ? MENSAGEM_SEM_CONEXAO : mensagemDeErro(e), status, status === 0);
      } finally {
        ocupado.current = false;
        setEnviando(null);
      }
      return true;
    },
    [online, falhar],
  );

  /** Repete a ultima chamada (depois de falha de rede/timeout). */
  const repetir = useCallback(async () => {
    const ultimaC = ultimaChamada.current;
    if (!ultimaC) return;
    setCard(null);
    await executar(ultimaC.metodo, ultimaC.chamada, ultimaC.aoSucesso);
  }, [executar]);

  /** Desfaz a ultima baixa (cada id retirado), dentro do prazo. */
  const desfazer = useCallback(async () => {
    const alvo = ultima;
    if (!alvo || alvo.ids.length === 0 || alvo.desfazer.fase === 'desfazendo' || ocupado.current) return;
    if (!podeDesfazer(alvo.instante)) {
      const atualizado: Sucesso = { ...alvo, desfazer: { fase: 'falhou', mensagem: 'Prazo para desfazer (15 min) expirou.' } };
      setUltima(atualizado);
      setCard({ tipo: 'sucesso', dados: atualizado });
      return;
    }
    if (!online) {
      const atualizado: Sucesso = { ...alvo, desfazer: { fase: 'falhou', mensagem: MENSAGEM_SEM_CONEXAO } };
      setUltima(atualizado);
      setCard({ tipo: 'sucesso', dados: atualizado });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    ocupado.current = true;
    const emAndamento: Sucesso = { ...alvo, desfazer: { fase: 'desfazendo' } };
    setUltima(emAndamento);
    setCard({ tipo: 'sucesso', dados: emAndamento });
    try {
      const r = await desfazerTodas(alvo.ids, desfazerRetirada, mensagemDeErro);
      const restantes = alvo.ids.filter((id) => !r.desfeitas.includes(id));
      const final: Sucesso = {
        ...alvo,
        ids: restantes,
        desfazer:
          r.erros.length === 0
            ? { fase: 'desfeita' }
            : {
                fase: 'falhou',
                mensagem:
                  r.desfeitas.length > 0
                    ? `${r.desfeitas.length} desfeita(s). Falhou: ${r.erros[0].mensagem}`
                    : r.erros[0].mensagem,
              },
      };
      setUltima(final);
      setCard({ tipo: 'sucesso', dados: final });
      void Haptics.notificationAsync(
        r.erros.length === 0 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      );
    } finally {
      ocupado.current = false;
    }
  }, [ultima, online]);

  const fechar = useCallback(() => setCard(null), []);

  /** Reabre o card da ultima baixa (para desfazer depois de fechar). */
  const reabrirUltima = useCallback(() => {
    if (ultima) setCard({ tipo: 'sucesso', dados: ultima });
  }, [ultima]);

  return { enviando, card, ultima, executar, recusar, repetir, desfazer, fechar, reabrirUltima };
}
