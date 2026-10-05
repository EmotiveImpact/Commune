import { createServer } from 'vite';
const server = await createServer({ root: '/Users/augustusedem/Commune/web', server: { port: 3004, host: '127.0.0.1' } });
await server.listen();
server.printUrls();
