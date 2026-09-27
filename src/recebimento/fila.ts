import type { Encomenda } from '../api/types';
import type { ContextoFila, ItemFila } from './tipos';

/** Onde a fila e gravada. Injetada para permitir testar a fila sem AsyncStorage/arquivos. */
export interface PersistenciaFila {
  carregar(): Promise<ItemFila[]>;
  salvar(itens: readonly ItemFila[]): Promise<void>;
  /** Apaga os arquivos locais (foto e/ou miniatura) informados. Nunca lanca. */
  apagarArquivos(arquivos: Pick<ItemFila, 'arquivo' | 'miniatura'>): void;
}

/** Itens enviados e ja identificados saem da fila depois deste tempo. */
export const RETENCAO_ENVIADOS_MS = 24 * 60 * 60 * 1000;

type Parcial = Partial<Omit<ItemFila, 'uuid'>>;
type Alteracao = Parcial | ((item: ItemFila) => Parcial);

/**
 * Fila local de recebimento: estado em memoria + persistencia serializada.
 * `obterTodos()` devolve um array imutavel (nova referencia a cada mudanca), pronto para
 * `useSyncExternalStore`.
 */
export class FilaRecebimento {
  private itens: readonly ItemFila[] = [];
  private readonly ouvintes = new Set<() => void>();
  private carregamento: Promise<void> | null = null;
  private gravando: Promise<void> | null = null;
  private sujo = false;

  constructor(
    private readonly persistencia: PersistenciaFila,
    private readonly agora: () => number = Date.now,
  ) {}

  /**
   * Carrega a fila salva (uma vez). Itens que estavam 'enviando' quando o app fechou voltam
   * para 'na_fila' (reenviar e seguro: a API e idempotente pelo cliente_uuid). Itens enviados
   * e identificados ha mais de 24 h sao descartados.
   */
  carregar(): Promise<void> {
    if (!this.carregamento) {
      this.carregamento = (async () => {
        let salvos: ItemFila[] = [];
        try {
          salvos = await this.persistencia.carregar();
        } catch {
          salvos = [];
        }
        const limite = this.agora() - RETENCAO_ENVIADOS_MS;
        const mantidos: ItemFila[] = [];
        for (const item of salvos) {
          if (item.estado === 'enviado' && !estaPendente(item) && Date.parse(item.criado_em) < limite) {
            this.persistencia.apagarArquivos(item);
            continue;
          }
          mantidos.push(item.estado === 'enviando' ? { ...item, estado: 'na_fila' } : item);
        }
        // Itens capturados antes de o carregamento terminar ficam no fim.
        const salvosUuids = new Set(mantidos.map((m) => m.uuid));
        this.itens = [...mantidos, ...this.itens.filter((n) => !salvosUuids.has(n.uuid))];
        this.mudou();
      })();
    }
    return this.carregamento;
  }

  obterTodos = (): readonly ItemFila[] => this.itens;

  obter(uuid: string): ItemFila | undefined {
    return this.itens.find((i) => i.uuid === uuid);
  }

  assinar = (ouvinte: () => void): (() => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  adicionar(item: ItemFila): void {
    this.itens = [...this.itens, item];
    this.mudou();
  }

  /** Aplica a alteracao se o item existir e devolve o item atualizado. */
  atualizar(uuid: string, alteracao: Alteracao): ItemFila | undefined {
    let atualizado: ItemFila | undefined;
    this.itens = this.itens.map((i) => {
      if (i.uuid !== uuid) return i;
      const parcial = typeof alteracao === 'function' ? alteracao(i) : alteracao;
      atualizado = { ...i, ...parcial, uuid: i.uuid };
      return atualizado;
    });
    if (atualizado) this.mudou();
    return atualizado;
  }

  /** Tira o item da fila e apaga os arquivos dele. */
  remover(uuid: string): void {
    const item = this.obter(uuid);
    if (!item) return;
    this.persistencia.apagarArquivos(item);
    this.itens = this.itens.filter((i) => i.uuid !== uuid);
    this.mudou();
  }

  /** Apaga a foto grande (mantem a miniatura) quando ela nao e mais necessaria. */
  liberarFoto(uuid: string): void {
    const item = this.obter(uuid);
    if (!item?.arquivo) return;
    this.persistencia.apagarArquivos({ arquivo: item.arquivo, miniatura: null });
    this.atualizar(uuid, { arquivo: null });
  }

  /**
   * Atualiza as respostas com a lista de GET /encomendas/recentes (casando por cliente_uuid
   * ou id). Devolve os itens que deixaram de estar pendentes.
   */
  aplicarRecentes(encomendas: readonly Encomenda[], ctx: ContextoFila): ItemFila[] {
    const porUuid = new Map(encomendas.map((e) => [e.cliente_uuid, e]));
    const porId = new Map(encomendas.map((e) => [e.id, e]));
    const resolvidos: ItemFila[] = [];
    for (const item of this.itens) {
      if (item.estado !== 'enviado' || !item.resposta || !doContexto(item, ctx)) continue;
      const nova = porUuid.get(item.uuid) ?? porId.get(item.resposta.id);
      if (!nova || mesmaEncomenda(item.resposta, nova)) continue;
      const estavaPendente = item.resposta.status === 'PENDENTE_IDENT';
      const atualizado = this.atualizar(item.uuid, { resposta: nova });
      if (atualizado && estavaPendente && nova.status !== 'PENDENTE_IDENT') resolvidos.push(atualizado);
    }
    return resolvidos;
  }

  private mudou(): void {
    for (const ouvinte of this.ouvintes) ouvinte();
    void this.persistir();
  }

  /** Uma gravacao por vez; mudancas durante a gravacao geram mais uma gravacao no fim. */
  private async persistir(): Promise<void> {
    this.sujo = true;
    if (this.gravando) return;
    this.gravando = (async () => {
      try {
        while (this.sujo) {
          this.sujo = false;
          try {
            await this.persistencia.salvar(this.itens);
          } catch {
            // Falha ao gravar: tenta de novo na proxima mudanca.
          }
        }
      } finally {
        this.gravando = null;
      }
    })();
    await this.gravando;
  }
}

// ---- Seletores (funcoes puras) ----

export function doContexto(item: ItemFila, ctx: ContextoFila | null): boolean {
  return !!ctx && item.usuario_id === ctx.usuario_id && item.condominio_id === ctx.condominio_id;
}

/** Enviada, mas ainda sem unidade (o porteiro resolve ou a IA tenta depois). */
export function estaPendente(item: ItemFila): boolean {
  return item.estado === 'enviado' && item.resposta?.status === 'PENDENTE_IDENT';
}

/** Itens do contexto, mais recentes primeiro. */
export function itensDoContexto(itens: readonly ItemFila[], ctx: ContextoFila | null): ItemFila[] {
  return itens.filter((i) => doContexto(i, ctx)).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

/** Proximo item a enviar: o 'na_fila' mais antigo do contexto (FIFO). */
export function proximoParaEnviar(itens: readonly ItemFila[], ctx: ContextoFila | null): ItemFila | undefined {
  let proximo: ItemFila | undefined;
  for (const i of itens) {
    if (i.estado !== 'na_fila' || !doContexto(i, ctx)) continue;
    if (!proximo || i.criado_em < proximo.criado_em) proximo = i;
  }
  return proximo;
}

/** Itens do contexto ainda nao entregues a API (processando, na fila ou enviando). */
export function contarNaoEnviados(itens: readonly ItemFila[], ctx: ContextoFila | null): number {
  return itens.filter((i) => doContexto(i, ctx) && i.estado !== 'enviado' && i.estado !== 'erro').length;
}

function mesmaEncomenda(a: Encomenda, b: Encomenda): boolean {
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.unidade_id === b.unidade_id &&
    a.unidade_descricao === b.unidade_descricao &&
    a.nome_destinatario === b.nome_destinatario &&
    a.transportadora === b.transportadora &&
    a.metodo_ident === b.metodo_ident
  );
}
