// Também recupera links abertos pelo HTML de versões anteriores, que ainda
// não sabem solicitar a atualização automática da confirmação.
const atualizacaoDeWorkerExistente = Boolean(self.registration.active);
const listarConfirmacoesAbertas = async () => {
  const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return abas.filter(aba => {
    const url = new URL(aba.url);
    return url.origin === self.location.origin && url.pathname.startsWith('/c/');
  });
};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    if ((await listarConfirmacoesAbertas()).length) await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  if (!atualizacaoDeWorkerExistente) return;
  event.waitUntil((async () => {
    const abas = await listarConfirmacoesAbertas();
    // Preserva token, resposta direta e fluxo de lembrete na mesma URL.
    // A navegação espera o worker ativar. Não aguardá-la dentro de waitUntil
    // evita que a própria ativação fique esperando essa navegação terminar.
    abas.forEach(aba => {
      aba.navigate(aba.url).catch(() => {
        // Uma aba fechada durante a ativação não impede as demais.
      });
    });
  })());
});
