import net from 'node:net';
// Never kill unrelated developer processes. emulators:exec owns and closes its children.
const ports = [3000, 4000, 4400, 4500, 5001, 8080, 9099, 9199, 9150];
for (const port of ports) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Port ${port} is occupied. Stop the owning development/emulator process before starting an isolated test run.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
console.log('Emulator ports available.');
