# Grid Fácil

Monte um bloco de fotos para relatórios, trabalhos escolares e documentos em poucos cliques, e cole direto no Word ou no Google Docs.

**Acesse:** https://grid-fotos.vercel.app

## O que faz

- **Envio de fotos**: arraste, selecione do computador ou cole com `Ctrl+V`.
- **Foto inteira, sem corte**: cada imagem é encaixada (`contain`) dentro de uma célula padronizada.
- **Reordenar**: arraste as miniaturas (ou use o teclado) para mudar a ordem.
- **Configurações**: tamanho do grid, colunas (2, 3, 4 ou automático), espaçamento, fundo (branco, transparente, bege, cinza), borda (sem, fina, arredondada) e formato das células (vertical, quadrado, horizontal, automático).
- **Exportar**: copia o grid como imagem para colar em outro app, ou baixa em PNG ou JPG. A exportação usa resolução 2x.
- **Privacidade**: tudo roda no navegador. Nenhuma foto é enviada para servidor.

## Tecnologias

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · dnd-kit · react-dropzone

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

| Script          | O que faz                    |
| --------------- | ---------------------------- |
| `npm run dev`   | servidor de desenvolvimento  |
| `npm run build` | build de produção            |
| `npm run start` | serve o build de produção    |
| `npm run lint`  | ESLint                       |

## Como funciona a exportação

A prévia é HTML/CSS. Na hora de copiar ou baixar, o grid é redesenhado em um `<canvas>` com as mesmas medidas (largura do tamanho escolhido, espaçamento e proporção das células), em escala 2x, e convertido para PNG ou JPG. No JPG, o fundo transparente vira branco.

Se o navegador bloquear o acesso à área de transferência, o app baixa o PNG automaticamente como alternativa.

## Limitações conhecidas

- Formatos que o navegador não decodifica (como HEIC no Chrome/Windows) não aparecem. Converta para JPG ou PNG antes.
- As fotos ficam só na memória da aba: recarregar a página limpa o grid.

## Deploy

Publicado na Vercel. Cada push na `main` gera um novo deploy.
