import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mensagemDeErro } from '../api/client';
import { Botao } from '../components/Botao';
import { useSession } from '../session/SessionContext';
import { rotaPara } from '../session/rotas';
import { cores } from '../theme';

export default function Login() {
  const { sessao, entrar } = useSession();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const senhaRef = useRef<TextInput>(null);

  // Ja autenticado: segue para a area correta.
  if (sessao) return <Redirect href={rotaPara(sessao)} />;

  async function onEntrar() {
    const l = login.trim();
    if (!l || !senha) {
      setErro('Informe o e-mail ou telefone e a senha.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await entrar(l, senha);
      // O redirecionamento acontece pelo Redirect acima quando a sessao muda.
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.cabecalho}>
            <Text style={styles.marca}>enKomenda</Text>
            <Text style={styles.subtitulo}>Gestão de encomendas do condomínio</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.rotulo}>E-mail ou telefone</Text>
            <TextInput
              style={styles.input}
              value={login}
              onChangeText={setLogin}
              placeholder="seu@email.com ou (11) 99999-9999"
              placeholderTextColor={cores.desabilitado}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => senhaRef.current?.focus()}
              editable={!enviando}
            />

            <Text style={styles.rotulo}>Senha</Text>
            <TextInput
              ref={senhaRef}
              style={styles.input}
              value={senha}
              onChangeText={setSenha}
              placeholder="Sua senha"
              placeholderTextColor={cores.desabilitado}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={onEntrar}
              editable={!enviando}
            />

            {erro ? (
              <View style={styles.erroCaixa} accessibilityLiveRegion="polite">
                <Text style={styles.erroTexto}>{erro}</Text>
              </View>
            ) : null}

            <Botao titulo="Entrar" onPress={onEntrar} carregando={enviando} />
          </View>

          {/* Primeiro acesso do morador (OTP por WhatsApp) entra na Fase 5. */}
          <View style={styles.primeiroAcesso}>
            <Botao titulo="Primeiro acesso" variante="secundario" desabilitado onPress={() => {}} />
            <Text style={styles.emBreve}>Morador sem conta: disponível em breve</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cores.fundo },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 28 },
  cabecalho: { alignItems: 'center', gap: 6 },
  marca: { fontSize: 34, fontWeight: '800', color: cores.primaria },
  subtitulo: { fontSize: 15, color: cores.textoSecundario, textAlign: 'center' },
  form: { gap: 10 },
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.texto, marginTop: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: cores.texto,
    backgroundColor: cores.superficie,
  },
  erroCaixa: { backgroundColor: cores.erroFundo, borderRadius: 8, padding: 12, marginTop: 6 },
  erroTexto: { color: cores.erro, fontSize: 14 },
  primeiroAcesso: { gap: 6, alignItems: 'stretch' },
  emBreve: { fontSize: 13, color: cores.textoSecundario, textAlign: 'center' },
});
