const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { TOTAL_FASES } = require("../utils/perguntas");

// Pontuação por número de tentativas até acertar (1ª tentativa = melhor
// pontuação). Ver PONTOS_POR_TENTATIVA em frontend/app.js, que usa a mesma regra.
const PONTOS_POSSIVEIS = [0, 5, 10, 20];

// GET /api/progresso/:aluno_id
router.get("/:aluno_id", async (req, res) => {
  const { aluno_id } = req.params;

  const { data, error } = await supabase
    .from("progresso")
    .select("fase_numero, concluida, pontos")
    .eq("aluno_id", aluno_id)
    .order("fase_numero", { ascending: true });

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ progresso: data });
});

// POST /api/progresso  { aluno_id, fase_numero, concluida, pontos }
router.post("/", async (req, res) => {
  const { aluno_id, fase_numero, concluida, pontos } = req.body;

  if (!aluno_id || !fase_numero) {
    return res.status(400).json({ erro: "aluno_id e fase_numero são obrigatórios." });
  }

  if (!Number.isInteger(fase_numero) || fase_numero < 1 || fase_numero > TOTAL_FASES) {
    return res.status(400).json({ erro: `fase_numero deve ser um número entre 1 e ${TOTAL_FASES}.` });
  }

  if (pontos !== undefined && !PONTOS_POSSIVEIS.includes(pontos)) {
    return res.status(400).json({ erro: `pontos deve ser um destes valores: ${PONTOS_POSSIVEIS.join(", ")}.` });
  }

  const { data, error } = await supabase
    .from("progresso")
    .upsert(
      {
        aluno_id,
        fase_numero,
        concluida: !!concluida,
        pontos: pontos || 0,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "aluno_id,fase_numero" }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.status(201).json(data);
});

module.exports = router;
