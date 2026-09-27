import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Botao } from '../../components/Botao';
import { cores } from '../../theme';
import { TAMANHO_CODIGO, acrescentarDigito, codigoCompleto } from '../regras';

interface Props {
  /** Envia o codigo. Retorna false se a baixa foi recusada por ja haver outra em andamento. */
  onEnviar: (codigo: string) => Promise<boolean>;
  ocupado: boolean;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'limpar', '0', 'apagar'] as const;

/** Codigo ditado pelo morador: teclado numerico grande, envia ao completar 6 digitos. */
export function ModoCodigo({ onEnviar, ocupado }: Props) {
  const [codigo, setCodigo] = useState('');

  function enviar(c: string) {
    if (!codigoCompleto(c) || ocupado) return;
    void onEnviar(c).then((aceito) => {
      if (aceito) setCodigo('');
    });
  }

  function tocar(tecla: (typeof TECLAS)[number]) {
    if (ocupado) return;
    void Haptics.selectionAsync();
    if (tecla === 'limpar') return setCodigo('');
    if (tecla === 'apagar') return setCodigo((c) => c.slice(0, -1));
    const novo = acrescentarDigito(codigo, tecla);
    setCodigo(novo);
    if (novo !== codigo && codigoCompleto(novo)) enviar(novo);
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.instrucao}>Digite o código de 6 dígitos do morador</Text>
      <View style={styles.caixas} accessibilityLabel={`Código digitado: ${codigo.split('').join(' ') || 'vazio'}`}>
        {Array.from({ length: TAMANHO_CODIGO }, (_, i) => (
          <View key={i} style={[styles.caixa, i === codigo.length && styles.caixaAtual]}>
            <Text style={styles.digito}>{codigo[i] ?? ''}</Text>
          </View>
        ))}
      </View>

      <View style={styles.teclado}>
        {TECLAS.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityLabel={t === 'limpar' ? 'Limpar' : t === 'apagar' ? 'Apagar' : t}
            disabled={ocupado}
            onPress={() => tocar(t)}
            style={({ pressed }) => [styles.tecla, pressed && styles.teclaPressionada, ocupado && styles.inativa]}
          >
            <Text style={[styles.teclaTexto, t.length > 1 && styles.teclaAcao]}>
              {t === 'limpar' ? 'Limpar' : t === 'apagar' ? '⌫' : t}
            </Text>
          </Pressable>
        ))}
      </View>

      <Botao
        titulo="Confirmar"
        onPress={() => enviar(codigo)}
        carregando={ocupado}
        desabilitado={!codigoCompleto(codigo)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: 16, gap: 14, justifyContent: 'center' },
  instrucao: { fontSize: 16, color: cores.textoSecundario, textAlign: 'center' },
  caixas: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  caixa: {
    width: 46,
    height: 60,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaAtual: { borderColor: cores.primaria },
  digito: { fontSize: 32, fontWeight: '700', color: cores.texto },
  teclado: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tecla: {
    width: '31.5%',
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teclaPressionada: { backgroundColor: '#E8EFFA' },
  inativa: { opacity: 0.5 },
  teclaTexto: { fontSize: 30, fontWeight: '600', color: cores.texto },
  teclaAcao: { fontSize: 18, color: cores.primaria },
});
