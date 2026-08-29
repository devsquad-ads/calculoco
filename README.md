# Calculoco 🐒

Jogo educativo web para crianças praticarem as quatro operações básicas de matemática.

- **HTML5** — `frontend/index.html`
- **CSS3** — `frontend/style.css`
- **ECMAScript 6** — `frontend/app.js`
- **Node.js (Express)** — `backend/`
- **Banco de dados** — Supabase (PostgreSQL)

## Como funciona o fluxo

1. O **professor** cadastra uma turma (pela seção "Sou professor(a)" na tela inicial) e recebe um **código de 4 dígitos**.
2. O **aluno** digita esse código para entrar na turma.
3. Dentro da turma, o aluno **cria uma conta** (nome de usuário + PIN de 4 dígitos) ou **faz login** se já tiver uma.
4. No menu, o aluno vê as fases: a **Fase 1 (Adição)** já está jogável, com perguntas geradas aleatoriamente e 4 alternativas de múltipla escolha. As fases seguintes ficam **bloqueadas até a anterior ser concluída**.
5. Tudo — turmas, contas e progresso — fica salvo no **Supabase**.

## 1. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor** e rode o conteúdo de `database/schema.sql`. Isso cria as tabelas `turmas`, `alunos` e `progresso`.
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

## 3. Estrutura de pastas

```
calculoco/
├── frontend/
│   ├── index.html      # telas: turma → login/cadastro → menu → jogo
│   ├── style.css        # identidade visual (cores, fontes, componentes)
│   └── app.js            # lógica ES6: fetch na API, navegação, estado do jogo
├── backend/
│   ├── server.js               # servidor Express
│   ├── supabaseClient.js       # conexão com o Supabase
│   ├── routes/
│   │   ├── turmas.js           # criar turma / validar código
│   │   ├── auth.js             # cadastro e login do aluno (usuário + PIN)
│   │   ├── progresso.js        # ler/gravar progresso por fase
│   │   └── fases.js            # gerar pergunta aleatória e verificar resposta
│   ├── utils/
│   │   ├── perguntas.js        # gerador de perguntas de adição com números aleatórios
│   │   └── token.js            # assina/valida a resposta correta sem expor no HTML
│   ├── package.json
│   └── .env.example
└── database/
    └── schema.sql        # tabelas turmas / alunos / progresso
```

## 4. Segurança das perguntas

A resposta correta **nunca** é enviada em texto aberto para o navegador. O backend assina um token (HMAC-SHA256, com validade de 5 minutos) contendo o índice da alternativa correta. O frontend devolve esse token junto com a resposta escolhida, e o backend confirma o acerto comparando a assinatura — assim não dá para "ver a resposta certa" só inspecionando a resposta da API.

## 5. Próximos passos sugeridos

- Implementar os geradores de pergunta das fases 2 (subtração), 3 (multiplicação) e 4 (divisão) em `backend/utils/perguntas.js`, seguindo o mesmo padrão da fase 1.
- Adicionar uma tela de relatório de desempenho para o professor (consultando a tabela `progresso` agrupada por turma).
- Hospedar o backend em um serviço gratuito (Render, Railway, Fly.io) e apontar as variáveis de ambiente do Supabase por lá.
