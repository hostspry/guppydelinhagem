-- "Pedido enviado" vira "encomenda postada".
--
-- O e-mail saía na compra da etiqueta, com o pacote ainda em casa. Agora sai
-- quando a transportadora registra a postagem (ou quando o envio é registrado
-- à mão), e o texto passa a dizer isso, com o dia: {{quando_postou}} vira
-- "hoje", "ontem" ou "no dia 12/09".
--
-- Troca o texto atual E o de fábrica, a pedido do dono. O texto antigo tinha o
-- WhatsApp e a assinatura, que continuam.
UPDATE "TemplateEmail" SET
  "assunto" = 'Oba! Sua encomenda {{numero}} foi postada',
  "titulo"  = 'Oba, sua encomenda foi postada!',
  "corpo"   = 'Oi {{nome}}! A encomenda do pedido **{{numero}}** foi postada {{quando_postou}} {{transportadora}} e já está a caminho.

{{caixa_rastreio}}

{{botao_rastrear}}

O rastreio pode levar algumas horas para mostrar a primeira movimentação. Se o link ainda não mostrar nada, é normal.

Peixe viaja embalado com oxigênio. Quando chegar, deixe o saquinho fechado boiando no aquário por uns 20 minutos antes de abrir, para a temperatura igualar.

Qualquer coisa no caminho, me chama no WhatsApp: 28 999179747

Obrigado por escolher A Marchezi Guppy Farm.',
  "assuntoPadrao" = 'Oba! Sua encomenda {{numero}} foi postada',
  "tituloPadrao"  = 'Oba, sua encomenda foi postada!',
  "corpoPadrao"   = 'Oi {{nome}}! A encomenda do pedido **{{numero}}** foi postada {{quando_postou}} {{transportadora}} e já está a caminho.

{{caixa_rastreio}}

{{botao_rastrear}}

O rastreio pode levar algumas horas para mostrar a primeira movimentação. Se o link ainda não mostrar nada, é normal.

Peixe viaja embalado com oxigênio. Quando chegar, deixe o saquinho fechado boiando no aquário por uns 20 minutos antes de abrir, para a temperatura igualar.

Qualquer coisa no caminho, me chama no WhatsApp: 28 999179747

Obrigado por escolher A Marchezi Guppy Farm.',
  "atualizadoEm" = NOW()
WHERE "chave" = 'pedido-enviado';

UPDATE "TemplateEmail" SET
  "assunto" = 'Oba! Sua encomenda {{numero}} foi postada',
  "titulo"  = 'Oba, sua encomenda foi postada!',
  "corpo"   = 'Oi {{nome}}! A encomenda do pedido **{{numero}}** foi postada {{quando_postou}} {{transportadora}} e já está a caminho.

{{caixa_rastreio}}

{{botao_rastrear}}

O rastreio pode levar algumas horas para mostrar a primeira movimentação. Se o link ainda não mostrar nada, é normal.

O prazo que aparece no rastreio conta em dias úteis, a partir da postagem.

Qualquer coisa no caminho, me chama no WhatsApp: 28 999179747

Obrigado por escolher A Marchezi Guppy Farm.',
  "assuntoPadrao" = 'Oba! Sua encomenda {{numero}} foi postada',
  "tituloPadrao"  = 'Oba, sua encomenda foi postada!',
  "corpoPadrao"   = 'Oi {{nome}}! A encomenda do pedido **{{numero}}** foi postada {{quando_postou}} {{transportadora}} e já está a caminho.

{{caixa_rastreio}}

{{botao_rastrear}}

O rastreio pode levar algumas horas para mostrar a primeira movimentação. Se o link ainda não mostrar nada, é normal.

O prazo que aparece no rastreio conta em dias úteis, a partir da postagem.

Qualquer coisa no caminho, me chama no WhatsApp: 28 999179747

Obrigado por escolher A Marchezi Guppy Farm.',
  "atualizadoEm" = NOW()
WHERE "chave" = 'pedido-enviado-seco';
