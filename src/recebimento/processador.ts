import { ApiError, mensagemDeErro } from '../api/client';
import type { Encomenda, NovaEncomendaRequisicao } from '../api/types';
import { doContexto, proximoParaEnviar, type FilaRecebimento } from './fila';
import type { ContextoFila, ItemFila } from './tipos';

/** Espera base e maxima entre tentativas depois de falha de rede/servidor. */
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAXIMO_MS = 60_000;

/** 2 s, 4 s, 8 s, 16 s, 32 s, 60 s, 60 s... */
export function calcularBackoff(falhasSeguidas: number): number {
  if (falhasSeguidas <= 0) return 0;
  return Math.min(BACKOFF_MAXIMO_MS, BACKOFF_BASE_MS * 2 ** (falhasSeguidas - 1));
}

/**
 * 'definitivo': a API recusou o conteudo (400 validacao, 409 uuid de outro condominio, 413...).
 * Reenviar nao adianta: o item vai para 'erro' com a mensagem e o porteiro descarta.
 * 'retentar': sem rede, timeout, 5xx, 429, 401/403 (a sessao e tratada pelo cliente HTTP).
 */
export function classificarErro(e: unknown): 'definitivo' | 'retentar' {
  if (!(e instanceof ApiError)) return 'retentar';
  const s = e.status;
  if (s === 0 || s === 401 || s === 403 || s === 408 || s === 429 || s >= 500) return 'retentar';
  if (s >= 400) return 'definitivo';
  return 'retentar';
}

export interface DependenciasProcessador {
  enviar(corpo: NovaEncomendaRequisicao): Promise<Encomenda>;
  lerBase64(arquivo: string): Promise<string>;
  arquivoExiste(arquivo: string): boolean;
  agora?: () => number;
}

/**
 * Envia a fila em segundo plano, um item por vez (o mais antigo primeiro), so os do contexto
 * atual (usuario + condominio). Em erro de rede/5xx espera com backoff exponencial;
 * `acordar()` (reconexao, volta ao primeiro plano, item novo) tenta de imediato.
 */
export class ProcessadorEnvio {
  private ctx: ContextoFila | null = null;
  private enviando = false;
  private falhasSeguidas = 0;
  private esperarAte = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** acordar() chamado durante um envio: a espera gerada por esse envio e ignorada. */
  private acordadoDuranteEnvio = false;
  private readonly agora: () => number;

  constructor(
    private readonly fila: FilaRecebimento,
    private readonly deps: DependenciasProcessador,
  ) {
    this.agora = deps.agora ?? Date.now;
  }

  /** Define o contexto da sessao (null para parar). Trocar o contexto zera a espera. */
  definirContexto(ctx: ContextoFila | null): void {
    const mudou = ctx?.usuario_id !== this.ctx?.usuario_id || ctx?.condominio_id !== this.ctx?.condominio_id;
    this.ctx = ctx;
    if (!ctx) {
      this.limparTimer();
      return;
    }
    if (mudou) this.acordar();
  }

  /**
   * Tenta enviar agora. `ignorarEspera=true` (padrao) descarta o backoff em curso: use ao
   * reconectar ou voltar ao primeiro plano.
   */
  acordar(ignorarEspera = true): void {
    if (ignorarEspera) {
      this.esperarAte = 0;
      this.falhasSeguidas = 0;
      if (this.enviando) this.acordadoDuranteEnvio = true;
    }
    this.limparTimer();
    void this.ciclo();
  }

  private limparTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private agendar(ms: number): void {
    this.limparTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.ciclo();
    }, ms);
  }

  private async ciclo(): Promise<void> {
    while (this.ctx && !this.enviando) {
      const falta = this.esperarAte - this.agora();
      if (falta > 0) {
        this.agendar(falta);
        return;
      }
      const item = proximoParaEnviar(this.fila.obterTodos(), this.ctx);
      if (!item) return;
      this.enviando = true;
      this.acordadoDuranteEnvio = false;
      try {
        await this.enviarItem(item);
      } finally {
        this.enviando = false;
      }
      if (this.acordadoDuranteEnvio) {
        this.acordadoDuranteEnvio = false;
        this.esperarAte = 0;
        this.falhasSeguidas = 0;
      }
    }
  }

  private async enviarItem(item: ItemFila): Promise<void> {
    const { uuid } = item;
    if (!item.arquivo || !this.deps.arquivoExiste(item.arquivo)) {
      this.fila.atualizar(uuid, { estado: 'erro', ultimo_erro: 'A foto não foi encontrada no aparelho. Fotografe de novo.' });
      return;
    }

    this.fila.atualizar(uuid, { estado: 'enviando' });
    let fotoBase64: string;
    try {
      fotoBase64 = await this.deps.lerBase64(item.arquivo);
    } catch {
      this.fila.atualizar(uuid, { estado: 'erro', ultimo_erro: 'Não foi possível ler a foto no aparelho. Fotografe de novo.' });
      return;
    }

    try {
      const encomenda = await this.deps.enviar({
        cliente_uuid: uuid,
        foto_base64: fotoBase64,
        texto_ocr: item.texto_ocr || undefined,
      });
      this.falhasSeguidas = 0;
      this.esperarAte = 0;
      this.fila.atualizar(uuid, (i) => ({
        estado: 'enviado',
        tentativas: i.tentativas + 1,
        ultimo_erro: null,
        resposta: encomenda,
      }));
      // Identificada: a foto ja esta no servidor. Pendente: mantem para a resolucao manual.
      if (encomenda.status !== 'PENDENTE_IDENT') this.fila.liberarFoto(uuid);
    } catch (e) {
      const mensagem = mensagemDeErro(e);
      if (classificarErro(e) === 'definitivo') {
        this.fila.atualizar(uuid, (i) => ({ estado: 'erro', tentativas: i.tentativas + 1, ultimo_erro: mensagem }));
        return;
      }
      this.fila.atualizar(uuid, (i) => ({ estado: 'na_fila', tentativas: i.tentativas + 1, ultimo_erro: mensagem }));
      // Contexto trocado durante o envio: o novo contexto nao herda a espera.
      if (!doContexto(item, this.ctx)) return;
      this.falhasSeguidas += 1;
      this.esperarAte = this.agora() + calcularBackoff(this.falhasSeguidas);
    }
  }
}
