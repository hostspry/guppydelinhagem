# Prompts pro Claude Code — Refatoração visual da home

## Ordem de execução

Execute **uma fase de cada vez**. Não cole tudo de uma vez. O fluxo recomendado:

1. **Cola o prompt da fase** no Claude Code local (dentro do projeto guppydelinhagem)
2. **Aguarde o plano** que ele propõe (todos os prompts pedem plano antes de executar)
3. **Aprove ou refine** o plano com ele
4. **Deixa ele executar**
5. **Roda `npm run dev` e valida no navegador** (desktop + mobile via DevTools)
6. **Só então passa pra próxima fase**

Se algo der errado em uma fase, é melhor refinar/refazer ali do que arrastar problema pra fase seguinte.

## As fases

| Fase | Arquivo | O que faz | Tempo estimado |
|------|---------|-----------|----------------|
| 0 | `fase-0-investigacao.md` | Investiga o projeto, identifica o "N" preto, confirma stack | 5 min |
| 1 | `fase-1-hero.md` | Cria HeroHome + HeroFeatures novos | 30-45 min |
| 2 | `fase-2-product-card.md` | Cria ProductCardVideo 9:16 + estende mock-data | 45-60 min |
| 3 | `fase-3-video-modal.md` | Cria VideoModal + VideoEmbed (YouTube/IG/TikTok) | 45-60 min |
| 4 | `fase-4-carrinho.md` | Instala Zustand, cria carrinho, conecta botões | 30-45 min |
| 5 | `fase-5-categorias-limpezas.md` | Padroniza categorias + esconde seções vazias + remove "N" | 20-30 min |

**Total estimado: 3-4 horas de execução** (Claude Code trabalha bem mais rápido que humano, mas inclua tempo de validação no navegador).

## Validações em cada fase

Após cada fase, abra `localhost:3000` e confira:

### Fase 1 (Hero)
- [ ] Desktop 1440px: hero ocupa primeiro viewport, elegante
- [ ] Mobile 375px: hero compacto, CTAs grandes
- [ ] Tablet 768px: layout intermediário funciona
- [ ] Faixa de 4 diferenciais aparece logo após o hero
- [ ] Sem console errors

### Fase 2 (ProductCard)
- [ ] Mobile: 2 cards por linha
- [ ] Desktop: 3 cards por linha
- [ ] Play visível e bem posicionado
- [ ] Estado esgotado visualmente diferente
- [ ] Estado promoção com preço riscado
- [ ] Botões "Comprar agora" e "Quero comprar mais" visíveis

### Fase 3 (VideoModal)
- [ ] Clicar no play abre modal
- [ ] Desktop: vídeo + painel lado a lado
- [ ] Mobile: vídeo + bottom sheet
- [ ] ESC fecha modal
- [ ] Body não scrolla atrás
- [ ] Vídeo do YouTube toca

### Fase 4 (Carrinho)
- [ ] "Quero comprar mais" adiciona, mostra toast, atualiza contador navbar
- [ ] Recarregar mantém itens
- [ ] /carrinho lista produtos
- [ ] "Comprar agora" tenta ir pra /checkout (vai dar 404, ok)

### Fase 5 (Categorias + limpezas)
- [ ] 3 categorias com mesma altura, overlays consistentes
- [ ] "Últimos Adicionados" e "Casais" não aparecem (poucos produtos)
- [ ] "N" preto sumiu

## Se algo der errado

Cole o erro de volta aqui no chat (comigo, Claude na web), me mostre:
- A fase em que aconteceu
- A mensagem de erro completa
- O que o Claude Code tentou fazer

Eu adapto o prompt e te devolvo a correção.

## Próximas fases (pra depois dessas 6)

Não estão nos prompts atuais mas estão planejadas:

- Fase 6: Formulário de cadastro de produto no admin (com galeria de thumbs YouTube)
- Fase 7: História de Vitórias + Sobre os Guppy (refatoração visual)
- Fase 8: Avaliações com mais autenticidade
- Fase 9: CTA "Criação especializada" e Footer
- Fase 10: SEO completo (metadata por página, sitemap, robots, OG image)
- Fase 11: Catálogo /loja ligado ao Prisma
- Fase 12: PDP /loja/[slug]
- Fase 13: Auth (NextAuth) + área do cliente
- Fase 14: Checkout (Mercado Pago + Melhor Envio)

Mas tudo isso vem depois de validar visualmente a home, que é o que essas 6 primeiras fases fazem.
