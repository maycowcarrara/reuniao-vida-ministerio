import { createServer } from 'vite';
// Somente fixtures em memória; escolhe a interface estabelecida para QA local.
const server = await createServer({ server: { host: '127.0.0.1', port: 5196, strictPort: true, hmr: false },
    define: { 'import.meta.env.VITE_MULTI_GRUPOS_LOCAL': JSON.stringify('true') },
    plugins: [{ name: 'qa-interface-estabelecida', enforce: 'pre', transform(code, id) {
        if (!id.replaceAll('\\', '/').endsWith('/src/App.jsx')) return null;
        const source = 'const usarInterfaceIndependente = MULTI_GRUPOS_LOCAL;';
        if (!code.includes(source)) throw new Error('Harness não reconhece a seleção de interface.');
        return { code: code.replace(source, 'const usarInterfaceIndependente = false;').replace('mostrarAcessos={!MULTI_GRUPOS_LOCAL}', 'mostrarAcessos={true}'), map: null };
    } }] });
await server.listen();
console.log('QA local com fixtures: http://127.0.0.1:5196/admin');
