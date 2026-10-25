import fs from 'node:fs/promises';
import { build } from 'vite';
const audit = JSON.parse(await fs.readFile('tmp/revisao-geral-dependencias.json', 'utf8'));
const names = Object.keys(audit.vulnerabilities || {});
let report;
await build({ plugins: [{ name: 'inventario-do-bundle-de-revisao', async generateBundle(_options, bundle) {
    const modules = Object.values(bundle).filter(v => v.type === 'chunk').flatMap(chunk => Object.entries(chunk.modules).filter(([, info]) => info.renderedLength > 0).map(([id]) => id.replaceAll('\\', '/')));
    report = { at: new Date().toISOString(), renderedModules: modules.length,
        alerts: names.map(name => ({ name, severity: audit.vulnerabilities[name].severity, renderedInBrowser: modules.some(id => id.includes('/node_modules/' + name + '/')) })),
        notes: ['Incluído no bundle não demonstra explorabilidade. Avaliar cada aviso conforme o modo de uso.', 'SPA declarativa com BrowserRouter; sem servidor React Router em produção.'], modules };
} }] });
await fs.writeFile('tmp/revisao-geral-bundle.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ renderedModules: report.renderedModules, alertsInBrowser: report.alerts.filter(a => a.renderedInBrowser).map(a => a.name) }));
