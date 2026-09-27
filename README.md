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

> **A partir da Fase 3 a área do porteiro precisa de development build.** `react-native-vision-camera`
> e `@react-native-ml-kit/text-recognition` têm código nativo que não existe no Expo Go. As telas de
> login, morador e síndico continuam abrindo no Expo Go; a aba Receber não.

### Development build (câmera + OCR)

Pré-requisitos: Android Studio (SDK + JDK 17) para Android local; Xcode + CocoaPods para iOS local (só macOS).
Aparelho físico recomendado (emulador não tem câmera real).

```cmd
npx expo prebuild --clean          (gera android/ e ios/ a partir do app.json - não editar à mão)
npx expo run:android               (compila, instala no aparelho USB e sobe o Metro)
npx expo run:ios --device          (macOS)
```

Ou na nuvem, com EAS (sem Android Studio local):

```cmd
npx eas-cli@latest build --profile development --platform android
```

(o `eas.json` com o perfil `development` - `"developmentClient": true, "distribution": "internal"` - é
criado por `npx eas-cli@latest build:configure`; exige `expo-dev-client` instalado). Depois de instalar o
build, rode `npx expo start` e abra o app instalado (não o Expo Go).

Permissões (configuradas pelo config plugin do vision-camera no `app.json`):
- Android: `android.permission.CAMERA`.
- iOS: `NSCameraUsageDescription` = "O enKomenda usa a câmera para fotografar as etiquetas das encomendas recebidas na portaria."
- Microfone, localização, frame processors e leitor de código estão desligados (a Fase 4 liga `enableCodeScanner` para o QR).

Sempre que mudar `app.json`/plugins ou instalar pacote com código nativo, gere o build de novo.

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
    (porteiro)/           abas Receber (câmera + fila) e Retirada
    (morador)/            Minhas encomendas
    (sindico)/            Resumo
  api/                    cliente HTTP (envelope {sucesso, mensagem, dados}), auth e tipos
  session/                sessão (expo-secure-store), contexto React e regras de rota
  components/             componentes reutilizáveis
  recebimento/            Fase 3 - fila de etiquetas do porteiro (lógica separada da UI)
    tipos.ts              ItemFila / estados
    fila.ts               FilaRecebimento (memória + persistência) e seletores puros
    processador.ts        ProcessadorEnvio (1 por vez, backoff, só o contexto atual)
    processamentoFoto.ts  redimensiona (1280 px, JPEG 70%) + OCR ML Kit, em série
    armazenamento.ts      índice no AsyncStorage + fotos em documentDirectory/recebimento
    RecebimentoContext.tsx provider da área do porteiro (NetInfo, AppState, ações)
    ui/                   CameraCaptura, ListaRecebimento, ResolverUnidadeModal
```

### Recebimento (Fase 3)

1. **Captura:** botão grande; cada toque tira uma foto (`photoQualityBalance="speed"`), vibra e pisca. Nada de tela intermediária.
2. **Processamento** (em série, sem travar a câmera): `expo-image-manipulator` redimensiona para 1280 px de largura, JPEG 70%
   (regrava a 50% se passar de 1,4 MB) e gera miniatura; ML Kit lê o texto do arquivo (falhou = texto vazio).
3. **Fila persistente:** índice em AsyncStorage (`enkomenda.recebimento.fila.v1`), fotos em `documentDirectory/recebimento/`.
   Estados: `processando → na_fila → enviando → enviado | erro`. Cada item guarda `usuario_id` e `condominio_id`
   e só é mostrado/enviado com a sessão do mesmo usuário e condomínio.
4. **Envio:** `POST /encomendas` (1 por vez, o mais antigo primeiro, `cliente_uuid` = uuid do item → reenvio idempotente).
   Rede/timeout/5xx/429/401/403 → volta para a fila com backoff 2 s, 4 s, ... até 60 s; reconexão (NetInfo) e volta ao primeiro plano
   tentam na hora. 400/409/outros 4xx → `erro` definitivo com a mensagem da API e botão **Descartar**. 403 "Acesso revogado"
   encerra a sessão (cliente HTTP) e a fila fica guardada para o próximo login.
   Sucesso: guarda a encomenda; se identificada, apaga a foto local (mantém a miniatura); se `PENDENTE_IDENT`, mantém a foto para a resolução manual.
5. **Lista:** "Lendo etiqueta…", "Na fila (offline)", "Enviando…", unidade identificada ("A - 101 · MERCADO LIVRE"),
   "Pendente — toque para informar a unidade" ou erro. Com pendentes e a tela visível, `GET /encomendas/recentes` a cada 3 s.
6. **Resolução manual:** tocar abre a folha com a foto grande (local ou `foto_url` do servidor) e sugestões de `GET /unidades/busca`
   (debounce 250 ms); tocar na unidade → `PATCH /encomendas/{id}/unidade`. Campo opcional para corrigir o destinatário.
   Itens já identificados também podem ser tocados para corrigir a unidade.
7. Itens enviados e identificados saem da fila local depois de 24 h.

- O cliente HTTP desembrulha `dados`; em `sucesso=false` ou HTTP >= 400 lança erro com a `mensagem` da API.
- Toda requisição autenticada envia `Authorization: Bearer <token>`; um 401 limpa a sessão e volta ao login.
- A sessão (token, usuário, contexto, vínculos) fica no `expo-secure-store` e é restaurada ao abrir o app.
  Na web (só desenvolvimento) usa `localStorage`.

## Pendências / próximas fases

- Troca de vínculo: feita pelo servidor (`POST /auth/contexto`), com token novo (Fase 2).
- **Fase 3 (feita, falta validar em aparelho):** câmera, OCR, fila offline e resolução manual. Ver "Development build".
- **Fase 4:** leitor de QR e baixa por código/manual.
- **Fase 5:** primeiro acesso do morador por OTP e `expo-notifications` (push).
