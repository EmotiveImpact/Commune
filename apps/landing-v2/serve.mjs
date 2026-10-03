import { createServer } from 'vite';
const server = await createServer({ root: '/Users/augustusedem/Commune/apps/landing-v2', server: { port: 3002, host: '127.0.0.1' } });
await server.listen();
server.printUrls();
