const { defineConfig } = require("@playwright/test");

const PORTA = 3999;

module.exports = defineConfig({
  testDir: "./navegador",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    // Chrome instalado na máquina
    channel: "chrome",
    headless: true,
  },
  webServer: {
    command: "node apoio/servidorTeste.js",
    url: `http://127.0.0.1:${PORTA}/api/health`,
    env: { PORTA_TESTE: String(PORTA) },
    reuseExistingServer: false,
  },
});
