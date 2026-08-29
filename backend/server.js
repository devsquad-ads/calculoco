require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const turmasRouter = require("./routes/turmas");
const authRouter = require("./routes/auth");
const progressoRouter = require("./routes/progresso");
const fasesRouter = require("./routes/fases");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/turmas", turmasRouter);
app.use("/api/auth", authRouter);
app.use("/api/progresso", progressoRouter);
app.use("/api/fases", fasesRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Serve o frontend estático (HTML/CSS/JS) a partir do mesmo servidor,
// facilitando o deploy em um único serviço de hospedagem gratuito.
app.use(express.static(path.join(__dirname, "..", "frontend")));

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  console.log(`Calculoco backend rodando em http://localhost:${PORTA}`);
});
