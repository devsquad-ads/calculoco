const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const supabase = require("../supabaseClient");

function credenciaisValidas(usuario, senha) {
  return (
    typeof usuario === "string" &&
    usuario.trim().length >= 3 &&
    typeof senha === "string" &&
    senha.length >= 4
  );
}

// POST /api/professores/cadastro  { nome, usuario, senha }
router.post("/cadastro", async (req, res) => {
  const { nome, usuario, senha } = req.body;

  if (!nome || !nome.trim() || !credenciaisValidas(usuario, senha)) {
    return res.status(400).json({
      erro: "Informe seu nome, um usuário (mín. 3 caracteres) e uma senha (mín. 4 caracteres).",
    });
  }

  const usuarioLimpo = String(usuario).trim().toLowerCase();

  const { data: existente } = await supabase
    .from("professores")
    .select("id")
    .ilike("usuario", usuarioLimpo)
    .maybeSingle();

  if (existente) {
    return res.status(409).json({
      erro: "Esse usuário já está cadastrado. Faça login ou escolha outro usuário.",
    });
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const { data: professor, error } = await supabase
    .from("professores")
    .insert({ usuario: usuarioLimpo, senha_hash: senhaHash, nome: nome.trim() })
    .select("id, usuario, nome")
    .single();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        erro: "Esse usuário já está cadastrado. Faça login ou escolha outro usuário.",
      });
    }
    return res.status(500).json({ erro: error.message });
  }
  res.status(201).json({ professor });
});

// POST /api/professores/login  { usuario, senha }
router.post("/login", async (req, res) => {
  const { usuario, senha } = req.body;

  if (!credenciaisValidas(usuario, senha)) {
    return res.status(400).json({ erro: "Informe usuário e senha." });
  }

  const { data: professor } = await supabase
    .from("professores")
    .select("id, usuario, nome, senha_hash")
    .ilike("usuario", String(usuario).trim().toLowerCase())
    .maybeSingle();

  if (!professor) return res.status(404).json({ erro: "Usuário não encontrado." });

  const confere = await bcrypt.compare(senha, professor.senha_hash);
  if (!confere) return res.status(401).json({ erro: "Senha incorreta." });

  res.json({
    professor: { id: professor.id, usuario: professor.usuario, nome: professor.nome },
  });
});

// GET /api/professores/:professor_id/turmas
// Lista as turmas criadas por esse professor, com a contagem de alunos de cada uma.
router.get("/:professor_id/turmas", async (req, res) => {
  const { professor_id } = req.params;

  const { data: turmas, error } = await supabase
    .from("turmas")
    .select("id, codigo, nome_turma, criado_em")
    .eq("professor_id", professor_id)
    .order("criado_em", { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });

  const turmaIds = (turmas || []).map((t) => t.id);
  const contagemPorTurma = {};

  if (turmaIds.length) {
    const { data: alunos, error: erroAlunos } = await supabase
      .from("alunos")
      .select("id, turma_id")
      .in("turma_id", turmaIds);

    if (erroAlunos) return res.status(500).json({ erro: erroAlunos.message });

    (alunos || []).forEach((aluno) => {
      contagemPorTurma[aluno.turma_id] = (contagemPorTurma[aluno.turma_id] || 0) + 1;
    });
  }

  res.json({
    turmas: (turmas || []).map((turma) => ({
      ...turma,
      total_alunos: contagemPorTurma[turma.id] || 0,
    })),
  });
});

module.exports = router;
