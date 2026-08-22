-- Sexta mensagem: recuperação de senha pedida pelo próprio cliente.
INSERT INTO "TemplateEmail"
  ("chave","assunto","titulo","corpo","ativo","assuntoPadrao","tituloPadrao","corpoPadrao","atualizadoEm")
VALUES
  ('recuperar-senha', 'Criar nova senha — Guppy de Linhagem', 'Vamos criar sua nova senha', 'Oi {{nome}}, chegou um pedido para criar uma nova senha da sua conta no site.

{{botao_redefinir}}

Este link vale por {{validade}} e serve uma vez só. Se o botão não funcionar, copie e cole no navegador:

{{link}}

Se não foi você que pediu, ignore este e-mail. Sua senha continua a mesma.', true,
   'Criar nova senha — Guppy de Linhagem', 'Vamos criar sua nova senha', 'Oi {{nome}}, chegou um pedido para criar uma nova senha da sua conta no site.

{{botao_redefinir}}

Este link vale por {{validade}} e serve uma vez só. Se o botão não funcionar, copie e cole no navegador:

{{link}}

Se não foi você que pediu, ignore este e-mail. Sua senha continua a mesma.', NOW())
ON CONFLICT ("chave") DO NOTHING;
