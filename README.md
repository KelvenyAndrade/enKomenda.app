# enKomenda - App (Expo)

App único do enKomenda para os três perfis: **porteiro**, **morador** e **síndico**.
Stack: Expo SDK 57 + TypeScript + expo-router (rotas em `src/app/`).

## Como rodar

```cmd
copy .env.example .env
npm install
npx expo start
```

Abra no Expo Go (Android/iOS) pelo QR code, ou pressione `w` para o navegador.

### Variáveis de ambiente

| Variável | Exemplo | Uso |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://api.kds.com.br:9210/api/v1` | Base da API REST (sem barra final) |

Variáveis `EXPO_PUBLIC_*` são embutidas no bundle na hora do build; após alterar o `.env`, reinicie o `npx expo start`.

### Verificação

```cmd
npx tsc --noEmit
npx expo-doctor
```

## Estrutura

```
src/
  app/                    rotas (expo-router)
    _layout.tsx           SessionProvider + Stack raiz
    index.tsx             redireciona conforme a sessão
    login.tsx             login (e-mail ou telefone + senha)
    escolher-vinculo.tsx  escolha de condomínio/unidade (> 1 vínculo)
    (porteiro)/           abas Receber e Retirada
    (morador)/            Minhas encomendas
    (sindico)/            Resumo
  api/                    cliente HTTP (envelope {sucesso, mensagem, dados}), auth e tipos
  session/                sessão (expo-secure-store), contexto React e regras de rota
  components/             componentes reutilizáveis
```

- O cliente HTTP desembrulha `dados`; em `sucesso=false` ou HTTP >= 400 lança erro com a `mensagem` da API.
- Toda requisição autenticada envia `Authorization: Bearer <token>`; um 401 limpa a sessão e volta ao login.
- A sessão (token, usuário, contexto, vínculos) fica no `expo-secure-store` e é restaurada ao abrir o app.
  Na web (só desenvolvimento) usa `localStorage`.

## Pendências / próximas fases

- Troca de vínculo: hoje só altera o contexto local. Falta chamar `POST /auth/contexto` e usar o novo token.
- **Fase 3:** `react-native-vision-camera` + ML Kit OCR (captura de etiquetas em rajada, fila offline). Exigem development build (`npx expo run:android` ou EAS), não rodam no Expo Go.
- **Fase 4:** leitor de QR e baixa por código/manual.
- **Fase 5:** primeiro acesso do morador por OTP e `expo-notifications` (push).
