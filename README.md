# Calculoco

Jogo educativo web para crianças praticarem as quatro operações básicas de matemática.

- **HTML5** — `frontend/index.html`
- **CSS3** — `frontend/style.css`
- **ECMAScript 6** — `frontend/app.js`
- **Node.js (Express)** — `backend/`
- **Banco de dados** — Supabase (PostgreSQL)

## Como funciona o fluxo

### Aluno
1. O aluno digita o **código da turma** (4 dígitos, fornecido pelo professor).
2. Dentro da turma, cria uma conta (nome de usuário + PIN de 4 dígitos) ou faz login se já tiver uma.
3. No menu, vê **4 módulos** (Adição, Subtração, Multiplicação, Divisão), cada um com **5 níveis** de dificuldade crescente — 20 fases no total. Cada nível só desbloqueia depois que o anterior é concluído.
4. Cada pergunta é gerada aleatoriamente, com um cenário temático (mercado, escola, fazenda, festa, aquário, parque, praia, casa) que muda o visual da tela.

### Professor
1. Na tela inicial, o professor toca em **"Sou professor(a)"** e cria uma conta própria (usuário + senha) ou faz login.
2. Ao entrar, vê a lista de **turmas que ele mesmo criou**, com um formulário para criar novas turmas (cada uma recebe um código de 4 dígitos gerado automaticamente).
3. Ao clicar em uma turma, vê um **dashboard de desempenho**: para cada aluno, quantas fases já foram concluídas (de 20) e a pontuação total — a lista já vem ordenada da maior para a menor pontuação. Também pode **redefinir a senha de um aluno** (pede confirmação antes) caso ele a esqueça — a nova senha vira o código da turma.

Tudo — professores, turmas, contas de aluno e progresso — fica salvo no **Supabase**. Cada professor só enxerga as turmas que ele próprio criou (o backend valida isso a cada requisição do dashboard).

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
2. Em **Project Settings → Environment Variables**, adicione as mesmas três variáveis do `.env` local: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` e `QUESTION_SECRET`. A Vercel **não lê o arquivo `.env`** do repositório (ele nem é versionado) — as variáveis precisam ser cadastradas por lá.
3. Faça o deploy (ou **Redeploy**, se o projeto já existia e só faltavam as variáveis). Não é preciso configurar Build Command nem Output Directory — o `vercel.json` já define as duas partes (função da API + estáticos do frontend).

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
│   │   └── fases.js            # gerar pergunta aleatória e verificar resposta
│   ├── utils/
│   │   ├── perguntas.js        # gerador de perguntas dos 4 módulos, com dificuldade progressiva
│   │   └── token.js            # assina/valida a resposta correta sem expor no HTML
│   ├── package.json
│   └── .env.example
└── database/
    └── schema.sql        # tabelas professores / turmas / alunos / progresso
```

## 5. Segurança das perguntas

A resposta correta **nunca** é enviada em texto aberto para o navegador. O backend assina um token (HMAC-SHA256, com validade de 5 minutos) contendo o índice da alternativa correta. O frontend devolve esse token junto com a resposta escolhida, e o backend confirma o acerto comparando a assinatura — assim não dá para "ver a resposta certa" só inspecionando a resposta da API.

## 6. Endpoints da área do professor

| Rota | Descrição |
|---|---|
| `POST /api/professores/cadastro` | Cria uma conta de professor `{ nome, usuario, senha }` |
| `POST /api/professores/login` | Login do professor `{ usuario, senha }` |
| `GET /api/professores/:professor_id/turmas` | Lista as turmas criadas por esse professor, com contagem de alunos |
| `POST /api/turmas` | Cria uma turma `{ nome_turma, professor_id }` (exige professor autenticado) |
| `GET /api/turmas/:turma_id/desempenho?professor_id=...` | Dashboard: progresso de cada aluno da turma (só o professor dono da turma pode acessar) |
| `POST /api/turmas/:turma_id/alunos/:aluno_id/redefinir-pin` | Redefine o PIN do aluno para o código da turma `{ professor_id }` |

## 7. Próximos passos sugeridos

- Adicionar recuperação de senha do professor.
- Expandir o dashboard com um detalhamento por módulo (não só o total de fases concluídas).
- Alternativas de hospedagem além da Vercel: Render, Railway ou Fly.io (backend Node "tradicional", sem modelo serverless).
