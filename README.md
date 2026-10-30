# AS Brasil Music

Site de músicas no estilo Spotify/SoundCloud. Você envia suas faixas pela **Área do artista** e o público ouve no celular ou no computador. A música continua tocando com a tela bloqueada ou com outros apps abertos, com controles na tela de bloqueio.

Funciona em hospedagem comum com PHP (como a Locaweb), sem banco de dados.

## O que tem em cada pasta

| Pasta / arquivo | Para que serve |
|---|---|
| `index.html`, `assets/` | O site que o público vê (player, lista, busca, favoritas) |
| `api/` | Login do artista, envio de arquivos e gravação do catálogo (PHP) |
| `api/config.example.php` | Modelo da senha. Vira `api/config.php` só na hospedagem |
| `data/` | Catálogo de músicas (`catalog.json`). Bloqueada para o navegador |
| `musicas/`, `capas/` | Arquivos enviados pelo Estúdio |
| `manifest.webmanifest`, `sw.js` | Deixam o site instalável como app no celular |
| `.github/workflows/deploy.yml` | Publica na Locaweb automaticamente a cada `git push` |

## Requisitos na Locaweb

- Hospedagem Linux com **PHP 8.0 ou mais novo** (dá para escolher a versão no painel).
- **Certificado SSL ativo** no domínio (o endereço precisa abrir com `https://`). Sem isso, o celular não mostra os controles na tela de bloqueio nem deixa instalar o app.

## Passo a passo

### 1. Criar o repositório no GitHub
1. Acesse https://github.com/new
2. Nome: `as-brasil-music`. Marque **Private**. Não adicione README nem .gitignore.
3. Clique em **Create repository**.

### 2. Enviar o código
Descompacte o ZIP numa pasta (por exemplo `C:\projetos\as-brasil-music`), abra o terminal nessa pasta e rode:

```bash
git init
git add .
git commit -m "AS Brasil Music: primeira versão"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/as-brasil-music.git
git push -u origin main
```

### 3. Pegar os dados de FTP na Locaweb
No painel da Locaweb, abra a hospedagem do seu domínio, clique em **Administrar** e entre no cartão **FTP**. Anote **host**, **usuário** e **senha** (se não lembrar a senha, use “Alterar senha”).

### 4. Publicação automática (recomendado)
No GitHub, abra o repositório e vá em **Settings > Secrets and variables > Actions > New repository secret**. Crie três segredos:

| Nome | Valor |
|---|---|
| `FTP_SERVER` | o host de FTP da Locaweb |
| `FTP_USERNAME` | o usuário de FTP |
| `FTP_PASSWORD` | a senha de FTP |

Depois vá na aba **Actions**, abra **Publicar na Locaweb** e clique em **Run workflow**. A partir daí, todo `git push` publica sozinho. Esse envio nunca apaga as músicas que você subiu pelo Estúdio.

**Alternativa manual:** com o FileZilla (porta 21), arraste todo o conteúdo da pasta para dentro de `public_html` na hospedagem. Ative a exibição de arquivos ocultos para levar também os arquivos `.htaccess` e `.user.ini`.

> Se já existe um site no `public_html`, baixe uma cópia dele antes. O `index.html` novo substitui o antigo.

### 5. Criar a senha do artista (só uma vez, direto na hospedagem)
Pelo WebFTP da Locaweb ou pelo FileZilla:
1. Entre em `public_html/api/`.
2. Crie um arquivo chamado `config.php` com o conteúdo abaixo, trocando a senha:

```php
<?php
const ADMIN_SENHA = 'coloque-aqui-uma-senha-forte';
const MAX_AUDIO_MB = 100;
```

Esse arquivo fica só na hospedagem. Ele está no `.gitignore` e nunca vai para o GitHub.

### 6. Conferir permissões
As pastas `data`, `musicas` e `capas` precisam aceitar escrita. Na Locaweb, 755 costuma bastar. Se o Estúdio mostrar erro de permissão, mude essas três pastas para 775 no FileZilla (botão direito > Permissões de arquivo).

### 7. Testar
1. Abra `https://seudominio.com.br`
2. No rodapé, clique em **Área do artista** e entre com a senha.
3. Em **Estúdio**, envie as músicas, ajuste títulos e capas e clique em **Publicar alterações**.
4. No celular, dê o play, bloqueie a tela e confira os controles.

## Atualizar o site depois
Altere os arquivos e rode:

```bash
git add .
git commit -m "Descreva a mudança"
git push
```

Quando mudar `style.css` ou `app.js`, troque `?v=1` por `?v=2` no `index.html` e no `sw.js`, e mude `VERSION` no `sw.js`. Isso obriga os celulares a baixar a versão nova.

## Backup
Baixe de vez em quando, pelo FileZilla, as pastas `data`, `musicas` e `capas`. Elas guardam tudo o que foi enviado pelo Estúdio.

## Problemas comuns
- **“Crie o arquivo api/config.php”**: faltou o passo 5.
- **“Defina uma senha própria”**: a senha ainda é a do exemplo.
- **Erro de permissão ao enviar**: veja o passo 6.
- **A música para quando bloqueio a tela**: confirme que o site abre com `https://`. No Android, tire o navegador da economia de bateria. No iPhone, adicione o site à Tela de Início.
- **Login bloqueado**: depois de 5 senhas erradas, o acesso fica bloqueado por 15 minutos.
- **Forçar HTTPS**: depois que o SSL estiver ativo, tire o `#` das três últimas linhas do `.htaccess` da raiz.
