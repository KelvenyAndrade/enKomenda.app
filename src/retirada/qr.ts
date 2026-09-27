// Leitura do QR de retirada do morador. Funcoes puras (sem React/nativo), testaveis isoladamente.
//
// Payload (API-Endpoints-Porteiro.md, "Payload do QR"):
//   ENK1:<condominio_id>:<codigo>[,<codigo>...]      ex.: ENK1:12:483920,105776

export const PREFIXO_QR = 'ENK1:';

/** Janela em que o mesmo QR e ignorado depois de lido (evita baixa em dobro). */
export const JANELA_REPETICAO_MS = 5_000;

const FORMATO_QR = /^ENK1:(\d{1,10}):(\d{6}(?:,\d{6})*)$/;

export type LeituraQR =
  /** QR do enKomenda no formato esperado. `texto` e o payload a enviar para a API. */
  | { tipo: 'valido'; texto: string; condominioId: number; codigos: string[] }
  /** Comeca com ENK1: mas foge do formato (a API decide: normalmente 400 "QR invalido"). */
  | { tipo: 'malformado'; texto: string }
  /** Nao e do enKomenda (URL, Pix, outro app...): nao chama a API. */
  | { tipo: 'estranho' };

/** Interpreta o texto lido pela camera. Espacos nas pontas e quebras de linha sao ignorados. */
export function lerPayloadQR(bruto: string | null | undefined): LeituraQR {
  const texto = (bruto ?? '').replace(/\s+/g, '');
  if (!texto.toUpperCase().startsWith(PREFIXO_QR)) return { tipo: 'estranho' };
  // Prefixo em maiusculas (alguns leitores alteram a caixa); o resto sao so digitos.
  const normalizado = PREFIXO_QR + texto.slice(PREFIXO_QR.length);
  const m = FORMATO_QR.exec(normalizado);
  if (!m) return { tipo: 'malformado', texto: normalizado };
  const codigos = Array.from(new Set(m[2].split(',')));
  return { tipo: 'valido', texto: normalizado, condominioId: Number(m[1]), codigos };
}

export type DecisaoQR =
  | { acao: 'enviar'; qr: string }
  /** Erro conhecido sem precisar da API (ex.: QR de outro condominio). */
  | { acao: 'recusar'; mensagem: string }
  /** Nao e do enKomenda: so um aviso curto na camera. */
  | { acao: 'avisar'; mensagem: string };

export const AVISO_QR_ESTRANHO = 'Este QR não é do enKomenda.';
export const MENSAGEM_OUTRO_CONDOMINIO = 'QR de outro condomínio.';

/** O que fazer com a leitura, dado o condominio da sessao. */
export function decidirQR(leitura: LeituraQR, condominioAtual: number | null | undefined): DecisaoQR {
  switch (leitura.tipo) {
    case 'estranho':
      return { acao: 'avisar', mensagem: AVISO_QR_ESTRANHO };
    case 'malformado':
      return { acao: 'enviar', qr: leitura.texto };
    case 'valido':
      if (condominioAtual != null && leitura.condominioId !== condominioAtual) {
        return { acao: 'recusar', mensagem: MENSAGEM_OUTRO_CONDOMINIO };
      }
      return { acao: 'enviar', qr: leitura.texto };
  }
}

/**
 * Trava de repeticao do leitor: o mesmo valor so e aceito de novo depois de ficar
 * `janelaMs` sem ser visto. Cada leitura (aceita ou nao) renova o instante, entao um QR
 * mantido na frente da camera nunca e enviado duas vezes.
 */
export class FiltroRepeticao {
  private ultimo: string | null = null;
  private vistoEm = 0;

  constructor(private readonly janelaMs = JANELA_REPETICAO_MS) {}

  /** true se o valor deve ser processado agora. */
  aceitar(valor: string, agora: number = Date.now()): boolean {
    const repetido = valor === this.ultimo && agora - this.vistoEm < this.janelaMs;
    this.ultimo = valor;
    this.vistoEm = agora;
    return !repetido;
  }

  /** Recomeca a janela do ultimo valor (ex.: ao fechar o card, o QR ainda pode estar na frente). */
  renovar(agora: number = Date.now()): void {
    if (this.ultimo !== null) this.vistoEm = agora;
  }

  /** Esquece o ultimo valor (ex.: "Tentar de novo" explicito). */
  limpar(): void {
    this.ultimo = null;
    this.vistoEm = 0;
  }
}

/** Primeiro valor utilizavel entre os codigos lidos num quadro (prefere o do enKomenda). */
export function escolherValor(valores: (string | null | undefined)[]): string | null {
  const validos = valores.filter((v): v is string => !!v && v.trim().length > 0);
  return validos.find((v) => v.replace(/\s+/g, '').toUpperCase().startsWith(PREFIXO_QR)) ?? validos[0] ?? null;
}
