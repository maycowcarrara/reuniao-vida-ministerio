const serializar = value => JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
        ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

export const dadosIguais = (a, b) => a === b || serializar(a) === serializar(b);

// A ordem do histórico não muda o conteúdo; duplicatas continuam contando.
export const historicosIguais = (a = [], b = []) => a === b || dadosIguais(a.map(serializar).sort(), b.map(serializar).sort());

export const registrosAlterados = (proximos, anteriores) => {
    const porId = new Map(anteriores.map(item => [String(item.id), item]));
    return proximos.filter(item => !dadosIguais(item, porId.get(String(item.id))));
};
