# Calculoco — Escopo Técnico Completo do Projeto

> Documento de contexto para uso por assistentes de IA no desenvolvimento contínuo do projeto. Descreve o estado atual do código, decisões de arquitetura, regras de negócio e convenções adotadas. Sempre que possível, mantenha essas convenções ao propor ou implementar mudanças.

## 1. Visão geral

**Calculoco** é um jogo web educativo para crianças do ensino fundamental praticarem as quatro operações matemáticas básicas (adição, subtração, multiplicação, divisão) através de desafios contextualizados de múltipla escolha, organizados em módulos e níveis de dificuldade crescente.

O produto tem **dois perfis de usuário**:
- **Aluno**: entra numa turma via código, joga os módulos/níveis, seu progresso é salvo.
- **Professor**: cria turmas (cada uma com um código único), e acompanha o desempenho dos alunos de cada turma num dashboard.

É um projeto acadêmico (disciplina de TI, graduação), conduzido em Scrum, com 4 pessoas na equipe (1 PO, 1 Scrum Master/QA, 2 Devs), sem orçamento dedicado, prazo de 04/08 a 04/11.

## 2. Stack tecnológica

- **Frontend**: HTML5 + CSS3 + JavaScript (ES6, módulo nativo, sem framework/bundler) — tudo estático, servido diretamente pelo backend.
- **Backend**: Node.js + Express (API REST).
- **Banco de dados**: Supabase (PostgreSQL gerenciado), acessado via `@supabase/supabase-js` usando a **service_role key** (nunca a anon key), pois todo acesso ao banco passa pelo backend — o cliente nunca fala diretamente com o Supabase.
- **Hash de senha/PIN**: `bcryptjs`.
- **Sem framework de frontend** (nada de React/Vue): manipulação direta do DOM, `fetch` para chamadas à API, `localStorage` para persistir a sessão (aluno ou professor) entre visitas.
- Deploy pensado para ser simples/gratuito: o Express serve tanto a API (`/api/...`) quanto os arquivos estáticos do frontend a partir do mesmo processo/porta.

## 3. Estrutura de pastas

```
calculoco/
├── frontend/
│   ├── index.html      # todas as "telas" do app vivem neste único HTML (SPA simples por show/hide de <section>)
│   ├── style.css        # design system completo (cores, tipografia, componentes)
│   ├── app.js            # toda a lógica: estado, chamadas à API, renderização, navegação
│   └── img/
│       ├── logo.jpeg          # original fornecido pelo time (fundo branco), só como referência
│       ├── logo.png           # logo.jpeg com o fundo removido — é este que a interface usa
│       ├── mascote/1.jpeg..4.jpeg  # 4 poses do mascote, sorteadas a cada pergunta
│       └── estrela.png        # ícone usado ao lado de qualquer pontuação exibida
├── backend/
│   ├── server.js               # bootstrap do Express, monta as rotas, serve o frontend estático
│   ├── supabaseClient.js       # cria o client do Supabase a partir das env vars
│   ├── routes/
│   │   ├── turmas.js           # criar turma, validar código, dashboard de desempenho
│   │   ├── auth.js             # cadastro/login do ALUNO (usuário + PIN de 4 dígitos)
│   │   ├── professores.js      # cadastro/login do PROFESSOR (usuário + senha), lista de turmas do professor
│   │   ├── progresso.js        # ler/gravar progresso do aluno por fase
│   │   └── fases.js            # gerar pergunta aleatória e verificar resposta
│   ├── utils/
│   │   ├── perguntas.js        # geração de perguntas dos 4 módulos, com dificuldade progressiva
│   │   └── token.js            # assinatura HMAC do índice da resposta correta (a resposta nunca vai "em aberto" ao cliente)
│   ├── package.json
│   └── .env (não versionado; ver seção 9)
└── database/
    └── schema.sql        # todo o schema do Postgres/Supabase (idempotente, usa IF NOT EXISTS)
```

Convenção de nomenclatura: **variáveis, funções, comentários e strings de interface estão em português**. IDs de elementos HTML e nomes de arquivo também em português (`campo-nome-turma`, `btn-sair`, etc.). Arquivos JS usam `camelCase`; tabelas/colunas do banco usam `snake_case` em português (`nome_usuario`, `fase_numero`, `criado_em`).

O projeto inteiro usa terminadores de linha **CRLF** (o autor desenvolve no Windows) — ao editar arquivos, preserve CRLF.

## 4. Modelo de dados (Supabase / PostgreSQL)

Arquivo: `database/schema.sql`. O script é **idempotente**: usa `create table if not exists` e `create index if not exists`, então pode ser reexecutado com segurança sem duplicar nada. Ele reflete só o formato atual das tabelas — não carrega migrações de formatos antigos (isso é responsabilidade de quem já tinha um banco anterior rodar as migrações necessárias antes, não deste script).

### `professores`
| coluna | tipo | observação |
|---|---|---|
| id | uuid, PK | `gen_random_uuid()` |
| usuario | text, unique, not null | login do professor, salvo em lowercase |
| senha_hash | text, not null | bcrypt, nunca texto puro |
| nome | text, not null | nome de exibição |
| criado_em | timestamptz | default now() |

### `turmas`
| coluna | tipo | observação |
|---|---|---|
| id | uuid, PK | |
| codigo | varchar(4), unique, not null | código numérico de 4 dígitos, gerado pelo backend, usado pelo aluno para entrar |
| nome_turma | text, not null | ex: "3º Ano B" |
| nome_professor | text, not null | denormalizado (nome do professor no momento da criação, para exibição rápida) |
| professor_id | uuid, FK → professores.id, on delete set null | dono da turma; usado para checar permissão no dashboard |
| criado_em | timestamptz | |

### `alunos`
| coluna | tipo | observação |
|---|---|---|
| id | uuid, PK | |
| turma_id | uuid, FK → turmas.id, on delete cascade | |
| nome_usuario | text, not null | único **dentro da turma** (constraint `unique(turma_id, nome_usuario)`), não é dado pessoal identificável — é um apelido/login, tipo "tiopatinhas123" |
| pin_hash | text, not null | bcrypt do PIN de 4 dígitos |
| criado_em | timestamptz | |

### `progresso`
| coluna | tipo | observação |
|---|---|---|
| id | uuid, PK | |
| aluno_id | uuid, FK → alunos.id, on delete cascade | |
| fase_numero | integer, not null | 1 a 20 (ver seção 5 sobre numeração de fases); constraint `unique(aluno_id, fase_numero)` — uma linha por combinação aluno+fase |
| concluida | boolean, default false | true quando o aluno acerta a pergunta daquela fase |
| pontos | integer, default 0 | pontuação ganha ao acertar, conforme a tentativa (ver seção 5) |
| atualizado_em | timestamptz | atualizado a cada upsert |

Índices em `alunos.turma_id`, `progresso.aluno_id`, `turmas.professor_id`.

**Segurança/RLS**: Row Level Security está habilitado em todas as tabelas, **sem policies** — porque o único cliente que fala com o Supabase é o backend, autenticado com a `service_role key` (que ignora RLS por padrão). Não há acesso direto do navegador ao Supabase.

**Decisão de privacidade (LGPD)**: o sistema propositalmente **não coleta dados pessoais identificáveis** de crianças (sem nome completo, e-mail, documento). O login do aluno é só um nome de usuário livre + PIN de 4 dígitos.

## 5. Lógica de jogo: módulos, níveis e numeração de fases

- **4 módulos**, um por operação: 1 = Adição, 2 = Subtração, 3 = Multiplicação, 4 = Divisão.
- Cada módulo tem **5 níveis** de dificuldade crescente (nível 1 = números baixos/1 algarismo; nível 5 = números maiores).
- Total: **20 fases jogáveis**.
- A tabela `progresso` guarda tudo por um único `fase_numero` inteiro (1–20), não por (módulo, nível) separados. A conversão módulo/nível ↔ fase_numero acontece **no frontend** (`app.js`), que calcula `fase_numero = (modulo.numero - 1) * 5 + nivel` ao abrir uma fase. O backend (`routes/fases.js`) recebe módulo e nível **já decompostos** a partir do número da fase:
  ```js
  function decompoeFase(numero) {
    const modulo = Math.ceil(numero / 5);
    const nivel = numero - (modulo - 1) * 5;
    return { modulo, nivel };
  }
  ```
- **Desbloqueio sequencial**: a fase N só é jogável se a fase N-1 estiver com `concluida = true` (a fase 1 é sempre liberada). Essa checagem é feita no frontend, olhando o array `progresso` carregado do backend.
- **Pontuação por tentativa**: cada vez que o aluno erra e clica em "tentar novamente", uma nova pergunta é gerada para a mesma fase (`carregarPergunta()` incrementa `estado.fase.tentativas`). Ao acertar, os pontos ganhos dependem de quantas perguntas ele precisou até acertar: 1ª tentativa = 20 pontos, 2ª = 10, 3ª = 5, 4ª em diante = 0. A regra vive em `calcularPontos()` (`frontend/app.js`) e é validada no backend (`PONTOS_POSSIVEIS` em `routes/progresso.js`, que só aceita `0, 5, 10 ou 20`). O valor sobrescreve (não soma) o `pontos` daquela fase a cada nova conclusão — o mesmo modelo "última tentativa registrada" que já valia para `concluida`. Em qualquer lugar da interface que mostre pontuação, o número vem sempre acompanhado do ícone `frontend/img/estrela.png` (helper `pontosComEstrela()` em `app.js`), nunca só o número solto.

### Geração de perguntas (`backend/utils/perguntas.js`)

Para cada módulo existe:
1. Uma tabela `NIVEIS_<OPERACAO>` com 5 entradas (uma por nível), definindo os intervalos numéricos (`min`/`max`) sorteados para os operandos daquele nível — ficando mais largos e com números maiores a cada nível.
2. Uma lista `TEMPLATES_<OPERACAO>` de enunciados contextualizados (várias frases diferentes, cada uma com um `contexto` associado — ex: `"mercado"`, `"escola"`, `"fazenda"`, `"festa"`, `"aquario"`, `"parque"`, `"praia"`, `"casa"`). Um template é sorteado aleatoriamente a cada pergunta.
3. Uma função `gerar<Operacao>(nivel)` que sorteia os números dentro da faixa do nível, escolhe um template, calcula a resposta correta, e monta a questão.

Regras específicas por operação:
- **Subtração**: `b` é sempre sorteado entre 1 e `a-1`, para garantir resultado positivo (nunca subtração com resultado negativo).
- **Divisão**: sorteia primeiro o **divisor** e o **quociente** dentro das faixas do nível, e calcula `dividendo = divisor * quociente` — ou seja, **a divisão é sempre exata** (sem resto), para caber no formato de múltipla escolha sem ambiguidade.

`montarQuestao()` centraliza a montagem final: gera 3 distratores plausíveis via `gerarDistratores(correta)` (números próximos da resposta certa, dentro de um espalhamento proporcional ao tamanho do número — evita distratores óbvios demais ou longe demais), embaralha as 4 opções (correta + 3 distratores) e calcula o índice correto dentro do array embaralhado.

`gerarQuestao(modulo, nivel)` é o ponto de entrada único, despachando para o gerador do módulo certo via um objeto `GERADORES_POR_MODULO`.

### Segurança da resposta correta (`backend/utils/token.js`)

A resposta correta **nunca é enviada ao cliente em texto aberto** junto com a pergunta. Fluxo:
1. `GET /api/fases/:numero/questao` gera a pergunta, e assina um **token HMAC-SHA256** (`assinarQuestao`) contendo `{ correctIndex, operacao, fase, exp }` (expira em alguns minutos). O token (string opaca, `payload_base64.assinatura`) é devolvido junto com o enunciado e as opções — mas o índice correto **não** aparece em lugar nenhum visível.
2. Quando o aluno responde, o frontend envia `POST /api/fases/:numero/verificar` com `{ questionToken, resposta }`.
3. O backend valida a assinatura (`verificarToken`) e só então compara `resposta === correctIndex`, devolvendo `{ correta: boolean, correctIndex }` (o índice correto só é revelado **depois** de responder, para exibir feedback visual).

Isso impede que alguém inspecione a resposta da API antes de responder e descubra a resposta certa.

## 6. API REST — endpoints completos

Prefixo comum: `/api`. Todas as respostas são JSON; erros seguem o formato `{ erro: "mensagem" }` com o status HTTP apropriado (400/401/403/404/409/500).

### `routes/auth.js` — autenticação do ALUNO
| Método | Rota | Body | Descrição |
|---|---|---|---|
| POST | `/api/auth/cadastro` | `{ codigo_turma, nome_usuario, pin }` | Cria uma conta de aluno dentro de uma turma existente. Valida turma, unicidade do `nome_usuario` **dentro da turma** (case-insensitive via `ilike`), PIN precisa ser exatamente 4 dígitos. Salva `pin_hash` via bcrypt. |
| POST | `/api/auth/login` | `{ codigo_turma, nome_usuario, pin }` | Login do aluno. Busca por turma + nome_usuario, compara PIN via bcrypt. |

### `routes/professores.js` — autenticação e dados do PROFESSOR
| Método | Rota | Body/Query | Descrição |
|---|---|---|---|
| POST | `/api/professores/cadastro` | `{ nome, usuario, senha }` | Cria conta de professor. `usuario` mín. 3 caracteres, `senha` mín. 4 caracteres, salvo em lowercase, unicidade checada via `ilike`. |
| POST | `/api/professores/login` | `{ usuario, senha }` | Login do professor, compara senha via bcrypt. |
| GET | `/api/professores/:professor_id/turmas` | — | Lista as turmas **daquele professor** (filtra por `professor_id`), incluindo `total_alunos` (contagem calculada em memória a partir da tabela `alunos`). |

### `routes/turmas.js` — turmas e dashboard
| Método | Rota | Body/Query | Descrição |
|---|---|---|---|
| POST | `/api/turmas` | `{ nome_turma, professor_id }` | Cria uma turma **vinculada a um professor autenticado** (exige `professor_id` válido). Gera um código numérico de 4 dígitos único (retry loop de até 10 tentativas checando colisão no banco). |
| GET | `/api/turmas/:codigo` | — | Busca turma pelo código de 4 dígitos (usado pela tela do aluno para validar o código digitado). |
| GET | `/api/turmas/:turma_id/desempenho?professor_id=...` | query `professor_id` | **Dashboard**: retorna a turma + lista de alunos com resumo de desempenho de cada um (`fases_concluidas`, `total_fases` fixo em 20, `pontuacao_total`), **já ordenada por `pontuacao_total` decrescente** (maior pontuação primeiro). **Autorização**: compara `turma.professor_id` com o `professor_id` da query; se não bater, retorna 403. Não há sessão/JWT — a autorização depende do frontend enviar o `professor_id` correto (guardado em `localStorage` após login). |
| POST | `/api/turmas/:turma_id/alunos/:aluno_id/redefinir-pin` | `{ professor_id }` | Redefine o PIN do aluno para o **código da turma** — usado pelo professor quando o aluno esquece a senha. Mesma checagem de autorização do dashboard (só o professor dono da turma). Devolve `{ ok, novo_pin }`. |

### `routes/progresso.js`
| Método | Rota | Body | Descrição |
|---|---|---|---|
| GET | `/api/progresso/:aluno_id` | — | Lista todas as linhas de progresso daquele aluno (`fase_numero, concluida, pontos`), ordenado por `fase_numero`. |
| POST | `/api/progresso` | `{ aluno_id, fase_numero, concluida, pontos }` | Upsert (on conflict `aluno_id,fase_numero`) — grava/atualiza o progresso daquela fase. `pontos` só aceita `0, 5, 10 ou 20`. |

### `routes/fases.js`
| Método | Rota | Body | Descrição |
|---|---|---|---|
| GET | `/api/fases/:numero/questao` | — | `numero` de 1 a 20. Decompõe em módulo/nível, gera a pergunta (ver seção 5), assina o token, retorna `{ enunciado, opcoes, contexto, questionToken }`. |
| POST | `/api/fases/:numero/verificar` | `{ questionToken, resposta }` | Verifica a resposta contra o token assinado, retorna `{ correta, correctIndex }`. |

### `GET /api/health`
Retorna `{ status: "ok" }` — usado só para checagem rápida de que o servidor está de pé.

## 7. Frontend — telas e fluxo (`frontend/index.html` + `app.js`)

O app é uma **SPA simples de uma página só**: todas as "telas" são `<section class="tela">` dentro do mesmo `index.html`, e `mostrarTela(id)` alterna qual fica visível (`classList` add/remove `"ativa"`), sem roteamento de URL nem histórico do navegador.

### Fluxo do ALUNO
1. **`tela-turma`** (tela inicial): campo para digitar o código de 4 dígitos da turma. Botão "Sou professor(a)" leva para o fluxo do professor.
2. **`tela-auth`**: após validar o código da turma, o aluno escolhe entre abas "Entrar" / "Criar conta", informando `nome_usuario` + PIN de 4 dígitos.
3. **`tela-menu`**: grade de cartões, um por módulo (`.cartao-modulo`), cada um mostrando seus 5 níveis como botões (`.nivel-btn`) — bloqueados (ícone de cadeado), concluídos (ícone de check) ou disponíveis (número do nível), conforme a lógica de desbloqueio sequencial.
4. **`tela-jogo`**: mostra o enunciado num balão de fala ao lado de uma foto do mascote (avatar circular, `#img-mascote`), 4 botões de alternativa, feedback visual (verde=certo, vermelho=errado, com os pontos ganhos e o ícone de estrela no texto), e troca o **cenário de fundo** (gradiente + ícones SVG decorativos) conforme o campo `contexto` retornado pela API (classes `.tema-casa`, `.tema-mercado`, etc. em `.area-jogo`). A cada pergunta carregada (`carregarPergunta()`), `sortearPoseMascote()` troca a foto do mascote por uma aleatória entre as 4 em `frontend/img/mascote/`, dando a impressão de que o personagem está em poses diferentes enquanto "fala". Ao acertar, `dispararConfete()` solta confete caindo pela tela (CSS puro, `#confete-container`) e `tocarSomComemoracao()` sintetiza um pequeno arpejo de comemoração via Web Audio API (sem depender de nenhum arquivo de áudio).

Sessão do aluno persiste em `localStorage` (chave `calculoco_aluno`), guardando `{ id, nome_usuario, turma_id, turma_codigo }`, permitindo voltar direto pro menu em visitas futuras sem logar de novo (o app revalida buscando a turma pelo código salvo).

### Fluxo do PROFESSOR
1. **`tela-professor-auth`**: abas "Entrar"/"Criar conta" — cadastro pede nome completo + usuário + senha; login só usuário + senha.
2. **`tela-professor-turmas`** ("Minhas turmas"): formulário para criar nova turma (só pede o nome da turma — o professor já está autenticado) + grade de cartões clicáveis, um por turma (nome, código, contagem de alunos).
3. **`tela-professor-dashboard`**: ao clicar numa turma, mostra uma tabela com uma linha por aluno: nome, barra de progresso visual (X/20 fases concluídas), pontuação total (número + ícone de estrela) e um botão "Redefinir" (senha). Já vem ordenada da maior para a menor pontuação (o backend ordena, o frontend só renderiza na ordem recebida). O botão de redefinir pede confirmação (`window.confirm`, avisando qual vai ser a nova senha) antes de chamar a API — a nova senha (PIN) do aluno passa a ser o código da turma.

Sessão do professor persiste em `localStorage` (chave `calculoco_professor`), guardando `{ id, usuario, nome }`.

**Lógica de inicialização** (`iniciar()` no fim do `app.js`): ao carregar a página, tenta primeiro restaurar sessão de **aluno**; se não houver, tenta restaurar sessão de **professor**; se nenhuma, mostra `tela-turma`. As duas sessões são independentes (chaves de `localStorage` diferentes).

### Padrão de chamadas à API
Toda chamada passa por um helper único:
```js
async function chamarApi(caminho, opcoes = {}) {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    headers: { "Content-Type": "application/json" },
    ...opcoes,
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || "Ocorreu um erro inesperado.");
  return dados;
}
```
Erros da API viram `Error` lançado, capturado nos `try/catch` de cada handler e exibido no `<p class="aviso">` correspondente daquela tela.

## 8. Identidade visual / design system (`style.css` + `frontend/img/` + ícones SVG em `index.html`)

Tema lúdico (mascote macaco oficial, paleta viva) pensado para crianças, mas construído como uma identidade de plataforma "de respeito" — sem depender de emojis do sistema operacional (que renderizam de formas inconsistentes entre navegadores/SOs e passam uma impressão amadora). A logo e o mascote são fotos/ilustrações oficiais fornecidas pelo time (`frontend/img/`); os demais ícones de interface (cadeado, check, voltar, etc.) são SVG de linha próprios, desenhados no próprio código.

Mobile-first e responsivo.

**Paleta** (custom properties em `:root`):
```css
--azul-noite:#12285C;  --azul-ceu:#3FB8F2;  --azul-ceu-claro:#BFE9FF;
--amarelo:#FFC61E;     --laranja:#FF8C1A;   --rosa:#F0208A;
--verde:#5FC22E;       --verde-escuro:#3C8A18;
--vermelho:#E8384F;    --vermelho-escuro:#B01F31;
--roxo:#9B4BD6;        --branco:#FFFDF7;
```

**Tipografia**: `"Baloo 2"` (display/títulos, bold/800, arredondada e lúdica) + `"Nunito"` (corpo de texto), ambas via Google Fonts.

**Padrões de componente**:
- Botões "grandes" (`.btn-grande`) com sombra sólida deslocada para baixo (`box-shadow: 0 5px 0 <cor-escura>`), que "afunda" no `:active` — efeito 3D tipo botão de brinquedo.
- Cartões brancos arredondados (`border-radius` generoso, 16–28px), sombras suaves coloridas (`rgba(18,40,92,...)`).
- Cada módulo tem uma cor de destaque própria (`--cor-modulo`), usada na "bolha" do ícone e nos níveis concluídos.
- Cada cenário de pergunta (`contexto`) tem um gradiente de fundo próprio (`.area-jogo.tema-*`) + um ícone de linha decorativo repetido em 4 posições (`.decor-1`–`.decor-4`), em baixa opacidade — um padrão discreto, não uma colagem de figurinhas.
- Toasts (`#toast`) para mensagens rápidas não-bloqueantes (ex: "complete o nível anterior").

Um "sol" decorativo fixo (`.sun`) com animação sutil de pulso fica no canto superior da tela em todas as telas, reforçando o clima "dia ensolarado/aventura".

**Ícones de linha (`index.html`)**: um `<svg class="sr-only">` no início do `<body>` concentra os `<symbol>` reutilizados via `<use href="#icone-...">` — cadeado, check, voltar, sair, atualizar, seta, professor e um por contexto de cenário. Centralizar os símbolos assim evita duplicar SVG pela página.

**Imagens oficiais (`frontend/img/`)**:
- `logo.jpeg`: arquivo original fornecido pelo time (lockup completo da marca — emblema circular + wordmark "CALCULOCO" + slogan — com fundo branco opaco). Mantido no repositório como referência/fonte, mas não é referenciado direto no HTML.
- `logo.png`: o mesmo lockup, com o fundo branco removido (recorte por flood-fill a partir das bordas + borda anti-serrilhada, redimensionado para 420×420) — é essa versão transparente que aparece em toda a interface: `.logo-login` nas telas de login e `.marca-logo` no cabeçalho. Usar sempre a logo completa (nunca um recorte só do emblema) mesmo no ícone pequeno do cabeçalho.
- `mascote/1.jpeg` a `mascote/4.jpeg`: o mesmo personagem em 4 poses diferentes (fundo branco, recorte circular via CSS). `sortearPoseMascote()` em `app.js` sorteia uma delas a cada pergunta carregada e atualiza `#img-mascote`, dando a impressão de que o mascote está "vivo" enquanto fala.
- `estrela.png`: ícone usado sempre que a interface mostra pontuação (feedback de acerto, dashboard do professor) — ver `pontosComEstrela()` em `app.js`.

## 9. Variáveis de ambiente (`backend/.env`, não versionado)

```
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_KEY=sua_service_role_key_aqui   # NUNCA a anon key
QUESTION_SECRET=string_longa_aleatoria            # segredo do HMAC das perguntas
PORT=3000
```

`server.js` serve o frontend estático (`express.static`) a partir da pasta `frontend/`, então em produção/dev só precisa rodar `npm start` dentro de `backend/` e acessar `http://localhost:3000`.

## 10. Decisões de escopo e regras de negócio relevantes

Vêm da Declaração de Escopo e do Termo de Abertura do Projeto (TAP) já elaborados para a disciplina:

- **Fora do escopo, deliberadamente**: aplicativo mobile nativo (só web), modo multiplayer/online, redes sociais, qualquer coleta de dado pessoal identificável de aluno (nome completo, e-mail, documento).
- **Critério pedagógico**: os enunciados são sempre problemas contextualizados do cotidiano infantil (mercado, escola, festa, fazenda, etc.), nunca só "a + b = ?" solto — isso é intencional, é o diferencial pedagógico do produto (BNCC valoriza resolução de problemas práticos, não só cálculo mecânico).
- **Números sempre aleatórios** a cada tentativa (nunca hardcoded), para impedir que um aluno "cole" a resposta de outro que já jogou a mesma fase.
- **Progressão estritamente sequencial**: um nível só abre depois do anterior concluído (dentro do módulo, e entre módulos também, já que a numeração de fase é global 1–20).
- Time de 4 pessoas (PO, Scrum Master/QA, 2 Devs), metodologia Scrum, sprints de ~2 semanas, ferramentas de gestão: Trello (backlog/board) + canal do YouTube (registro de reuniões).

## 11. Limitações conhecidas / dívidas técnicas atuais

- **Sem autenticação por sessão/JWT real**: tanto aluno quanto professor "logados" apenas guardam seus IDs no `localStorage` do navegador, e o frontend reenvia esses IDs em cada requisição (`aluno_id`, `professor_id`) para o backend confiar neles. Não há token de sessão assinado nem expiração de login — quem souber/adivinhar um `professor_id` (UUID) poderia, em teoria, chamar a API do dashboard diretamente. É um nível de segurança aceitável para um projeto acadêmico, mas **não é apropriado para produção real** sem evoluir para JWT ou sessões de verdade.
- Sem recuperação de senha do professor. O aluno tem uma saída indireta: o professor pode redefinir o PIN dele para o código da turma (`POST /api/turmas/:turma_id/alunos/:aluno_id/redefinir-pin`), mas o aluno não tem um fluxo de "esqueci minha senha" próprio.
- Sem rate limiting nas rotas de login/cadastro (vulnerável a força bruta em teoria).
- O dashboard do professor mostra só o **total agregado** de fases concluídas/pontuação por aluno — não quebra por módulo/operação (ex: não dá pra ver "esse aluno vai mal especificamente em divisão"). Foi cogitado como próximo passo.
- Sem testes automatizados (unitários ou e2e) até o momento.

## 12. Convenções de estilo de código a seguir em novas contribuições

- Nomes de função/variável em português, verbos no infinitivo para funções (`gerarQuestao`, `carregarProgresso`, `renderizarListaTurmas`).
- Toda rota Express retorna cedo em caso de erro de validação (`return res.status(400).json({ erro: "..." })`), sem `else` aninhado.
- Toda query ao Supabase desestrutura `{ data, error }` e checa `error` explicitamente antes de seguir — **isso é importante**, pois em caso de falha de rede o client do Supabase retorna `{ data: null, error: {...} }` em vez de lançar exceção, então pular essa checagem faz o bug passar silenciosamente (embora não derrube o processo).
- CSS usa nomes de classe em português, BEM-like informal (`.cartao-turma`, `.nivel-btn.concluido`, `.area-jogo.tema-mercado`).
- Sempre que adicionar um novo "tema"/cenário em `perguntas.js`, sincronizar três pontas: o CSS do gradiente de fundo (`.area-jogo.tema-<nome>`), o `<symbol id="icone-<nome>">` correspondente no sprite SVG em `index.html`, e o nome do contexto na lista `CONTEXTOS_VALIDOS` em `app.js`.
- Não usar emojis de sistema operacional na interface (texto de botão, feedback, decoração) — eles renderizam de forma inconsistente entre navegadores/SOs. Novos ícones entram como `<symbol>` no sprite SVG de `index.html` e são referenciados via `<use href="#icone-...">`, seguindo o estilo de linha (`stroke="currentColor"`) já usado pelos demais.
- Todo enunciado de pergunta (`backend/utils/perguntas.js`) precisa concordar em número: quando a quantidade sorteada é 1, o substantivo (e o adjetivo/verbo que concorda com ele) vai para o singular — nunca "1 figurinhas coladas". Use o helper `pluralizar(quantidade, singular, plural)` já existente em vez de escrever a palavra no plural direto no template.
