# Presence Comparison

Scores are provisional design-lab expectations on a five-point scale. Live review should update them before a production default is selected.

| Criterion             | Mark | Pulse | Trail | Constellation | Hybrid | Ribbon | Mercury | Elastic | Morph |
| --------------------- | ---: | ----: | ----: | ------------: | -----: | -----: | ------: | ------: | ----: |
| Warmth                |    3 |     5 |     4 |             4 |      5 |      4 |       4 |       4 |     4 |
| Recognizability       |    5 |     3 |     5 |             3 |      5 |      4 |       5 |       4 |     5 |
| Low distraction       |    5 |     4 |     4 |             3 |      4 |      4 |       3 |       3 |     3 |
| Speaking clarity      |    2 |     4 |     5 |             4 |      5 |      5 |       5 |       5 |     5 |
| Listening clarity     |    2 |     5 |     3 |             4 |      5 |      4 |       5 |       4 |     5 |
| Scalability           |    5 |     5 |     4 |             3 |      4 |      4 |       3 |       3 |     3 |
| Accessibility         |    5 |     4 |     4 |             3 |      4 |      4 |       4 |       4 |     4 |
| Performance           |    5 |     5 |     5 |             4 |      5 |      5 |       4 |       4 |     3 |
| Brand distinctiveness |    5 |     3 |     5 |             4 |      5 |      5 |       5 |       5 |     5 |
| Minimalist fit        |    5 |     5 |     4 |             3 |      5 |      5 |       4 |       3 |     4 |

## Strengths and weaknesses

- **Mark:** closest to the original identity and strongest at small size; least expressive for voice states.
- **Pulse:** warm and legible for listening; risks becoming a generic assistant orb.
- **Trail:** strongest orbital identity and speaking clarity; needs careful idle restraint.
- **Constellation:** communicates relationships; carries the highest distraction and small-size risks.
- **Hybrid:** combines the clearest listening and speaking signals; must avoid excess motion.
- **Ribbon:** most clearly avoids assistant-orb conventions and speaks expressively; needs live comprehension testing because it is less obviously connected to the Orbit mark.
- **Mercury:** closest to the liked liquid-ring concepts; tactile and premium, but must stay open enough to avoid reading as an eye or generic assistant orb.
- **Elastic:** strongest playful material quality; risks feeling less calm if magenta/lime treatment is overused.
- **Morph:** best candidate for a memorable voice-first identity; highest implementation complexity and needs careful motion restraint. It now uses source-derived raster stills plus distinct WebP frame loops for all eight states rather than SVG/procedural drawing, which materially improves metallic fidelity and makes the core voice interface feel alive. Desktop, tablet, phone, comparison mode, sequence mode, and reduced motion now work in the Lab. The remaining production question is delivery efficiency: the generated state loops are about 19 MB and the complete public Morph asset family is about 22 MB, so Morph should not become the default until inactive-state loading, decoding memory, and a smaller authored animation pipeline are proven without flattening the material.

## Provisional recommendation

Hybrid remains the conservative shell default for the experiment because it communicates both listening and speaking while retaining one satellite. Morph is now the strongest high-impact candidate if Orbit chooses a tactile, animated voice identity; the live pass is visually strong enough for user evaluation, but its asset budget is not yet the production default. This is not a permanent product selection. Mark remains the strongest fallback for small, static, or high-reduction contexts.

## Recommendation criteria

Choose a permanent default only after live comparison across all states, small and large sizes, light and dark previews, reduced motion, keyboard and screen-reader use, and ordinary consumer comprehension. Favor state clarity and calmness over spectacle.
