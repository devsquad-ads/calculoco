# Calculoco

Jogo educativo web para crianças praticarem as quatro operações básicas de matemática.

- **HTML5** — `frontend/index.html`
- **CSS3** — `frontend/style.css`
- **ECMAScript 6** — `frontend/app.js`
- **Node.js (Express)** — `backend/`
- **Banco de dados** — Supabase (PostgreSQL)

## Como funciona o fluxo

### Aluno
1. Na tela inicial, o aluno pode tocar em **"Jogar agora"** para jogar sem login, ou digitar o **código da turma** (4 dígitos, fornecido pelo professor).
2. Sem login, o progresso fica salvo apenas no `localStorage` do navegador, sem vínculo com turma, professor ou banco de dados.
3. Com o código da turma, cria uma conta (nome de usuário + PIN de 4 dígitos) ou faz login se já tiver uma; o progresso vai para o Supabase e aparece no dashboard do professor.
4. No menu, vê **4 módulos** (Adição, Subtração, Multiplicação, Divisão), cada um com **5 níveis** de dificuldade crescente — 20 fases no total. Cada nível só desbloqueia depois que o anterior é concluído.
5. Cada pergunta é gerada aleatoriamente, com um cenário temático (mercado, escola, fazenda, festa, aquário, parque, praia, casa) que muda o visual da tela.

### Professor
1. Na tela inicial, o professor toca em **"Sou professor(a)"** e cria uma conta própria (usuário + senha) ou faz login.
2. Ao entrar, vê a lista de **turmas que ele mesmo criou**, com um formulário para criar novas turmas (cada uma recebe um código de 4 dígitos gerado automaticamente).
3. Ao clicar em uma turma, vê um **dashboard de desempenho**: para cada aluno, quantas fases já foram concluídas (de 20) e a pontuação total — a lista já vem ordenada da maior para a menor pontuação. Também pode **redefinir a senha de um aluno** (pede confirmação antes) caso ele a esqueça — a nova senha vira o código da turma — e **excluir a turma** (também com confirmação). A exclusão é lógica: a turma some da lista e o código para de funcionar, mas nada é apagado do banco.

Professores, turmas, contas de aluno e o progresso de quem joga logado ficam salvos no **Supabase**. Cada professor só enxerga as turmas que ele próprio criou (o backend valida isso a cada requisição do dashboard).

## 1. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor** e rode o conteúdo de `database/schema.sql`. Isso cria as tabelas `professores`, `turmas`, `alunos` e `progresso`.
   - Se você já tinha um banco de uma versão anterior (sem a tabela `professores`), pode rodar o script de novo sem medo: todos os `create table`/`add column` usam `if not exists`, então só o que falta é adicionado, sem apagar dados existentes.
3. Em **Project Settings → API**, copie:
   - `Project URL` → vai em `SUPABASE_URL`
   - `service_role key` (não a `anon key`!) → vai em `SUPABASE_SERVICE_KEY`

   A `service_role key` só é usada no backend (nunca é exposta ao navegador), o que é seguro mesmo com Row Level Security habilitado sem policies.

## 2. Configurar e rodar o backend

```bash
cd backend
cp .env.example .env
# edite o .env com SUPABASE_URL, SUPABASE_SERVICE_KEY e um QUESTION_SECRET próprio
npm install
npm start
```

O servidor sobe em `http://localhost:3000` e **também serve o frontend** (pasta `frontend/`) automaticamente — não precisa de um segundo servidor. Basta abrir `http://localhost:3000` no navegador.

## 3. Deploy na Vercel

O projeto já vem com um `vercel.json` na raiz pronto para isso: o backend (`backend/server.js`) é publicado como uma função serverless (`@vercel/node`) e o frontend (pasta `frontend/`) como arquivos estáticos — os dois no mesmo domínio, sem CORS entre eles.

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Em **Project Settings → Environment Variables**, adicione as mesmas três variáveis do `.env` local: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` e `QUESTION_SECRET`. A Vercel **não lê o arquivo `.env`** do repositório (ele nem é versionado) — as variáveis precisam ser cadastradas por lá. Para a leitura em voz alta, cadastre também `AZURE_SPEECH_KEY` e `AZURE_SPEECH_REGION` (ver seção 3.1).
3. Faça o deploy (ou **Redeploy**, se o projeto já existia e só faltavam as variáveis). Não é preciso configurar Build Command nem Output Directory — o `vercel.json` já define as duas partes (função da API + estáticos do frontend).

## 3.1. Leitura do enunciado em voz alta (Azure Speech, plano gratuito)

O botão de som do jogo lê a pergunta com uma voz neural masculina em pt-BR gerada pelo backend, igual em todos os aparelhos. Usamos o plano **Free (F0)** da Azure, que dá 500 mil caracteres por mês (cerca de 4 mil leituras) e **não gera cobrança**: quando a cota acaba, a Azure recusa as requisições até o mês seguinte e o jogo passa a usar a voz do navegador automaticamente.

1. No [portal da Azure](https://portal.azure.com), crie um recurso **Speech** (Serviços de Fala) e, em **Tipo de preço**, escolha **Free F0**.
2. Em **Chaves e Ponto de Extremidade**, copie a **Chave 1** e a **Região** (ex.: `brazilsouth`).
3. Cadastre `AZURE_SPEECH_KEY` e `AZURE_SPEECH_REGION` no `.env` local e na Vercel. Opcional: `AZURE_SPEECH_VOICE` para trocar a voz (padrão `pt-BR-AntonioNeural`).

Sem essas variáveis o jogo continua funcionando, só que lendo com a voz do navegador (quando houver uma voz natural instalada).

## 4. Estrutura de pastas

```
calculoco/
├── vercel.json          # roteia /api/* para o backend (função serverless) e o resto para o frontend estático
├── frontend/
│   ├── index.html      # telas: turma → login/cadastro do aluno → menu → jogo
│   │                    #        + login/cadastro do professor → minhas turmas → dashboard
│   ├── style.css        # identidade visual (cores, fontes, componentes)
│   └── app.js            # lógica ES6: fetch na API, navegação, estado do jogo e da área do professor
├── backend/
│   ├── server.js               # servidor Express
│   ├── supabaseClient.js       # conexão com o Supabase
│   ├── routes/
│   │   ├── turmas.js           # criar turma, validar código, dashboard de desempenho da turma
│   │   ├── auth.js             # cadastro e login do aluno (usuário + PIN)
│   │   ├── professores.js      # cadastro e login do professor (usuário + senha), lista de turmas
│   │   ├── progresso.js        # ler/gravar progresso por fase
│   │   ├── fases.js            # gerar pergunta aleatória e verificar resposta
│   │   └── tts.js              # áudio do enunciado via Azure Speech (com cache e fallback)
│   ├── utils/
│   │   ├── perguntas.js        # gerador de perguntas dos 4 módulos, com dificuldade progressiva
│   │   └── token.js            # assina/valida a resposta correta sem expor no HTML
│   ├── package.json
│   └── .env.example
└── database/
    └── schema.sql        # tabelas professores / turmas / alunos / progresso
```

## 5. Segurança das perguntas

A resposta correta **nunca** é enviada em texto aberto para o navegador. O backend **criptografa** um token (AES-256-GCM, validade de 5 minutos) contendo o índice da alternativa correta; o token é opaco, então nem decodificando dá para ler a resposta. O frontend devolve esse token ao responder e o backend o descriptografa para conferir o acerto.

Além disso, as rotas do professor exigem um **token de sessão** (devolvido no login/cadastro, enviado no header `Authorization: Bearer`): o backend tira o `professor_id` do token assinado, em vez de confiar no id que o navegador manda. Assim ninguém acessa turmas de outro professor só por saber o UUID dele.

## 6. Endpoints da área do professor

| Rota | Descrição |
|---|---|
| `POST /api/professores/cadastro` | Cria uma conta de professor `{ nome, usuario, senha }` |
| `POST /api/professores/login` | Login do professor `{ usuario, senha }` |
| `GET /api/professores/:professor_id/turmas` | Lista as turmas criadas por esse professor, com contagem de alunos |

As rotas do professor (listar turmas, criar/excluir turma, dashboard, redefinir PIN) exigem o header `Authorization: Bearer <token>` devolvido no login/cadastro.
| `POST /api/turmas` | Cria uma turma `{ nome_turma, professor_id }` (exige professor autenticado) |
| `GET /api/turmas/:turma_id/desempenho?professor_id=...` | Dashboard: progresso de cada aluno da turma (só o professor dono da turma pode acessar) |
| `POST /api/turmas/:turma_id/alunos/:aluno_id/redefinir-pin` | Redefine o PIN do aluno para o código da turma `{ professor_id }` |
| `DELETE /api/turmas/:turma_id` | Exclui a turma de forma lógica `{ professor_id }`: some da lista e o código para de funcionar, mas nada é apagado do banco |

## 7. Testes

Os testes ficam em `tests/` (não fazem parte do deploy) e usam um Supabase falso em memória — nunca tocam no banco real.

```bash
cd backend && npm install      # dependências do backend (usadas pelos testes)
cd ../tests && npm install
npm test            # backend (node:test)
npm run test:e2e    # navegador (Playwright, usa o Google Chrome instalado)
```

## 8. Próximos passos sugeridos

- Adicionar recuperação de senha do professor.
- Expandir o dashboard com um detalhamento por módulo (não só o total de fases concluídas).
- Alternativas de hospedagem além da Vercel: Render, Railway ou Fly.io (backend Node "tradicional", sem modelo serverless).
