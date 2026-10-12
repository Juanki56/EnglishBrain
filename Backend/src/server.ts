import { config as loadDotenv } from 'dotenv';
import { createApp } from './app.js';
import { ConfigError, loadConfig, type Config } from './config.js';
import { createSupabaseAdmin } from './services/supabase.js';

loadDotenv({ quiet: true });

let config: Config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`\n✖ ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

const app = createApp({ supabase: createSupabaseAdmin(config) });

app.listen(config.port, (error?: Error) => {
  if (error) {
    console.error(`\n✖ No se pudo arrancar en el puerto ${config.port}: ${error.message}\n`);
    process.exit(1);
  }
  console.log(`EnglishBrain API escuchando en http://localhost:${config.port}`);
});
