# Fantasy Landscape Generator

One fully-procedural Python script for Blender that generates evocative,
randomized fantasy landscapes. Every run produces a fresh world: realistic
eroded terrain is always there; castles, ruins, farm fields, standing
stones, sci-fi spires, distant sky-ships and far-off figures appear
*sometimes* — subtly, as part of the world. Lighting and mood vary from
golden hour to moonlight, always aiming for dramatic, atmospheric renders.

No add-ons, no downloads, no external assets. Everything — terrain, noise,
erosion, materials, sky, fog, clouds, architecture — is generated in code
and shader nodes.

## Requirements

- **Blender 4.2+ or 5.x** (developed and tested against Blender 5.0 via the
  `bpy 5.0.1` Python module — you do **not** need to downgrade)
- Cycles (used automatically; GPU is auto-detected, CPU works fine)

## Quick start

**Inside Blender:** open `fantasy_landscape.py` in the Text Editor and hit
*Run Script*. A complete scene appears — press F12 to render. Run it again
for a completely different world.

**Headless (recommended for batches):**

```bash
# one random landscape, rendered to PNG
blender -b -P fantasy_landscape.py -- --render out.png

# reproducible: every scene prints its recipe, e.g.
#   [fantasy] recipe: --seed 3 --mood blue_hour --archetype highlands
blender -b -P fantasy_landscape.py -- --seed 3 --mood blue_hour --render castle.png

# a quick low-res preview
blender -b -P fantasy_landscape.py -- --fast --res 960x540 --render preview.png

# save the .blend to explore/tweak by hand
blender -b -P fantasy_landscape.py -- --seed 3 --save scene.blend
```

It also runs directly under plain Python if you `pip install bpy`
(version must match: `pip install bpy==5.0.1` for Blender 5.0):

```bash
python fantasy_landscape.py --render out.png
```

## Options

| Flag | Meaning |
|---|---|
| `--seed N` | Reproducible world. Omit for a random one (seed is printed). |
| `--mood NAME` | `golden_hour`, `misty_dawn`, `stormy`, `blue_hour`, `moonlit`, `alien_dusk` |
| `--archetype NAME` | Terrain family: `alpine`, `highlands`, `coast`, `canyon` |
| `--with a,b,c` | Force elements on: `castle,ruins,fields,stones,spire,ships,figures` |
| `--without a,b,c` | Force elements off |
| `--render PATH` | Render a still after building |
| `--save PATH` | Save the generated `.blend` |
| `--samples N` | Cycles samples (default 128) |
| `--res WxH` | Resolution (default 1920x1080) |
| `--grid N` | Terrain grid resolution (default 512; 256 is much faster) |
| `--fast` | Preview mode: small grid, low samples |
| `--no-volumetrics` | Skip the fog volume — big render speedup; a shader-level distance haze still provides aerial perspective |
| `--list-moods` | Print moods and exit |

## How a world is built

1. **Terrain** — a 3 km heightfield from layered Perlin fBm + ridged
   multifractal noise with domain warping, then *thermal* and *hydraulic
   droplet erosion* (vectorized in NumPy) carve gullies, talus slopes and
   sediment fans. A 20 km coarse "far shell" of mountains rings the scene
   for horizon depth, and water fills the low country on some seeds.
2. **Materials** — slope/altitude-driven: grass on flats, rock on steeps,
   snow above a (relief-aware) snowline, a wet dark band at the waterline,
   plus two octaves of bump and a distance-based aerial-perspective fade.
3. **Atmosphere** — Nishita sky + sun matched to the mood, a heterogeneous
   ground-fog volume with noise wisps, soft emissive cloud cards, and a
   compositor glare pass (handles both the 4.x and 5.x compositor APIs).
4. **Elements** — each rolls its own probability (castle 45%, ruins 40%,
   fields 35%, stones 35%, spire ~12%, ships ~18%, figures 25%; sci-fi odds
   rise in `alien_dusk`). Sites are chosen by terrain analysis: castles on
   prominent crags, farms only on genuinely gentle ground, ruins on
   mid-slopes. At least one focal element always exists.
5. **Camera** — cinematic lenses (35/50/85 mm), rule-of-thirds framing,
   line-of-sight and pitch scoring so the horizon sits in a pleasing band,
   never staring into a hillside. The sun is then aimed relative to the
   camera (rim / side / into-the-light, per mood).
6. **Figures & ships** — placed *after* the camera so they actually land in
   frame: silhouetted travelers between camera and focal point, ships high
   in the view cone.

## Performance

| Setting | Build | Render (CPU) |
|---|---|---|
| `--fast --res 960x540` | ~1 s | ~15–40 s |
| defaults (512 grid, 1080p, 128 samples) | ~5 s | minutes on CPU, fast on GPU |

Volumetric fog is the main render cost — use `--no-volumetrics` while
exploring seeds, then re-render keepers with it on.

## Calibrating the look

Drop reference images into `art/refs/` (palette, fog density, composition
notes welcome). The knobs live at the top of the script in the `MOODS`
dict — every mood is a small bundle of sun elevation/energy/color, sky
strength, fog density/color, grass palette, cloud cover and glare, so
matching a reference is mostly editing numbers in one place.
