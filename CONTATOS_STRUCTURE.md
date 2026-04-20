# Estrutura da Página /contatos — guppydelinhagem.com.br

Extraído do HTML em 2026-04-19. Seções em ordem top → bottom, ignorando header e footer globais.

---

## SEÇÃO 1 — Hero / Banner de Página

| Campo         | Valor |
|---------------|-------|
| **Tipo**      | Hero de página com título centralizado |
| **Itens**     | 1 título |
| **Fundo**     | Imagem de fundo com overlay `#FF035C` (padrão do tema) |

**Conteúdo:**
- **H2:** "Contatos"

**CTA:** nenhum botão

---

## SEÇÃO 2 — Informações de Contato + Formulário (2 colunas)

| Campo         | Valor |
|---------------|-------|
| **Tipo**      | Layout 2 colunas: esquerda = dados de contato, direita = formulário |
| **Itens**     | 3 itens de contato + 1 formulário com 4 campos |

### Coluna Esquerda — Dados de Contato

**Ícone + H3:** "Dúvidas?" (ícone envelope)

**Subtexto:** "Precisa de ajuda ou está procurando seu primeiro Guppy para comprar? Entre em contato agora mesmo!"

**Lista de contatos (icon-list):**
| Ícone | Dado |
|-------|------|
| WhatsApp | (27) 99759-4173 → `https://wa.me/27997594173` |
| E-mail | info@seuemail.com |
| Localização | "Endereço da Loja, número, bairro, cidade e CEP" *(placeholder — não preenchido)* |

### Coluna Direita — Formulário de Contato

**Nome do formulário:** "Formulário de Contato" (Elementor Form)

**Campos:**
| Campo | Tipo | Placeholder | Obrigatório |
|-------|------|-------------|-------------|
| Nome | text | "Nome" | Sim |
| Telefone | text | "DDD + Número" | Não |
| Email | email | "Email" | Sim |
| Mensagem | textarea | "Escreva a sua dúvida aqui..." | Não |

**CTA:** Botão **"Envia Dúvida"** (submit, largura 30% desktop / 50% tablet)

---

## SEÇÃO 3 — Mapa (Google Maps Embed)

| Campo         | Valor |
|---------------|-------|
| **Tipo**      | Google Maps embed (iframe) |
| **Itens**     | 1 |

**Embed atual:** London Eye, London, UK (placeholder padrão do Elementor — não configurado para o endereço real)
```
src="https://maps.google.com/maps?q=London Eye, London, United Kingdom&t=m&z=10&output=embed"
```

> ⚠️ **Atenção:** O mapa está com endereço placeholder. No projeto novo, deve ser substituído pelo endereço real da Marchezi Guppy Farm em Guarapari-ES.

**CTA:** nenhum

---

## RESUMO DA PÁGINA /contatos

| # | Seção | Tipo | Itens | CTA |
|---|-------|------|-------|-----|
| 1 | Hero da página | Banner com título | 1 | — |
| 2 | Dados de contato + formulário | 2 colunas (info + form) | 3 contatos + 4 campos | "Envia Dúvida" (submit) |
| 3 | Mapa | Google Maps embed | 1 (placeholder) | — |

> **Nota sobre o projeto:** O endereço de e-mail `info@seuemail.com` e o endereço físico são claramente placeholders. No novo sistema, o formulário enviará e-mail via **Resend** e o campo de destino será configurado com o e-mail real do lojista/marketplace.
