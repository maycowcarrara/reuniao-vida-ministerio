# Planejamento de troca de dias de reunião

Nas configurações, cada reunião semanal tem um dia atual e uma próxima troca com data de vigência e novo dia. No modo por grupos, o planejamento é independente para cada grupo e para meio de semana/fim de semana. Reuniões por datas explícitas continuam usando suas datas escolhidas.

## Exemplo da virada de 2026 para 2027

Com quinta-feira e domingo como dias atuais e vigência em 01/01/2027 para quarta-feira e sábado:

| Semana | Meio de semana | Fim de semana |
| --- | --- | --- |
| 21 a 27/12/2026 | Quinta, 24/12/2026 | Domingo, 27/12/2026 |
| 28/12/2026 a 03/01/2027 | Quinta, 31/12/2026 | Sábado, 02/01/2027 |
| 04 a 10/01/2027 | Quarta, 06/01/2027 | Sábado, 09/01/2027 |

O cálculo considera a data civil de cada reunião. A semana pode conter dois regimes diferentes. Não depende da data em que a designação é preparada.

## Persistência e promoção

No modelo por grupos, cada `grupos[id].meioSemana` / `fimDeSemana` recebe:

```json
{
  "dia": "thursday",
  "proximaTroca": { "data": "2027-01-01", "dia": "wednesday" },
  "historicoDias": []
}
```

Quando a vigência chega, o aplicativo promove o novo dia, define `proximaTroca: null` e acrescenta `{ data, dia, diaAnterior }` a `historicoDias`. A promoção acontece ao abrir o painel, ao recuperar o foco e em uma verificação a cada minuto enquanto o painel está aberto. O cálculo por vigência já funciona antes da gravação dessa promoção, inclusive para programações futuras e no quadro público. A data corrente usada na promoção é a de São Paulo.

O histórico é preservado nas próximas trocas anuais e não pode ser substituído pelo formulário de configurações. A configuração legada usa `planejamentoReunioes.meioSemana` / `fimDeSemana` para os campos de planejamento, mantendo `dia_reuniao` e `dia_reuniao_fds` para compatibilidade.

## Programações existentes e integrações

- Ao definir, editar ou cancelar uma troca, recalculam-se as ocorrências futuras que seguiam o padrão anterior. Preservam-se datas manuais distintas, reuniões passadas, arquivos, cancelamentos e eventos especiais.
- A gravação remota da configuração e das programações afetadas é uma transação única com validação das versões lidas. Alterações concorrentes impedem a gravação parcial.
- IDs, designados, vínculos legados e dados adicionais das programações são conservados. O quadro é republicado após salvar.
- Reuniões publicadas com data alterada recebem pendências de agenda e histórico; a sincronização continua sendo uma ação explícita do administrador.
- Importação, geração semanal, designações, sugestões, impressão, mensagens, confirmações e agenda usam a mesma regra por vigência. Confirmações v2 conservam identidade, token, respostas e canais; sua data exibida vem da reunião atual.
- Datas de vigência que criariam duas reuniões do mesmo tipo na semana, ou nenhuma, são recusadas com orientação para escolher outra data. A segunda-feira da semana desejada evita essa ambiguidade.

## Verificação

`npm test` inclui `scripts/test-troca-dias-reuniao.mjs`: virada de ano, vigência inclusiva, múltiplas trocas, promoção idempotente, cancelamento, grupos, exceções, fusos e integração entre os fluxos. `npm run test:rules:local` testa a gravação conjunta e a publicação com o adaptador e as regras reais no emulador, sem alterar dados de produção.
