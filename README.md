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

> **A partir da Fase 3 a área do porteiro precisa de development build.** `react-native-vision-camera` (v5, Nitro)
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

Identificador do app: `br.app.enkomenda` (`android.package` e `ios.bundleIdentifier` no `app.json`).

Câmera: VisionCamera **v5** (Nitro Modules) - `react-native-vision-camera`, `react-native-nitro-modules`,
`react-native-nitro-image` e, só no Android, `react-native-vision-camera-barcode-scanner` (ML Kit) para o QR.
No iOS o QR usa a detecção nativa do próprio VisionCamera (`useObjectOutput`, AVFoundation); o pacote do
leitor fica fora do autolinking do iOS (`package.json` > `expo.autolinking.ios.exclude`) porque ele exige
`GoogleMLKit` 9.0.0 e o OCR (`@react-native-ml-kit/text-recognition`) exige 8.0.0 - o CocoaPods não resolve os dois.
A escolha por plataforma está em `src/retirada/ui/useSaidaQR.ts` (Android) / `useSaidaQR.ios.ts` (iOS).
As versões dos pacotes `react-native-vision-camera*` ficam fixas e iguais (atualize todas juntas).

Permissões (a v5 **não tem config plugin**; ficam direto no `app.json`):
- Android: `android.permissions` = `android.permission.CAMERA`.
- iOS: `ios.infoPlist.NSCameraUsageDescription` = "O enKomenda usa a câmera para fotografar as etiquetas das encomendas recebidas na portaria e ler o QR de retirada dos moradores."
- Sem microfone e sem localização.

#### Primeiro build nativo depois da migração (v4 → v5 e troca de bundle id)

1. `npx expo prebuild --clean` (obrigatório: muda o identificador, sai o plugin da v4 e entram módulos Nitro).
   No iOS apague também `ios/Pods` e `Podfile.lock` se existirem, e rode `pod install` do zero.
2. iOS: conferir que o `pod install` **não** lista `VisionCameraBarcodeScanner` nem `GoogleMLKit/BarcodeScanning`
   (só `GoogleMLKit/TextRecognition*` 8.0.0), e que o deployment target é >= 15.5.
3. Android: conferir no `AndroidManifest.xml` gerado a permissão `CAMERA` e nenhuma de áudio/localização;
   `applicationId`/`namespace` = `br.app.enkomenda`.
4. Como o id mudou, o app instala como **outro app** (o antigo `br.com.kds.enkomenda` continua no aparelho
   com seus dados). Desinstale o antigo. Credenciais que dependam do id (Firebase/Google, EAS, App Store
   Connect, Play Console, links universais) precisam ser refeitas para `br.app.enkomenda`.
5. Testar no aparelho: tela de permissão (permitir, negar, negar de vez → "Abrir configurações"),
   rajada de fotos na aba Receber (uma captura por vez, flash + vibração, sem som do obturador, arquivo JPEG
   processado pelo OCR), pausa ao trocar de aba / ir para segundo plano, leitura de QR na Retirada
   (Android = ML Kit, iOS = AVFoundation) e a trava de QR repetido.

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
