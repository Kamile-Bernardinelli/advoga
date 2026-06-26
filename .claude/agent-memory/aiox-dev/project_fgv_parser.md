---
name: project-fgv-parser
description: FGV OAB PDF parser — OCR pipeline validado: pdftoppm 300dpi + tesseract -l por, 2 colunas, skip pg 1 e última. Gotchas de segmentação documentados.
metadata:
  type: project
---

# FGV PDF Parser — OCR Pipeline (Drop 1 / Story 1.1)

**ATUALIZADO 2026-06-21**: Parser reescrito para OCR. O approach font-based (PyMuPDF/fitz) foi abandonado.

## Por que OCR (não PyMuPDF)

PDFs FGV têm Calibri sem ToUnicode map. pdftotext e fitz retornam glyph IDs embaralhados (Latin-Extended + control chars). Encoding anterior documentado:
- Dígitos: U+03EC (Ϭ)=0, ϭ=1 ... ϵ=9
- Alternativas: \x04=A, \x11=B, \x12=C, \x18=D, Ϳ=)

Abordagem abandonada. **Gabarito** (PDF separado) ainda usa `pdftotext -layout` — funciona perfeitamente porque o gabarito tem font embedding correto.

## Pipeline OCR implementado

```
pdftoppm -r 300 -png -f N -l N  →  PNG por página
PIL crop (metade esquerda / metade direita)  →  2 halves
tesseract -l por --oem 1 --psm 6  →  texto português limpo
apaga PNGs após OCR (economiza espaço Seagate)
gabarito: pdftotext -layout  →  parse linha Tipo N
```

- Páginas de conteúdo: pg 2 .. totalPages-1
- pg 1 = instruções (pular)
- pg totalPages (pg 20 no 42º EOU) = pesquisa de satisfação + tabela de correspondência (pular)

## Gotchas de segmentação (42º EOU)

1. **Misread "75" como "15"**: tesseract confunde "7" com "1" nesta fonte/tamanho.
   Fix: heurística de sequência em `segmentQuestoes()` — se qNum[i] <= qNum[i-1] OU salto > 6, usa prev+1.

2. **Página 20 = pesquisa com números 1-5**: contaminava Q1/Q2 com conteúdo da pesquisa de satisfação.
   Fix: `lastContentPage = totalPages - 1`.

3. **Alternativas com variações OCR**: "A)", "A )", "A.", "(A)" etc.
   altRe robusto: `/^[(\s]*([ABCD])\s*[).|\-:]\s*/`

## Resultados verificados (42º EOU Tipo 1, 2026-06-21)

| Check | Resultado |
|-------|-----------|
| Total questões | 80/80 |
| Alternativas não-vazias | 80/80 |
| Q1 contém "Cláudio" e "Estatuto da Advocacia" | TRUE |
| Gabarito Q1-10 | D,B,D,A,D,B,C,A,D,A (match perfeito) |
| ANULADAs | 0 |

## Performance

- OCR 18 páginas (2 colunas cada): ~227s (~13s/página)
- Estimativa 10 edições: ~38min
- Seagate: 14% de 1.8TB ocupado após processamento

## Paths

- Parser: `/Users/admin/code/apps/_active/advoga/scripts/ingest/parse-fgv.mjs`
- Workspace OCR (imagens temporárias): `/Volumes/Seagate 1/advoga-ingest/ocr/`
- Output JSON Seagate: `/Volumes/Seagate 1/advoga-ingest/structured/oab42_tipo1.json`
- Output JSON local: `/Users/admin/code/apps/_active/advoga/data/structured/oab42_tipo1.json`
- OCR raw PNG temp: ~820KB/página @ 300dpi (apagados automaticamente)

## Adaptação para nova edição

No topo do `.mjs`:
- `META.exame_numero`, `META.ano`, `META.tipo`, `META.data_aplicacao`
- `PROVA_PDF`, `GABARITO_PDF`
- `SEAGATE_OUT`, `LOCAL_OUT`
- `lastContentPage = totalPages - 1` (válido se estrutura do PDF for igual)
- Se OCR de número ainda falhar: inspecionar raw com `tesseract page.png stdout -l por | grep -n '^[0-9]'`
