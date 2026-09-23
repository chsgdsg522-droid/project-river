import { createServer } from './src/createServer.js';

const port = Number.parseInt(process.env.PORT ?? '8080', 10);
const server = createServer({ port, host: '0.0.0.0' });

server.start()
  .then(({ url }) => {
    process.stdout.write(`Project River server listening at ${url}\n`);
  })
  .catch(error => {
    process.stderr.write(`Failed to start Project River server: ${error.message}\n`);
    process.exitCode = 1;
  });

async function shutdown() {
  try {
    await server.stop();
  } finally {
    process.exit(0);
  }
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
