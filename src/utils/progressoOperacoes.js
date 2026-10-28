const operacoes = new Map();
const listeners = new Set();
const vazio = { pendentes: 0, tipo: '', desde: 0, terminouEm: 0, falhou: false, ciclo: 0, fase: 'ocioso' };
let snapshot = vazio;
let proximoId = 0;
let proximoCiclo = 0;
let conclusao;

const notificar = () => listeners.forEach(listener => listener());

const emitir = () => {
    const ativas = [...operacoes.values()];
    snapshot = ativas.length
        ? { ...snapshot, pendentes: ativas.length, tipo: ativas.at(-1).tipo }
        : { ...snapshot, pendentes: 0 };
    notificar();
    if (!operacoes.size) {
        // Só a apresentação aguarda. A promessa já terminou e os controles
        // podem ser liberados. Etapas contíguas mantêm o avanço da linha.
        conclusao = setTimeout(() => {
            conclusao = undefined;
            if (operacoes.size) return;
            snapshot = { ...snapshot, fase: 'concluido', terminouEm: Date.now() };
            notificar();
        }, 120);
    }
};

export const progressoOperacoes = {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    getPendentes: () => snapshot.pendentes,
    getServerSnapshot: () => vazio,
};

// A indicação começa no clique e só termina quando a promessa real termina.
// Um aviso de demora não cancela a escrita nem libera uma segunda tentativa.
export const acompanharOperacao = async (tipo, executar) => {
    const id = ++proximoId;
    if (conclusao !== undefined) { clearTimeout(conclusao); conclusao = undefined; }
    if (!operacoes.size && snapshot.fase !== 'processando') {
        snapshot = { ...vazio, tipo, desde: Date.now(), ciclo: ++proximoCiclo, fase: 'processando' };
    }
    operacoes.set(id, { tipo, desde: Date.now() });
    emitir();
    try { return await executar(); }
    catch (error) { snapshot = { ...snapshot, falhou: true }; throw error; }
    finally { operacoes.delete(id); emitir(); }
};
