# AS Music Driver (JAM por veículo)

Três páginas, todas dentro da pasta `jam/`:

| Página | Quem usa | Para quê |
|---|---|---|
| `admin.html` | Equipe AS Brasil | Criar eventos, escolher o tema, montar a playlist, cadastrar embarques, gerar links e QR Codes, acompanhar ao vivo |
| `motorista.html?e=…&p=…&k=…` | Motorista | Informa nome e veículo, dá o play e controla a JAM |
| `index.html?e=…&p=…` | Passageiro | Escolhe o veículo e ouve junto, no próprio celular |

## Como a sincronia funciona
O motorista não transmite o áudio. Ele grava só o estado da JAM (tocando ou pausada, qual música, em que segundo e a hora do servidor). Cada celular calcula onde a música deveria estar agora e se ajusta, com diferença de cerca de meio segundo.

- **Ligação no celular do motorista:** o som dele para, mas nada é gravado. A JAM continua para os passageiros e, quando a ligação termina, o celular dele volta no ponto certo.
- **Pausar só para mim:** o passageiro pode pausar o próprio celular sem afetar ninguém.
- **Fim da playlist:** volta ao começo automaticamente (coletânea contínua).

## Modo demonstração (sem configurar nada)
Enquanto `js/config.js` estiver com `null`, tudo roda dentro do navegador:
1. Abra `jam/admin.html`, entre com qualquer e-mail e a senha `demo`.
2. Crie um evento, importe a playlist e cadastre um embarque.
3. Abra o link do motorista numa aba e o dos passageiros em outra. Dê o play no motorista e entre como passageiro.

Serve só para testar no mesmo computador. Para celulares diferentes, configure o Firebase.

## Configurar o Firebase (uso real)
1. Acesse https://console.firebase.google.com e crie um projeto (ex.: `as-music-driver`).
2. **Realtime Database:** menu Build > Realtime Database > Criar banco de dados (escolha a região dos EUA) > iniciar no modo bloqueado.
3. **Regras:** na aba Regras do Realtime Database, apague tudo, cole o conteúdo de `jam/database.rules.json` e publique.
4. **Login:** menu Build > Authentication > Começar. Ative os provedores **E-mail/senha** e **Anônimo**.
5. **Usuário admin:** em Authentication > Usuários > Adicionar usuário, crie o seu e-mail e senha. Copie o **UID** que aparece na lista.
6. **Liberar o admin:** em Realtime Database > Dados, crie o nó `admins` e, dentro dele, uma chave com o seu UID e valor `true`.
7. **Domínio autorizado:** em Authentication > Configurações > Domínios autorizados, adicione `pauloemanuel96-ship-it.github.io` (e depois o domínio da AS Brasil).
8. **Configuração:** em Configurações do projeto > Seus apps > ícone `</>` (Web), registre o app e copie o objeto `firebaseConfig`. Cole em `jam/js/config.js` no lugar do `null`:

```js
export const firebaseConfig = {
  apiKey: "…",
  authDomain: "…",
  databaseURL: "https://….firebaseio.com",
  projectId: "…",
  appId: "…"
};
```

Essas chaves podem ficar no código: quem protege os dados são as regras do passo 3.

## Capacidade
- O plano gratuito do Firebase (Spark) aceita **100 conexões simultâneas**: suficiente para testes.
- Para um evento com 100 veículos e milhares de passageiros, mude para o plano **Blaze** (paga pelo uso). Com a JAM, cada celular troca poucos dados com o Firebase, então o custo por evento tende a ser baixo.
- O que mais pesa é o **áudio**: cada passageiro baixa as músicas. Para eventos grandes, hospede os arquivos num serviço sem cobrança de transferência (ex.: Cloudflare R2) e adicione as faixas na playlist por link.

## Direitos autorais
Tocar música no veículo é execução pública (ECAD). Transmitir as faixas para o celular dos passageiros e hospedar os arquivos exige também autorização dos titulares das gravações. Resolva o licenciamento antes de usar com músicas de terceiros em evento real. Nos temas, use cores e clima do artista, sem logos ou fotos oficiais.
