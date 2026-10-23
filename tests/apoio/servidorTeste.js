// Sobe o backend com o Supabase falso. Usado pelos testes de unidade e,
// rodando direto, como webServer do Playwright.

const { instalarSupabaseFalso } = require("./supabaseFalso");

delete process.env.AZURE_SPEECH_KEY;
delete process.env.AZURE_SPEECH_REGION;
process.env.QUESTION_SECRET = "segredo-de-teste";

function iniciarServidor(porta = 0) {
  const supabase = instalarSupabaseFalso();
  const app = require("../../backend/server");
  return new Promise((resolve) => {
    const servidor = app.listen(porta, () => {
      const url = `http://127.0.0.1:${servidor.address().port}`;
      resolve({ servidor, url, supabase });
    });
  });
}

module.exports = { iniciarServidor };

if (require.main === module) {
  const porta = Number(process.env.PORTA_TESTE || 3999);
  iniciarServidor(porta).then(({ url }) => console.log(`Servidor de teste em ${url}`));
}
