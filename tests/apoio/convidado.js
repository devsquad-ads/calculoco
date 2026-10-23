// Monta o estado de convidado com o selo de integridade, igual ao frontend
// (frontend/app.js: selarConvidado). Sem o selo correto, o jogo ignora o
// progresso — por isso os testes precisam selar o que injetam no localStorage.

function seloConvidado(progresso) {
  const texto = "calculoco-convidado-v1" + JSON.stringify(progresso);
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function estadoConvidado(progresso = [], ativo = true) {
  return { ativo, progresso, selo: seloConvidado(progresso) };
}

module.exports = { seloConvidado, estadoConvidado };
