# Polymarket Decimal Odds

Extensão Chrome Manifest V3 que mostra odds decimais e estimativas de conversão USD/BRL na interface da Polymarket. A extensão não tem backend próprio e não envia conteúdo da página ou dados do usuário para o serviço de câmbio.

## Funcionalidades

- Calcula a odd decimal com `1 / preço da cota` e formata com duas casas.
- Converte valores monetários identificados como USD para BRL, mantendo o valor original.
- Atualiza as odds quando os preços mudam e atualiza a conversão monetária quando a taxa muda.
- Permite controlar odds, apresentação inline e conversão monetária separadamente no popup.
- Preserva a taxa válida mais recente em `chrome.storage.local`; após quatro dias da data da taxa, oculta os valores em BRL até receber uma taxa recente.
- Não altera o valor de campos de entrada nem modifica os controles de compra e venda.

Uma odd de 2,78 para uma cota de US$ 0,36 descreve o retorno bruto potencial de US$ 1,00 por cota vencedora antes de taxas. Não representa necessariamente a probabilidade real do evento nem garante execução pelo preço exibido.

Os valores em reais são estimativas. Não incluem tarifas, spread, impostos e não são necessariamente a taxa usada por bancos, cartões ou meios de pagamento.

## Cotação USD/BRL

A extensão usa a API pública [Frankfurter](https://frankfurter.dev/), no endpoint `https://api.frankfurter.dev/v2/rate/usd/brl`. A API não exige chave nem conta, agrega taxas diárias de fontes oficiais e aplica rate limiting contra abuso, sem limites publicados por dia ou mês. Os dados não são cotações em tempo real nem se destinam a decisões de negociação. Consulte a [documentação da API](https://frankfurter.dev/) e os termos das fontes de dados para detalhes.

O service worker busca a taxa ao iniciar e agenda consultas a cada 24 horas. O botão do popup solicita uma atualização manual, limitada a uma tentativa a cada 15 minutos. Se a rede ou a API falhar, a extensão conserva a última taxa válida, informa quando ela foi consultada e oculta a conversão na página quando a data da taxa ultrapassa quatro dias. Sem taxa válida, nenhum valor em reais é exibido.

Somente valores estáticos que apresentem um marcador monetário explícito — como `$10.00`, `US$ 10`, `USD 10` ou `36¢` — são considerados. Campos editáveis de investimento são deixados intactos para evitar alterar o layout ou a interação de negociação. Percentuais, odds, quantidades, identificadores e números sem contexto monetário não são convertidos.

## Tecnologias e estrutura

JavaScript, HTML e CSS sem framework; Chrome Extensions Manifest V3; `chrome.storage.sync` para preferências; `chrome.storage.local` e `chrome.alarms` para a taxa; `MutationObserver` para acompanhar a interface. Os testes usam `node:test` e `jsdom` como dependência de desenvolvimento.

```text
manifest.json
src/
  background/service-worker.js   # consulta e cache de câmbio
  content/                       # extração, cálculos, renderização e observação
  popup/                         # preferências e estado da taxa
  shared/constants.js            # preferências e atributos compartilhados
  styles/injected.css            # estilo discreto das conversões
tests/                           # cálculos, extração, DOM, popup e cache
```

O manifest restringe o content script a `https://polymarket.com/*` e declara `storage`, `alarms` e acesso de host à API Frankfurter. Não há telemetria nem acesso a endpoints internos da Polymarket.

## Instalação local

1. Execute `npm install` para instalar `jsdom`, usado somente nos testes.
2. Abra `chrome://extensions` no Chrome e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta do projeto.
4. Abra ou recarregue `https://polymarket.com/`.

## Testes

```sh
npm test
```

Os testes cobrem conversão e formatação, entradas monetárias ambíguas, taxas inválidas ou antigas, atualização e deduplicação do DOM, independência das preferências, persistência no popup e cache/cooldown/falhas do service worker.

## Limitações e depuração

A extração é conservadora: se o valor estático não tiver marcador de USD, a extensão não mostra conversão. Campos editáveis de investimento não recebem etiqueta BRL. Mudanças na estrutura da Polymarket podem exigir ajustes no extrator.

A integração ainda não foi validada na interface ativa do Chrome. Os testes automatizados usam fixtures DOM e não comprovam a associação em todos os cards, eventos esportivos, mercados de múltiplas opções ou formulários reais da Polymarket. Para depurar, confirme a URL, verifique se a conversão está ativada, inspecione o texto e os rótulos acessíveis do componente e confira se o preço aparece em um dos formatos suportados. A taxa e a hora da consulta ficam visíveis no popup.

## Privacidade e afiliação

A consulta externa contém apenas o par USD/BRL e não inclui preços da página nem dados pessoais. A extensão é independente e não é oficialmente afiliada, endossada ou mantida pela Polymarket.
