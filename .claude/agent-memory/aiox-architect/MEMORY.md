# Agent Memory — aiox-architect (Aria) · projeto Advoga

- [Advoga core](project_advoga_core.md) — o que é, restrição-mãe (prova 06/09/2026), decisões travadas, fronteira de segurança nº1 (gabarito não vaza antes do finalize)
- [Advoga build mode](project_advoga_build_mode.md) — LOCAL-FIRST: build local (Supabase Docker), cloud só no deploy, migrations idênticas via .env
- [Advoga diagnóstico EAV](project_advoga_diagnostico_eav.md) — dimensões ABERTAS, views SQL genéricas (não uma por dimensão), gate >=8 em duas camadas
- [Advoga Cockpit de Estudo (Drop 1.5 + v2 metas)](project_advoga_cockpit_estudo.md) — sensor+cronograma (v1, construído); v2 LOOP DE ADERÊNCIA (metas/timer/saldo) design em study-cockpit-v2-metas.md; meta-por-dia = swap escalar→lookup no cronograma.ts
- [Advoga Drop 2.5 — Subtema-granular + Loop](project_advoga_drop25_subtema.md) — cronograma por SUBTEMA (incidência real × desempenho) + loop de questões fechado; planners JÁ eixo-agnósticos, diag/runner JÁ suportam subtema; design em drop-2.5-subtema-granular.md
- [Advoga painel /incidencia + veredito sem-rotação](project_advoga_incidencia_display.md) — FGV NÃO rotaciona (permutação rejeitou); incidência estável; display DESCRITIVO nunca preditivo; spec em trend-display-spec.md
