const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const supabase = require("../supabaseClient");

function pinValido(pin) {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

// POST /api/auth/cadastro  { codigo_turma, nome_usuario, pin }
router.post("/cadastro", async (req, res) => {
  const { codigo_turma, nome_usuario, pin } = req.body;

  if (!codigo_turma || !nome_usuario || !pinValido(pin)) {
    return res
      .status(400)
      .json({ erro: "Dados inválidos. O PIN deve ter exatamente 4 dígitos." });
  }

  const nomeLimpo = String(nome_usuario).trim();
  if (nomeLimpo.length < 2) {
    return res.status(400).json({ erro: "Nome de usuário muito curto." });
  }

  const { data: turma, error: erroTurma } = await supabase
    .from("turmas")
    .select("id")
    .eq("codigo", codigo_turma)
    .maybeSingle();

  if (erroTurma) return res.status(500).json({ erro: erroTurma.message });
  if (!turma) return res.status(404).json({ erro: "Código de turma não encontrado." });

  const { data: existente } = await supabase
    .from("alunos")
    .select("id")
    .eq("turma_id", turma.id)
    .ilike("nome_usuario", nomeLimpo)
    .maybeSingle();

  if (existente) {
    return res.status(409).json({
      erro: "Esse nome de usuário já existe nesta turma. Escolha outro ou faça login.",
    });
  }

  const pinHash = await bcrypt.hash(pin, 10);

  const { data: aluno, error } = await supabase
    .from("alunos")
    .insert({ turma_id: turma.id, nome_usuario: nomeLimpo, pin_hash: pinHash })
    .select("id, nome_usuario, turma_id")
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.status(201).json({ aluno });
});

// POST /api/auth/login  { codigo_turma, nome_usuario, pin }
router.post("/login", async (req, res) => {
  const { codigo_turma, nome_usuario, pin } = req.body;

  if (!codigo_turma || !nome_usuario || !pinValido(pin)) {
    return res.status(400).json({ erro: "Dados inválidos." });
  }

  const { data: turma } = await supabase
    .from("turmas")
    .select("id")
    .eq("codigo", codigo_turma)
    .maybeSingle();

  if (!turma) return res.status(404).json({ erro: "Código de turma não encontrado." });

  const { data: aluno } = await supabase
    .from("alunos")
    .select("id, nome_usuario, turma_id, pin_hash")
    .eq("turma_id", turma.id)
    .ilike("nome_usuario", String(nome_usuario).trim())
    .maybeSingle();

  if (!aluno) return res.status(404).json({ erro: "Usuário não encontrado nesta turma." });

  const confere = await bcrypt.compare(pin, aluno.pin_hash);
  if (!confere) return res.status(401).json({ erro: "PIN incorreto." });

  res.json({
    aluno: { id: aluno.id, nome_usuario: aluno.nome_usuario, turma_id: aluno.turma_id },
  });
});

module.exports = router;
