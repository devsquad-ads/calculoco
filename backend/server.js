require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const turmasRouter = require("./routes/turmas");
const authRouter = require("./routes/auth");
const progressoRouter = require("./routes/progresso");
const fasesRouter = require("./routes/fases");
const professoresRouter = require("./routes/professores");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/turmas", turmasRouter);
app.use("/api/auth", authRouter);
app.use("/api/progresso", progressoRouter);
app.use("/api/fases", fasesRouter);
app.use("/api/professores", professoresRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Serve o frontend estático (HTML/CSS/JS) a partir do mesmo servidor quando
// rodando localmente. Na Vercel o frontend é publicado como arquivos
// estáticos e roteado direto pelo vercel.json (ver raiz do projeto), sem
// passar por este middleware.
app.use(express.static(path.join(__dirname, "..", "frontend")));

const PORTA = process.env.PORT || 3000;

// A Vercel importa este arquivo como função serverless (usa o `module.exports`
// abaixo) e nunca chama listen() — só faz isso quando rodado localmente com
// "node server.js" / "npm start".
if (require.main === module) {
  app.listen(PORTA, () => {
    console.log(`Calculoco backend rodando em http://localhost:${PORTA}`);
  });
}

module.exports = app;
