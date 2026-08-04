/* ============================================================
   Muse — Random Art Task Assigner
   Vanilla JS. All state persisted to localStorage. Offline PWA.
   ============================================================ */
'use strict';

/* ---------- Small utilities ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rf = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- AI backstory config ---------- */
const BACKSTORY_ENDPOINT = '/api/backstory'; // Firebase Hosting rewrite → Cloud Function
const BACKSTORY_CATEGORIES = new Set(['Character', 'Concept']); // tasks that make a character or place

/* ---------- Fire levels (energy) ---------- */
const EFFORTS = [
  { id: 1, name: 'Ember',   sub: '5–15 min',  minutes: 12, heat: 0.35 },
  { id: 2, name: 'Kindle',  sub: '15–30 min', minutes: 25, heat: 0.55 },
  { id: 3, name: 'Blaze',   sub: '30–60 min', minutes: 45, heat: 0.78 },
  { id: 4, name: 'Inferno', sub: '60+ min',   minutes: 75, heat: 1.0 },
];

/* ---------- Task database ----------
   m: mediums the task suits — 'T' traditional, 'D' digital (both = 'TD')
   e: effort levels it suits, as a string of digits 1–4
------------------------------------------------------------ */
const TASKS = [
  // Figure & gesture
  { t: '30-second gesture drawings from reference', c: 'Figure', m: 'TD', e: '1234' },
  { t: '2-minute figure poses focused on line of action', c: 'Figure', m: 'TD', e: '123' },
  { t: 'Long-pose figure study with rendered shadows', c: 'Figure', m: 'TD', e: '34' },
  { t: 'Gesture drawing emphasizing weight and balance', c: 'Figure', m: 'TD', e: '123' },
  { t: 'Figure in dynamic action — foreshortening focus', c: 'Figure', m: 'TD', e: '234' },
  { t: 'Contour figure drawing without lifting the pen', c: 'Figure', m: 'TD', e: '12' },
  { t: 'Croquis book — fill a page with quick poses', c: 'Figure', m: 'T', e: '123' },
  { t: 'Reductive figure — carve the form from a toned ground', c: 'Figure', m: 'TD', e: '34' },

  // Portrait & head
  { t: 'Portrait study from a photo — likeness focus', c: 'Portrait', m: 'TD', e: '234' },
  { t: 'Loomis-method head construction from imagination', c: 'Portrait', m: 'TD', e: '23' },
  { t: 'Expressive self-portrait using a mirror', c: 'Portrait', m: 'T', e: '34' },
  { t: 'Quick head sketches at 5 different angles', c: 'Portrait', m: 'TD', e: '12' },
  { t: 'Study of eyes and eyebrows in detail', c: 'Portrait', m: 'TD', e: '23' },
  { t: 'Study of the nose and mouth in three-quarter view', c: 'Portrait', m: 'TD', e: '23' },
  { t: 'Caricature — exaggerate one distinctive feature', c: 'Portrait', m: 'TD', e: '23' },
  { t: 'Skull-then-head overlay to understand structure', c: 'Portrait', m: 'TD', e: '34' },

  // Hands, feet, details
  { t: 'A page of hands in different gestures', c: 'Anatomy', m: 'TD', e: '123' },
  { t: 'Study your own feet from multiple angles', c: 'Anatomy', m: 'TD', e: '23' },
  { t: 'Ear studies from three viewpoints', c: 'Anatomy', m: 'TD', e: '12' },
  { t: 'Muscle-group study of the arm', c: 'Anatomy', m: 'TD', e: '34' },
  { t: 'Écorché study — draw the figure as if skinless', c: 'Anatomy', m: 'TD', e: '4' },

  // Still life
  { t: 'Single-object still life with dramatic side lighting', c: 'Still Life', m: 'TD', e: '234' },
  { t: 'Three-object still life focusing on overlap and depth', c: 'Still Life', m: 'TD', e: '34' },
  { t: 'Draw a glass of water — refraction and transparency', c: 'Still Life', m: 'TD', e: '34' },
  { t: 'Reflective metal object study (spoon, kettle)', c: 'Still Life', m: 'TD', e: '34' },
  { t: 'Crumpled paper study — value and folds', c: 'Still Life', m: 'TD', e: '23' },
  { t: 'A single piece of fruit, rendered fully', c: 'Still Life', m: 'TD', e: '23' },
  { t: 'Cloth drapery study over a chair', c: 'Still Life', m: 'TD', e: '34' },
  { t: 'Your current cup of coffee/tea, quick sketch', c: 'Still Life', m: 'TD', e: '12' },

  // Landscape & environment
  { t: 'Landscape acrylic painting from reference', c: 'Landscape', m: 'T', e: '34' },
  { t: 'Plein-air style landscape from a window view', c: 'Landscape', m: 'TD', e: '234' },
  { t: 'Digital landscape matte painting — mood focus', c: 'Landscape', m: 'D', e: '34' },
  { t: 'Cloud study — five different sky moods', c: 'Landscape', m: 'TD', e: '23' },
  { t: 'Mountain silhouette study in three values', c: 'Landscape', m: 'TD', e: '12' },
  { t: 'Water reflection study — lake or river', c: 'Landscape', m: 'TD', e: '34' },
  { t: 'Tree study — capture the gesture of the branches', c: 'Landscape', m: 'TD', e: '23' },
  { t: 'Atmospheric perspective study with fading hills', c: 'Landscape', m: 'TD', e: '23' },

  // Botanical / nature
  { t: 'Floral watercolor — a single bloom, wet-on-wet', c: 'Botanical', m: 'T', e: '234' },
  { t: 'Botanical line study of a leaf with veins', c: 'Botanical', m: 'TD', e: '12' },
  { t: 'Detailed flower study with graphite shading', c: 'Botanical', m: 'TD', e: '234' },
  { t: 'A branch with berries in gouache', c: 'Botanical', m: 'T', e: '34' },
  { t: 'Mushroom study — three species', c: 'Botanical', m: 'TD', e: '23' },
  { t: 'Succulent from above — pattern and symmetry', c: 'Botanical', m: 'TD', e: '23' },
  { t: 'Pressed-flower style flat illustration', c: 'Botanical', m: 'TD', e: '23' },

  // Animals
  { t: 'Quick gesture sketches of a cat or dog', c: 'Animals', m: 'TD', e: '12' },
  { t: 'Bird study — capture the beak and eye', c: 'Animals', m: 'TD', e: '23' },
  { t: 'Animal in motion — running or leaping', c: 'Animals', m: 'TD', e: '234' },
  { t: 'Fish or sea creature with pattern focus', c: 'Animals', m: 'TD', e: '23' },
  { t: 'Fur and texture study on a small animal', c: 'Animals', m: 'TD', e: '34' },
  { t: 'Insect close-up study — wings and legs', c: 'Animals', m: 'TD', e: '23' },
  { t: 'Horse gesture — power through the shoulders', c: 'Animals', m: 'TD', e: '34' },

  // Perspective & architecture
  { t: 'One-point perspective interior room', c: 'Perspective', m: 'TD', e: '234' },
  { t: 'Two-point perspective building corner', c: 'Perspective', m: 'TD', e: '234' },
  { t: 'Draw a street scene with converging lines', c: 'Perspective', m: 'TD', e: '34' },
  { t: 'Ellipses and cylinders warm-up page', c: 'Perspective', m: 'TD', e: '12' },
  { t: 'Three-point perspective looking up at a tower', c: 'Perspective', m: 'TD', e: '34' },
  { t: 'A doorway or window with cast shadows', c: 'Perspective', m: 'TD', e: '23' },
  { t: 'Stairs in perspective', c: 'Perspective', m: 'TD', e: '34' },

  // Composition & thumbnails
  { t: 'Six thumbnail compositions of the same idea', c: 'Composition', m: 'TD', e: '12' },
  { t: 'Notan study — reduce a scene to 2 values', c: 'Composition', m: 'TD', e: '12' },
  { t: 'Rule-of-thirds composition from a photo', c: 'Composition', m: 'TD', e: '23' },
  { t: 'Design a composition using the golden spiral', c: 'Composition', m: 'TD', e: '23' },
  { t: 'Frame the same subject three different ways', c: 'Composition', m: 'TD', e: '12' },

  // Value & light
  { t: 'Grayscale value study of a photo', c: 'Value & Light', m: 'TD', e: '23' },
  { t: 'Sphere, cube, cylinder — full value rendering', c: 'Value & Light', m: 'TD', e: '23' },
  { t: 'Chiaroscuro study — single light source in darkness', c: 'Value & Light', m: 'TD', e: '34' },
  { t: 'Five-value scale, then apply it to an object', c: 'Value & Light', m: 'TD', e: '23' },
  { t: 'Backlit subject — capture the rim light', c: 'Value & Light', m: 'TD', e: '34' },
  { t: 'Cross-hatching value study of a simple object', c: 'Value & Light', m: 'T', e: '23' },

  // Color studies
  { t: 'Master color study — copy a painter\'s palette', c: 'Color', m: 'TD', e: '34' },
  { t: 'Paint the same object in warm vs cool light', c: 'Color', m: 'TD', e: '34' },
  { t: 'Limited-palette study using only 3 colors + white', c: 'Color', m: 'TD', e: '234' },
  { t: 'Complementary color still life', c: 'Color', m: 'TD', e: '34' },
  { t: 'Sunset gradient study — capture the color shifts', c: 'Color', m: 'TD', e: '23' },
  { t: 'Monochrome painting in a single hue', c: 'Color', m: 'TD', e: '23' },
  { t: 'Color-temperature swatch chart from your paints', c: 'Color', m: 'T', e: '12' },

  // Character & concept
  { t: 'Design a character from a one-word prompt', c: 'Character', m: 'TD', e: '34' },
  { t: 'Silhouette-first character exploration (5 shapes)', c: 'Character', m: 'TD', e: '23' },
  { t: 'Expression sheet — one face, six emotions', c: 'Character', m: 'TD', e: '23' },
  { t: 'Costume design variations for one character', c: 'Character', m: 'TD', e: '34' },
  { t: 'Turnaround — front, side, back of a simple character', c: 'Character', m: 'TD', e: '4' },
  { t: 'Redesign a fairy-tale character in a new genre', c: 'Character', m: 'TD', e: '34' },

  // Environment / concept
  { t: 'Environment thumbnail — establish a mood', c: 'Concept', m: 'TD', e: '23' },
  { t: 'Speed-paint an environment in under 30 minutes', c: 'Concept', m: 'D', e: '23' },
  { t: 'Design a prop with a story behind it', c: 'Concept', m: 'TD', e: '234' },
  { t: 'Interior of an imagined home', c: 'Concept', m: 'TD', e: '34' },
  { t: 'Photobash-free concept sketch of a vehicle', c: 'Concept', m: 'TD', e: '34' },
  { t: 'Design a small creature and its habitat', c: 'Concept', m: 'TD', e: '34' },

  // Abstract & expressive
  { t: 'Abstract composition from your current emotion', c: 'Abstract', m: 'TD', e: '123' },
  { t: 'Mark-making page — 10 different textures', c: 'Abstract', m: 'T', e: '12' },
  { t: 'Blind contour drawing of anything nearby', c: 'Abstract', m: 'T', e: '1' },
  { t: 'Continuous-line drawing of a whole scene', c: 'Abstract', m: 'TD', e: '12' },
  { t: 'Music-driven abstract — paint what you hear', c: 'Abstract', m: 'TD', e: '234' },
  { t: 'Ink blot, then find and render an image in it', c: 'Abstract', m: 'T', e: '12' },
  { t: 'Non-dominant-hand expressive drawing', c: 'Abstract', m: 'TD', e: '12' },

  // Pattern & design
  { t: 'Design a seamless repeating pattern', c: 'Pattern', m: 'TD', e: '34' },
  { t: 'Mandala from the center out', c: 'Pattern', m: 'TD', e: '234' },
  { t: 'Fill a page with a single doodle motif', c: 'Pattern', m: 'T', e: '12' },
  { t: 'Geometric tessellation study', c: 'Pattern', m: 'TD', e: '23' },
  { t: 'Zentangle-style meditative pattern', c: 'Pattern', m: 'T', e: '12' },

  // Lettering
  { t: 'Hand-letter a single word in a new style', c: 'Lettering', m: 'TD', e: '23' },
  { t: 'Draw the alphabet in a consistent type style', c: 'Lettering', m: 'TD', e: '34' },
  { t: 'Ornamental drop-cap illuminated letter', c: 'Lettering', m: 'TD', e: '34' },

  // Master studies
  { t: 'Master study — copy a small section of a classic painting', c: 'Master Study', m: 'TD', e: '34' },
  { t: 'Line study of an old-master drawing', c: 'Master Study', m: 'TD', e: '23' },
  { t: 'Study how a favorite artist handles edges', c: 'Master Study', m: 'TD', e: '234' },
  { t: 'Recreate a film-still frame for lighting practice', c: 'Master Study', m: 'D', e: '34' },

  // Imagination / ideation
  { t: 'Draw from imagination — no reference allowed', c: 'Imagination', m: 'TD', e: '234' },
  { t: 'Combine two unrelated objects into one design', c: 'Imagination', m: 'TD', e: '23' },
  { t: 'Illustrate a single line from a song', c: 'Imagination', m: 'TD', e: '34' },
  { t: 'Draw a memory from childhood', c: 'Imagination', m: 'TD', e: '234' },
  { t: 'Visualize an abstract noun as a creature', c: 'Imagination', m: 'TD', e: '34' },
  { t: 'One-panel comic that tells a whole story', c: 'Imagination', m: 'TD', e: '234' },

  // Texture
  { t: 'Render four surfaces: metal, glass, wood, fabric', c: 'Texture', m: 'TD', e: '34' },
  { t: 'Study of tree bark up close', c: 'Texture', m: 'TD', e: '23' },
  { t: 'Rock and stone texture study', c: 'Texture', m: 'TD', e: '23' },
  { t: 'Study of a shiny vs matte version of one object', c: 'Texture', m: 'TD', e: '34' },

  // Sequential / comics
  { t: 'Storyboard a 3-shot sequence', c: 'Sequential', m: 'TD', e: '34' },
  { t: 'Two characters in conversation — staging', c: 'Sequential', m: 'TD', e: '34' },
  { t: 'Panel of a character entering a room', c: 'Sequential', m: 'TD', e: '23' },

  // Quick sparks
  { t: 'Draw the first object you see, in one minute', c: 'Warm-Up', m: 'TD', e: '1' },
  { t: 'Fill a small box with 5 tiny thumbnails', c: 'Warm-Up', m: 'TD', e: '1' },
  { t: 'Warm-up circles, lines and ellipses drill', c: 'Warm-Up', m: 'TD', e: '1' },
  { t: 'Draw a simple object from memory, then check it', c: 'Warm-Up', m: 'TD', e: '12' },

  // More figure & portrait
  { t: 'Foreshortened hand reaching toward the viewer', c: 'Anatomy', m: 'TD', e: '34' },
  { t: 'Back and shoulder-blade study of the figure', c: 'Figure', m: 'TD', e: '34' },
  { t: 'Full-figure study in a seated pose', c: 'Figure', m: 'TD', e: '34' },
  { t: 'Two figures interacting — staging and contact', c: 'Figure', m: 'TD', e: '4' },
  { t: 'Aging study — the same face young and old', c: 'Portrait', m: 'TD', e: '34' },
  { t: 'Portrait in dramatic single-source light', c: 'Portrait', m: 'TD', e: '34' },
  { t: 'Study of hair as flowing masses, not strands', c: 'Portrait', m: 'TD', e: '23' },

  // More still life & texture
  { t: 'Backlit bottle — glass and glow', c: 'Still Life', m: 'TD', e: '34' },
  { t: 'A pile of keys — overlapping metal shapes', c: 'Still Life', m: 'TD', e: '23' },
  { t: 'Open book with turning pages', c: 'Still Life', m: 'TD', e: '23' },
  { t: 'A candle flame and its cast light', c: 'Still Life', m: 'TD', e: '23' },
  { t: 'Rendered study of a soap bubble', c: 'Texture', m: 'TD', e: '34' },
  { t: 'Rope, chain and knot texture study', c: 'Texture', m: 'TD', e: '23' },
  { t: 'Study of ice or a melting ice cube', c: 'Texture', m: 'TD', e: '34' },

  // More landscape & environment
  { t: 'Foggy morning scene — lost edges', c: 'Landscape', m: 'TD', e: '34' },
  { t: 'City skyline at dusk, silhouette-first', c: 'Landscape', m: 'TD', e: '23' },
  { t: 'Rocky coastline with crashing waves', c: 'Landscape', m: 'TD', e: '34' },
  { t: 'Desert dunes — soft light and long shadows', c: 'Landscape', m: 'TD', e: '34' },
  { t: 'Rainy street with reflections and neon', c: 'Concept', m: 'D', e: '34' },
  { t: 'A cozy interior lit only by a fireplace', c: 'Concept', m: 'TD', e: '34' },
  { t: 'Underwater scene — light shafts and haze', c: 'Concept', m: 'TD', e: '34' },
  { t: 'Alien planet vista from imagination', c: 'Concept', m: 'TD', e: '34' },

  // More color & value
  { t: 'Paint a scene using only a triad of primaries', c: 'Color', m: 'TD', e: '34' },
  { t: 'Same subject in golden hour vs blue hour', c: 'Color', m: 'TD', e: '34' },
  { t: 'Gouache color-block study of a photo', c: 'Color', m: 'T', e: '23' },
  { t: 'Bounce-light study — colored light in shadows', c: 'Value & Light', m: 'TD', e: '34' },
  { t: 'Silhouette-and-rim-light study at night', c: 'Value & Light', m: 'TD', e: '23' },

  // More character & concept
  { t: 'Design a villain from a single color', c: 'Character', m: 'TD', e: '34' },
  { t: 'Anthropomorphize an everyday object', c: 'Character', m: 'TD', e: '23' },
  { t: 'Creature mashup of two animals', c: 'Character', m: 'TD', e: '34' },
  { t: 'Design a weapon or tool with a backstory', c: 'Concept', m: 'TD', e: '34' },
  { t: 'Emblem or crest for an invented faction', c: 'Concept', m: 'TD', e: '23' },
  { t: 'Design a hat that tells you who wears it', c: 'Character', m: 'TD', e: '23' },

  // More quick & expressive
  { t: 'Draw five facial expressions from memory', c: 'Warm-Up', m: 'TD', e: '12' },
  { t: 'Scribble, then find a figure inside it', c: 'Abstract', m: 'TD', e: '1' },
  { t: 'One-minute silhouettes of objects around you', c: 'Warm-Up', m: 'TD', e: '1' },
  { t: 'Draw the same cup five times, faster each time', c: 'Warm-Up', m: 'TD', e: '12' },
  { t: 'Value-only thumbnail of the room you\'re in', c: 'Composition', m: 'TD', e: '12' },
  { t: 'Fill a page edge-to-edge with overlapping leaves', c: 'Pattern', m: 'TD', e: '23' },

  // 3D render / blockout studies (pillar)
  { t: 'Greyscale environment blockout — big shapes only, 3 values', c: 'Render', m: 'TD', e: '23' },
  { t: 'Primitive blockout of a character from basic 3D forms', c: 'Render', m: 'TD', e: '23' },
  { t: 'Orthographic blockout (front + side) to model from', c: 'Render', m: 'TD', e: '34' },
  { t: 'Lighting study — one form, three setups (key, fill, rim)', c: 'Render', m: 'TD', e: '23' },
  { t: 'Material render study — the same sphere as clay, metal, glass', c: 'Render', m: 'TD', e: '34' },
  { t: 'Block out a room in one-point perspective, then value it', c: 'Render', m: 'TD', e: '34' },
  { t: 'Hard-surface prop blockout from primitives', c: 'Render', m: 'D', e: '34' },
  { t: 'Grey-box a level layout from a top-down view', c: 'Render', m: 'TD', e: '23' },
  { t: 'Ambient-occlusion pass — shade only the contact shadows', c: 'Render', m: 'TD', e: '2' },
  { t: 'Turnaround blockout of a vehicle in simple volumes', c: 'Render', m: 'TD', e: '4' },
  { t: 'Clay-render portrait — planes of the head, no detail', c: 'Render', m: 'TD', e: '23' },
  { t: 'Camera study — block one scene from three focal lengths', c: 'Render', m: 'TD', e: '3' },

  // Fusion — combine character / environment / render (pillar)
  { t: 'Character + environment: a figure placed in a landscape, block out both', c: 'Fusion', m: 'TD', e: '34' },
  { t: 'Portrait lit by its environment — a face catching a scene’s light', c: 'Fusion', m: 'TD', e: '34' },
  { t: 'Block out a scene, then render one character into its focal point', c: 'Fusion', m: 'TD', e: '4' },
  { t: 'Design a character and the room they live in — both tell one story', c: 'Fusion', m: 'TD', e: '34' },
  { t: 'Greyscale 3D-style blockout of a figure in a landscape', c: 'Fusion', m: 'TD', e: '34' },
  { t: 'Environment concept with a figure for scale and mood', c: 'Fusion', m: 'TD', e: '34' },
  { t: 'Character silhouette read against a blocked-out environment', c: 'Fusion', m: 'TD', e: '23' },
  { t: 'Costume material render — one figure’s cloth, metal and skin', c: 'Fusion', m: 'TD', e: '34' },
  { t: 'Block out a landscape, then place a creature that belongs there', c: 'Fusion', m: 'TD', e: '34' },
  { t: 'Portrait of a place — make a landscape feel like a character', c: 'Fusion', m: 'TD', e: '34' },
  { t: 'Three-in-one: block out a scene, add a figure, render the light', c: 'Fusion', m: 'TD', e: '4' },
  { t: 'Thumbnail three shots of a character moving through an environment', c: 'Fusion', m: 'TD', e: '23' },

  // ── Curated prompts (yours) ──
  { t: 'D.va bust portrait', c: 'Portrait', m: 'TD', e: '234' },
  { t: 'Momo bust portrait', c: 'Portrait', m: 'TD', e: '234' },
  { t: 'Frieren landscape', c: 'Landscape', m: 'TD', e: '34' },
  { t: 'Pokemon portrait', c: 'Portrait', m: 'TD', e: '23' },
  { t: 'Mythical creature portrait', c: 'Character', m: 'TD', e: '34' },
  { t: 'Anime influencer bust selfie', c: 'Portrait', m: 'TD', e: '23' },
  { t: 'Blender to paint landscape — architectural', c: 'Fusion', m: 'D', e: '4' },
  { t: 'Cyberpunk girl in space loft — Midjourney sketchover', c: 'Fusion', m: 'D', e: '34' },
  { t: 'Random Henri Prestes landscape — Midjourney paintover', c: 'Landscape', m: 'D', e: '34' },
  { t: 'Chibi character fanart', c: 'Character', m: 'TD', e: '23' },
  { t: 'Ghost of Yhotei landscape — painterly and loose, value and color', c: 'Landscape', m: 'TD', e: '34' },
  { t: 'Watercolor ink and wash — flower with bokeh (DOF) background', c: 'Botanical', m: 'T', e: '34' },
  { t: 'solringen (twitter) paintover — digital', c: 'Character', m: 'D', e: '34' },
  { t: 'Grady Frederick ArtStation tutorial — environment painting', c: 'Concept', m: 'D', e: '34' },
  { t: 'Marc Brunet “Why your paintings look FLAT!” follow-along — digital', c: 'Value & Light', m: 'D', e: '34' },
  { t: 'Portrait sketch from the r/drawme subreddit', c: 'Portrait', m: 'TD', e: '23' },

  // ── More in the same veins ──
  // named-character busts / portraits
  { t: '2B (NieR) bust portrait', c: 'Portrait', m: 'TD', e: '234' },
  { t: 'Makima bust portrait', c: 'Portrait', m: 'TD', e: '234' },
  { t: 'Jinx (Arcane) portrait', c: 'Portrait', m: 'TD', e: '234' },
  { t: 'Genshin Impact character portrait', c: 'Portrait', m: 'TD', e: '234' },
  { t: 'Studio Ghibli character portrait', c: 'Portrait', m: 'TD', e: '23' },
  { t: 'Original character (OC) bust portrait', c: 'Character', m: 'TD', e: '34' },
  { t: 'Favorite villain — bust portrait', c: 'Portrait', m: 'TD', e: '34' },
  { t: 'Chibi version of a game boss', c: 'Character', m: 'TD', e: '23' },
  // franchise / game landscapes
  { t: 'Elden Ring vista — painterly landscape', c: 'Landscape', m: 'TD', e: '34' },
  { t: 'Zelda: Breath of the Wild landscape', c: 'Landscape', m: 'TD', e: '34' },
  { t: 'Studio Ghibli countryside landscape', c: 'Landscape', m: 'TD', e: '34' },
  { t: 'Cyberpunk 2077 rainy street', c: 'Concept', m: 'D', e: '34' },
  { t: 'Sci-fi space-station interior', c: 'Concept', m: 'D', e: '34' },
  // AI sketchover / paintover workflows
  { t: 'Midjourney paintover — mecha in a rainy alley', c: 'Fusion', m: 'D', e: '34' },
  { t: 'Nijijourney anime character — paintover', c: 'Character', m: 'D', e: '34' },
  { t: 'AI sketchover — creature concept, then redraw it clean', c: 'Character', m: 'D', e: '34' },
  { t: 'Midjourney environment paintover — alien jungle', c: 'Landscape', m: 'D', e: '34' },
  // artist studies / paintovers
  { t: 'Ilya Kuvshinov–style portrait study', c: 'Portrait', m: 'D', e: '34' },
  { t: 'RossDraws-style character', c: 'Character', m: 'D', e: '34' },
  { t: 'WLOP-style rendered portrait', c: 'Portrait', m: 'D', e: '4' },
  { t: 'Craig Mullins atmospheric environment study', c: 'Concept', m: 'D', e: '34' },
  { t: 'Sparth-style minimal environment', c: 'Concept', m: 'D', e: '34' },
  // tutorial follow-alongs
  { t: 'Proko figure / anatomy follow-along', c: 'Anatomy', m: 'TD', e: '34' },
  { t: 'Marco Bucci light & color follow-along', c: 'Value & Light', m: 'D', e: '34' },
  { t: 'Sinix painting tutorial follow-along', c: 'Portrait', m: 'D', e: '34' },
  { t: 'Ctrl+Paint fundamentals lesson', c: 'Value & Light', m: 'D', e: '23' },
  { t: 'Drawabox lesson (r/ArtFundamentals)', c: 'Perspective', m: 'TD', e: '23' },
  { t: 'FZD-style design tutorial follow-along', c: 'Concept', m: 'D', e: '4' },
  // community / subreddit prompts
  { t: 'r/redditgetsdrawn portrait', c: 'Portrait', m: 'TD', e: '23' },
  { t: 'r/SketchDaily prompt of the day', c: 'Imagination', m: 'TD', e: '23' },
  // media / technique specifics
  { t: 'Ink and wash cityscape with a bokeh background', c: 'Concept', m: 'T', e: '34' },
  { t: 'Gouache landscape master study', c: 'Landscape', m: 'T', e: '34' },
  // 3D → paint workflows
  { t: 'Blender blockout → paintover of an interior', c: 'Fusion', m: 'D', e: '4' },
  { t: 'Kitbash a 3D scene, then paint over it', c: 'Fusion', m: 'D', e: '4' },
  { t: 'Greybox an environment in Blender, then value it', c: 'Render', m: 'TD', e: '34' },
];

/* ---------- Inspiration word bank ---------- */
const WORDS = [
  'Solitude', 'Momentum', 'Fragile', 'Radiant', 'Decay', 'Bloom', 'Tension', 'Serene',
  'Fracture', 'Warmth', 'Hollow', 'Weightless', 'Ancient', 'Electric', 'Tender', 'Wild',
  'Silence', 'Threshold', 'Drift', 'Ember', 'Frost', 'Longing', 'Velocity', 'Mirror',
  'Shadow', 'Nostalgia', 'Bitter', 'Luminous', 'Ripple', 'Storm', 'Whisper', 'Fury',
  'Gentle', 'Rust', 'Bloomed', 'Vast', 'Intimate', 'Chaos', 'Balance', 'Metamorphosis',
  'Ephemeral', 'Gravity', 'Delicate', 'Bold', 'Overgrown', 'Machine', 'Organic', 'Sacred',
  'Feral', 'Melancholy', 'Euphoria', 'Grit', 'Silk', 'Thunder', 'Dawn', 'Dusk', 'Neon',
  'Antique', 'Molten', 'Crystalline', 'Feather', 'Anchor', 'Wander', 'Bristle', 'Glow',
  'Murmur', 'Cascade', 'Shatter', 'Quiet', 'Restless', 'Woven', 'Tangled', 'Suspended',
  'Weathered', 'Bloom', 'Vapor', 'Undertow', 'Flicker', 'Bramble', 'Cinder', 'Halo',
  'Hush', 'Ravel', 'Spire', 'Tide', 'Verdant', 'Wane', 'Yearn', 'Zephyr', 'Bruise',
  'Cobalt', 'Dapple', 'Echo', 'Frenzy', 'Glimmer', 'Haze', 'Ivory', 'Jolt', 'Kindle',
  'Lull', 'Marrow', 'Nectar', 'Opal', 'Petal', 'Quiver', 'Reverie', 'Splinter', 'Thorn',
  'Umbra', 'Vessel', 'Wisp', 'Ashen', 'Brine', 'Crescent', 'Drowsy', 'Feverish', 'Gilded',
  'Hazy', 'Indigo', 'Jagged', 'Lucid', 'Mossy', 'Nimble', 'Pale', 'Rugged', 'Supple',
  'Tremor', 'Unfurl', 'Vivid', 'Wilt', 'Amber', 'Bloom', 'Cavern', 'Distant', 'Embers',
];

/* ---------- Challenge modifiers ---------- */
const CONSTRAINTS = [
  'Use your non-dominant hand',
  'No eraser or undo allowed',
  'One continuous line — never lift the tool',
  'Limit yourself to only 3 values',
  'Work with a hard time limit half of what you\'d normally take',
  'Use only the largest brush/tool you have',
  'No black — mix your darks from color',
  'Draw the negative space, not the object',
  'Start from the darkest shape first',
  'No pencil sketch — commit straight to ink/color',
  'Work upside-down for the first half',
  'Use only straight lines — no curves',
  'Zoom out / hold your paper at arm\'s length the whole time',
  'Only 5 total shapes allowed',
  'Every mark must be a single confident stroke',
  'Work at twice your normal scale',
  'Work at a tiny thumbnail scale',
  'Squint and only paint what you can still see',
  'No outlines — define everything with value alone',
  'Leave 30% of the page intentionally empty',
];

/* ---------- Recommended tools ---------- */
// Physical media (shown when the medium resolves to Traditional).
const TRADITIONAL_TOOLS = [
  'Charcoal', 'Soft pastels', 'Watercolor', 'Watercolor pencils', 'Acrylics',
  'Graphite pencil', 'Colored pencil', 'Alcohol markers', 'Fineliners',
  'Gouache', 'Oil paint', 'Ink & dip pen', 'Brush pen', 'Ballpoint pen',
  'Oil pastels', 'Conté on toned paper',
];
// Digital brushes/tools (shown when the medium resolves to Digital) — echoes the
// physical media where it makes sense, plus a few native-digital options.
const DIGITAL_TOOLS = [
  'Hard round brush', 'Textured charcoal brush', 'Soft airbrush',
  'Digital watercolor brush', 'Digital gouache brush', 'Blocky flat brush',
  'Colored-pencil brush', 'Inking / lineart pen', 'Alcohol-marker brush',
  'Smudge / blender', 'Lasso fill + hard brush', 'One big soft speedpaint brush',
  'Pixel brush (1px)', 'Grease pencil / lineart',
];
// Per-tool weighting the user sets in Settings → My tools. Each tool cycles
// Off / Rare / Normal / Often; unset defaults to Normal, so out of the box every
// tool is uniform-random within its medium. The suggester never biases by task.
const TOOL_STATES = ['off', 'rare', 'normal', 'often'];
const TOOL_WEIGHT = { off: 0, rare: 1, normal: 3, often: 8 };
function toolState(name) {
  const tw = state.prefs.toolWeights;
  return (tw && tw[name]) || 'normal';
}
function genToolField(mediumLabel) {
  const pool = mediumLabel === 'Digital' ? DIGITAL_TOOLS : TRADITIONAL_TOOLS;
  const entries = pool.map((t) => [t, TOOL_WEIGHT[toolState(t)] || 0]).filter(([, w]) => w > 0);
  if (!entries.length) return pick(pool); // whole medium turned off → fall back so a tool still shows
  let total = 0; for (const [, w] of entries) total += w;
  let r = Math.random() * total;
  for (const [t, w] of entries) { if (r < w) return t; r -= w; }
  return entries[entries.length - 1][0];
}

/* ---------- Palette generation ---------- */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

const HUE_NAMES = [
  [16, 'Red'], [45, 'Amber'], [66, 'Gold'], [90, 'Chartreuse'], [150, 'Green'],
  [186, 'Teal'], [210, 'Cyan'], [248, 'Blue'], [280, 'Indigo'], [318, 'Violet'],
  [345, 'Magenta'], [361, 'Red'],
];
function hueName(h) {
  h = ((h % 360) + 360) % 360;
  for (const [max, n] of HUE_NAMES) if (h < max) return n;
  return 'Red';
}
function colorName(h, s, l) {
  if (s < 9) {
    if (l < 14) return 'Near Black';
    if (l < 34) return 'Charcoal';
    if (l < 54) return 'Slate Grey';
    if (l < 74) return 'Ash Grey';
    if (l < 90) return 'Pale Grey';
    return 'White';
  }
  let mod = l < 26 ? 'Deep ' : l < 40 ? 'Dark ' : l > 82 ? 'Pale ' : l > 68 ? 'Light ' : '';
  if (!mod && s < 32) mod = 'Muted ';
  return mod + hueName(h);
}

const PAL_ADJ = ['Dusk', 'Ember', 'Sea', 'Moss', 'Ash', 'Rust', 'Storm', 'Bloom', 'Frost', 'Amber',
  'Velvet', 'Midnight', 'Coral', 'Sage', 'Slate', 'Golden', 'Twilight', 'Copper', 'Ivory', 'Wild'];
const PAL_NOUN = ['Glass', 'Harbor', 'Meadow', 'Ember', 'Veil', 'Grove', 'Tide', 'Bloom', 'Haze', 'Field',
  'Drift', 'Hollow', 'Shore', 'Spark', 'Mist', 'Bramble', 'Dawn', 'Dune', 'Fern', 'Mire'];
const paletteName = () => `${pick(PAL_ADJ)} ${pick(PAL_NOUN)}`;

// Each generator returns an array of {h,s,l}
function genComplex() {
  const base = rf(0, 360), n = ri(4, 5), out = [];
  out.push({ h: base, s: ri(55, 80), l: ri(40, 55) });
  out.push({ h: base + rf(20, 40), s: ri(45, 75), l: ri(55, 70) });
  out.push({ h: base - rf(20, 40), s: ri(45, 70), l: ri(30, 45) });
  out.push({ h: base + 180 + rf(-15, 15), s: ri(45, 70), l: ri(45, 62) }); // accent
  if (n === 5) out.push({ h: base + rf(-30, 30), s: ri(10, 25), l: ri(82, 92) }); // light neutral
  return out;
}
function genAnalogous() {
  const base = rf(0, 360), n = ri(4, 5), out = [];
  for (let i = 0; i < n; i++) {
    out.push({ h: base + (i - (n - 1) / 2) * rf(14, 24), s: ri(40, 72), l: 30 + i * (55 / n) });
  }
  return out;
}
function genMonochrome() {
  const base = rf(0, 360), n = ri(4, 5), out = [];
  const s = ri(38, 66);
  for (let i = 0; i < n; i++) out.push({ h: base, s: s + rf(-8, 8), l: 22 + i * (66 / (n - 1)) });
  return out;
}
function genGreyscale() {
  const base = rf(0, 360), n = 5, out = [];
  for (let i = 0; i < n; i++) out.push({ h: base, s: rf(0, 5), l: 12 + i * (78 / (n - 1)) });
  return out;
}
function genComplementary() {
  const base = rf(0, 360), out = [];
  out.push({ h: base, s: ri(55, 78), l: ri(32, 44) });
  out.push({ h: base, s: ri(40, 60), l: ri(60, 72) });
  out.push({ h: base + 180, s: ri(55, 78), l: ri(45, 58) });
  out.push({ h: base + 180, s: ri(20, 40), l: ri(74, 86) });
  return out;
}
function genSplit() {
  const base = rf(0, 360), out = [];
  out.push({ h: base, s: ri(55, 78), l: ri(40, 52) });
  out.push({ h: base + 150, s: ri(50, 72), l: ri(46, 60) });
  out.push({ h: base + 210, s: ri(50, 72), l: ri(46, 60) });
  out.push({ h: base, s: ri(10, 22), l: ri(84, 92) });
  return out;
}
function genTriadic() {
  const base = rf(0, 360), out = [];
  for (let i = 0; i < 3; i++) out.push({ h: base + i * 120, s: ri(50, 72), l: ri(44, 58) });
  out.push({ h: base, s: ri(8, 18), l: ri(16, 26) }); // dark neutral
  return out;
}
function genWarm() {
  const n = ri(4, 5), out = [];
  for (let i = 0; i < n; i++) out.push({ h: rf(0, 55), s: ri(45, 80), l: 30 + i * (55 / n) });
  return out;
}
function genCool() {
  const n = ri(4, 5), out = [];
  for (let i = 0; i < n; i++) out.push({ h: rf(180, 260), s: ri(40, 72), l: 32 + i * (52 / n) });
  return out;
}
function genEarthen() {
  const n = ri(4, 5), out = [];
  const hues = [28, 40, 20, 90, 15];
  for (let i = 0; i < n; i++) out.push({ h: hues[i] + rf(-6, 6), s: ri(20, 45), l: 26 + i * (52 / n) });
  return out;
}

const PALETTE_TYPES = [
  { label: 'Complex (5)',              gen: genComplex,        w: 3 },
  { label: 'Analogous — single family', gen: genAnalogous,      w: 3 },
  { label: 'Monochrome',               gen: genMonochrome,     w: 2 },
  { label: 'Greyscale / Grisaille',    gen: genGreyscale,      w: 2 },
  { label: 'Complementary',            gen: genComplementary,  w: 2 },
  { label: 'Split-Complementary',      gen: genSplit,          w: 1 },
  { label: 'Triadic',                  gen: genTriadic,        w: 1 },
  { label: 'Warm limited',             gen: genWarm,           w: 1 },
  { label: 'Cool limited',             gen: genCool,           w: 1 },
  { label: 'Earthen / Muted',          gen: genEarthen,        w: 2 },
];
const PALETTE_BAG = PALETTE_TYPES.flatMap((p) => Array(p.w).fill(p));

function generatePalette() {
  const type = pick(PALETTE_BAG);
  const raw = type.gen().map((c) => ({
    h: ((c.h % 360) + 360) % 360,
    s: clamp(c.s, 0, 100),
    l: clamp(c.l, 0, 100),
  }));
  raw.sort((a, b) => a.l - b.l);
  const colors = raw.map((c) => ({ hex: hslToHex(c.h, c.s, c.l), name: colorName(c.h, c.s, c.l) }));
  return { type: type.label, name: paletteName(), colors };
}

/* ---------- State / persistence ---------- */
const STORE_KEY = 'muse.artAssigner.v1';
let state = loadState();
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && typeof s === 'object') {
      return { history: s.history || [], favorites: s.favorites || [], prefs: s.prefs || {} };
    }
  } catch (e) { /* ignore */ }
  return { history: [], favorites: [], prefs: {} };
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* ---------- Current generation ---------- */
let current = null;              // the active generated prompt (unsaved)
const locks = { task: false, tool: false, primary: false, secondary: false, palette: false, constraint: false };

function selectedEffort() {
  return EFFORTS.find((e) => e.id === (state.prefs.effort || 2)) || EFFORTS[1];
}
function selectedMedium() { return state.prefs.medium || 'TD'; } // 'T', 'D', or 'TD' (surprise)
function focusFilter() { return state.prefs.focus || 'Any'; }
function challengeOn() { return !!state.prefs.challenge; }

/* ---------- Task weighting ----------
   Tasks are grouped, and each group has a weight per emphasis preset. A task is
   picked by first choosing a group (proportional to its weight among the groups
   that actually have eligible tasks right now), then a random task within it.
   Everything stays possible — favored themes just come up far more often.
   To retune, edit the numbers in EMPHASIS below, or the CATEGORY_GROUP map. */
const CATEGORY_GROUP = {
  // character / portrait pillar
  Portrait: 'character', Character: 'character', Figure: 'character',
  Anatomy: 'character', Animals: 'character',
  // environment / landscape pillar
  Landscape: 'environment', Concept: 'environment', Perspective: 'environment',
  // 3D render / blockout pillar
  Render: 'render',
  // combinations of the three pillars
  Fusion: 'fusion',
  // everything else falls through to 'longtail'
};
const groupOf = (cat) => CATEGORY_GROUP[cat] || 'longtail';

const EMPHASIS = {
  // ~75% of rolls land on the three pillars + fusion; the rest is the long tail
  pillars:  { character: 26, environment: 26, render: 16, fusion: 10, longtail: 22 },
  // a clear lean, but healthier variety
  balanced: { character: 20, environment: 20, render: 13, fusion: 8, longtail: 39 },
  // more surprise — the long tail shows up much more
  wildcard: { character: 16, environment: 16, render: 10, fusion: 8, longtail: 50 },
};
const emphasisWeights = () => EMPHASIS[state.prefs.emphasis] || EMPHASIS.pillars;

function pickWeightedTask(pool) {
  const w = emphasisWeights();
  const byGroup = {};
  for (const t of pool) (byGroup[groupOf(t.c)] = byGroup[groupOf(t.c)] || []).push(t);
  let total = 0;
  const cum = [];
  for (const g of Object.keys(byGroup)) {
    const weight = w[g] || 0;
    if (weight <= 0) continue;
    total += weight;
    cum.push([total, g]);
  }
  if (!total) return pick(pool); // no weighted group eligible → uniform fallback
  const r = Math.random() * total;
  let chosen = cum[cum.length - 1][1];
  for (const [c, g] of cum) { if (r < c) { chosen = g; break; } }
  return pick(byGroup[chosen]);
}

function matchingTasks() {
  const eff = selectedEffort().id;
  const med = selectedMedium();
  const focus = focusFilter();
  return TASKS.filter((t) => {
    if (!t.e.includes(String(eff))) return false;
    if (med === 'T' && !t.m.includes('T')) return false;
    if (med === 'D' && !t.m.includes('D')) return false;
    if (focus !== 'Any' && t.c !== focus) return false;
    return true;
  });
}

function genTaskField() {
  let pool = matchingTasks();
  if (!pool.length) {
    // relax focus, then medium, then effort
    const eff = selectedEffort().id, med = selectedMedium();
    pool = TASKS.filter((t) => t.e.includes(String(eff)) &&
      (med === 'TD' || t.m.includes(med)));
    if (!pool.length) pool = TASKS.filter((t) => t.e.includes(String(eff)));
    if (!pool.length) pool = TASKS;
  }
  // Weighted pick when no specific focus is chosen; a focus is an explicit hard filter.
  const t = focusFilter() === 'Any' ? pickWeightedTask(pool) : pick(pool);
  // resolve concrete medium label for display
  let medLabel;
  const med = selectedMedium();
  if (med === 'T') medLabel = 'Traditional';
  else if (med === 'D') medLabel = 'Digital';
  else medLabel = t.m === 'T' ? 'Traditional' : t.m === 'D' ? 'Digital' : pick(['Traditional', 'Digital']);
  return { task: t.t, category: t.c, mediumLabel: medLabel };
}
function genWordField(exclude) {
  let w; do { w = pick(WORDS); } while (w === exclude);
  return w;
}

// Regenerate every field that is not locked (locked fields are always kept).
// A field with no value yet is always generated, even if "locked".
function generate() {
  current = current || {};
  const eff = selectedEffort();
  if (!locks.task || !current.task) {
    const tf = genTaskField();
    current.task = tf.task; current.category = tf.category; current.mediumLabel = tf.mediumLabel;
    current.backstory = null; // new task → old backstory no longer applies
  }
  // Effort/duration always mirror the current selector (not a lockable field).
  current.effortId = eff.id;
  current.effortName = eff.name;
  current.minutes = eff.minutes;
  current.durationLabel = eff.sub;

  if (!locks.tool || !current.tool) current.tool = genToolField(current.mediumLabel);
  if (!locks.primary || !current.primary) current.primary = genWordField(current.secondary);
  if (!locks.secondary || !current.secondary) current.secondary = genWordField(current.primary);
  if (!locks.palette || !current.palette) current.palette = generatePalette();

  if (challengeOn()) {
    if (!locks.constraint || !current.constraint) current.constraint = pick(CONSTRAINTS);
  } else {
    current.constraint = null;
  }
  renderResult(true);
}

function rerollField(field) {
  if (!current) return;
  if (field === 'task') {
    const tf = genTaskField();
    current.task = tf.task; current.category = tf.category; current.mediumLabel = tf.mediumLabel; current.backstory = null;
    if (!locks.tool) current.tool = genToolField(current.mediumLabel); // keep tool matching the new medium
  }
  else if (field === 'tool') current.tool = genToolField(current.mediumLabel);
  else if (field === 'primary') current.primary = genWordField(current.secondary);
  else if (field === 'secondary') current.secondary = genWordField(current.primary);
  else if (field === 'palette') current.palette = generatePalette();
  else if (field === 'constraint') current.constraint = pick(CONSTRAINTS);
  renderResult(false);
}

/* ---------- Rendering: result ---------- */
function renderResult(pop) {
  if (!current) return;
  $('#empty-hint').classList.add('hidden');
  const res = $('#result');
  res.classList.remove('hidden');
  if (pop) { res.classList.remove('pop'); void res.offsetWidth; res.classList.add('pop'); }

  $('#r-effort').textContent = current.effortName;
  $('#r-medium').textContent = current.mediumLabel;
  $('#r-duration').textContent = current.durationLabel;
  $('#r-category').textContent = current.category;
  $('#r-task').textContent = current.task;
  $('#r-tool').textContent = current.tool || '';
  $('#r-primary').textContent = current.primary;
  $('#r-secondary').textContent = current.secondary;

  $('#r-palette-type').textContent = current.palette.type;
  $('#r-palette-name').textContent = '“' + current.palette.name + '”';
  const sw = $('#r-swatches');
  sw.innerHTML = '';
  current.palette.colors.forEach((c) => {
    const d = document.createElement('div');
    d.className = 'swatch';
    d.style.background = c.hex;
    d.title = `${c.name} · ${c.hex}`;
    d.innerHTML = `<span class="hex">${c.hex}</span>`;
    d.addEventListener('click', () => { copyText(c.hex); toast(`Copied ${c.hex}`); });
    sw.appendChild(d);
  });

  const cRow = $('#constraint-row');
  if (current.constraint) { cRow.classList.remove('hidden'); $('#r-constraint').textContent = current.constraint; }
  else cRow.classList.add('hidden');

  renderBackstory();

  // reflect locks
  $$('.lock-btn').forEach((b) => {
    const on = locks[b.dataset.lock];
    b.classList.toggle('locked', on);
    b.textContent = on ? '🔒' : '🔓';
  });

  resetTimer();
}

/* ---------- AI backstory ---------- */
function renderBackstory() {
  const row = $('#backstory-row');
  if (!current || !BACKSTORY_CATEGORIES.has(current.category)) { row.classList.add('hidden'); return; }
  row.classList.remove('hidden');
  const txt = $('#backstory-text');
  const btn = $('#backstory-btn');
  txt.classList.remove('loading');
  btn.disabled = false;
  if (current.backstory) {
    txt.textContent = current.backstory;
    txt.classList.remove('hidden');
    btn.textContent = '↻ Rewrite backstory';
  } else {
    txt.textContent = '';
    txt.classList.add('hidden');
    btn.textContent = '✨ Write a backstory';
  }
}
async function generateBackstory() {
  if (!current) return;
  const txt = $('#backstory-text');
  const btn = $('#backstory-btn');
  btn.disabled = true;
  btn.textContent = '✨ Summoning…';
  txt.classList.remove('hidden');
  txt.classList.add('loading');
  txt.textContent = 'Writing a short backstory…';
  try {
    const res = await fetch(BACKSTORY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: current.task,
        category: current.category,
        primary: current.primary,
        secondary: current.secondary,
        palette: current.palette ? current.palette.type + ' — ' + current.palette.name : '',
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || !data.backstory) throw new Error('empty');
    current.backstory = String(data.backstory).trim();
    renderBackstory();
    toast('✨ Backstory ready');
  } catch (e) {
    txt.classList.add('hidden');
    txt.classList.remove('loading');
    renderBackstory();
    toast('Couldn’t reach the writer — needs connection + the deployed function');
  }
}

/* ---------- Timer ---------- */
let timer = { remaining: 0, total: 0, running: false, iv: null };
function fmt(s) { const m = Math.floor(s / 60); const ss = s % 60; return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); }
function resetTimer() {
  clearInterval(timer.iv);
  timer.total = (current ? current.minutes : 0) * 60;
  timer.remaining = timer.total;
  timer.running = false;
  const d = $('#timer-display');
  d.textContent = fmt(timer.remaining);
  d.classList.remove('warn');
  $('#timer-start').textContent = 'Start timer';
}
function toggleTimer() {
  if (timer.running) {
    clearInterval(timer.iv); timer.running = false; $('#timer-start').textContent = 'Resume';
    return;
  }
  timer.running = true; $('#timer-start').textContent = 'Pause';
  timer.iv = setInterval(() => {
    timer.remaining--;
    const d = $('#timer-display');
    d.textContent = fmt(Math.max(0, timer.remaining));
    if (timer.remaining <= 60) d.classList.add('warn');
    if (timer.remaining <= 0) {
      clearInterval(timer.iv); timer.running = false; $('#timer-start').textContent = 'Start timer';
      toast('⏰ Time! Great work.');
      try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) {}
    }
  }, 1000);
}

/* ---------- Save session / favorites ---------- */
function todayKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function snapshot() {
  return {
    id: uid(),
    date: todayKey(),
    ts: Date.now(),
    task: current.task,
    category: current.category,
    medium: current.mediumLabel,
    effort: current.effortName,
    minutes: current.minutes,
    primary: current.primary,
    secondary: current.secondary,
    palette: current.palette,
    tool: current.tool || null,
    constraint: current.constraint || null,
    backstory: current.backstory || null,
    note: '',
  };
}
let pendingSession = null;
function openNoteModal() {
  if (!current) return;
  pendingSession = snapshot();
  $('#modal-sub').textContent = current.task;
  $('#modal-note').value = '';
  $('#modal').classList.remove('hidden');
  setTimeout(() => $('#modal-note').focus(), 50);
}
function commitSession() {
  if (!pendingSession) return;
  pendingSession.note = $('#modal-note').value.trim();
  state.history.unshift(pendingSession);
  save();
  pendingSession = null;
  $('#modal').classList.add('hidden');
  toast('✓ Session logged');
  renderStreakChip();
  renderCalendar();
  renderLog();
}
function saveFavorite() {
  if (!current) return;
  const fav = snapshot();
  state.favorites.unshift(fav);
  save();
  toast('☆ Saved to favorites');
  if (currentLogTab === 'favorites') renderLog();
}

/* ---------- Streak logic ---------- */
function doneDatesSet() {
  return new Set(state.history.map((h) => h.date));
}
function computeStreaks() {
  const set = doneDatesSet();
  if (!set.size) return { current: 0, best: 0, total: state.history.length };
  const dayMs = 86400000;
  // current streak: start today, or yesterday if today not done
  let cur = 0;
  let d = new Date(todayKey() + 'T00:00:00');
  if (!set.has(todayKey(d))) d = new Date(d.getTime() - dayMs);
  while (set.has(todayKey(d))) { cur++; d = new Date(d.getTime() - dayMs); }
  // best streak: scan all sorted dates
  const sorted = [...set].sort();
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00');
    const now = new Date(sorted[i] + 'T00:00:00');
    if (Math.round((now - prev) / dayMs) === 1) run++; else run = 1;
    best = Math.max(best, run);
  }
  best = Math.max(best, cur);
  return { current: cur, best, total: state.history.length };
}
function renderStreakChip() {
  const s = computeStreaks();
  $('#streak-chip-count').textContent = s.current;
}
function sessionsThisWeek() {
  const now = new Date(todayKey() + 'T00:00:00').getTime();
  const wk = now - 6 * 86400000;
  return state.history.filter((h) => {
    const t = new Date(h.date + 'T00:00:00').getTime();
    return t >= wk && t <= now;
  }).length;
}

/* ---------- Calendar ---------- */
let calView = new Date();
calView.setDate(1);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function countByDate() {
  const m = {};
  for (const h of state.history) m[h.date] = (m[h.date] || 0) + 1;
  return m;
}
function renderCalendar() {
  const s = computeStreaks();
  $('#stat-streak').textContent = s.current;
  $('#stat-best').textContent = s.best;
  $('#stat-total').textContent = s.total;
  $('#stat-week').textContent = sessionsThisWeek();

  $('#cal-title').textContent = MONTHS[calView.getMonth()] + ' ' + calView.getFullYear();
  const grid = $('#cal-grid');
  grid.innerHTML = '';
  const counts = countByDate();
  const year = calView.getFullYear(), month = calView.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const today = todayKey();

  for (let i = 0; i < first; i++) {
    const e = document.createElement('div'); e.className = 'cal-cell empty'; grid.appendChild(e);
  }
  for (let day = 1; day <= days; day++) {
    const key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (key === today) cell.classList.add('today');
    const cnt = counts[key];
    if (cnt) {
      cell.classList.add('done');
      cell.innerHTML = `${day}<span class="count">${cnt > 1 ? cnt : ''}</span>`;
      cell.addEventListener('click', () => showDay(key));
    } else {
      cell.textContent = day;
    }
    grid.appendChild(cell);
  }
  $('#day-detail').classList.add('hidden');
}
function showDay(key) {
  const items = state.history.filter((h) => h.date === key);
  if (!items.length) return;
  const box = $('#day-detail');
  const [y, m, d] = key.split('-');
  let html = `<h4>${MONTHS[+m - 1]} ${+d}, ${y} — ${items.length} session${items.length > 1 ? 's' : ''}</h4>`;
  html += items.map((it) => logItemHTML(it, false)).join('');
  box.innerHTML = html;
  box.classList.remove('hidden');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Log ---------- */
let currentLogTab = 'history';
function logItemHTML(it, deletable) {
  const sw = it.palette && it.palette.colors
    ? `<div class="li-swatches">${it.palette.colors.map((c) => `<span class="li-swatch" style="background:${c.hex}" title="${c.hex}"></span>`).join('')}</div>`
    : '';
  const note = it.note ? `<div class="li-note">“${escapeHTML(it.note)}”</div>` : '';
  const del = deletable ? `<button class="li-del" data-del="${it.id}">Delete</button>` : '';
  const dt = new Date(it.ts);
  const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `<div class="card log-item">
    <div class="li-top"><div class="li-date">${dateStr}</div>${del}</div>
    <div class="li-task">${escapeHTML(it.task)}</div>
    <div class="li-meta"><span>${it.effort}</span><span>·</span><span>${it.medium}</span>${it.tool ? `<span>·</span><span>🖌 ${escapeHTML(it.tool)}</span>` : ''}<span>·</span>
      <span>${escapeHTML(it.primary)} + ${escapeHTML(it.secondary)}</span></div>
    ${it.constraint ? `<div class="li-meta">⚡ ${escapeHTML(it.constraint)}</div>` : ''}
    ${it.backstory ? `<div class="li-note">✨ ${escapeHTML(it.backstory)}</div>` : ''}
    ${sw}${note}
  </div>`;
}
function renderLog() {
  const list = currentLogTab === 'history' ? state.history : state.favorites;
  const el = $('#log-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-log">${currentLogTab === 'history'
      ? 'No sessions yet. Complete a task and mark it done — it\'ll light up your calendar.'
      : 'No favorites yet. Tap ☆ Save on a generated task to keep it here.'}</div>`;
    return;
  }
  el.innerHTML = list.map((it) => logItemHTML(it, true)).join('');
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.del;
    if (currentLogTab === 'history') state.history = state.history.filter((h) => h.id !== id);
    else state.favorites = state.favorites.filter((h) => h.id !== id);
    save(); renderLog(); renderStreakChip(); renderCalendar();
  }));
}

/* ---------- Copy / share ---------- */
function currentAsText() {
  if (!current) return '';
  let s = `🎨 ${current.task}\n`;
  s += `• ${current.effortName} (${current.durationLabel}) · ${current.mediumLabel} · ${current.category}\n`;
  if (current.tool) s += `• Recommended tool: ${current.tool}\n`;
  s += `• Primary word: ${current.primary}\n• Secondary word: ${current.secondary}\n`;
  s += `• Palette (${current.palette.type} — “${current.palette.name}”): ${current.palette.colors.map((c) => c.hex).join(', ')}\n`;
  if (current.constraint) s += `• Challenge: ${current.constraint}\n`;
  if (current.backstory) s += `\nBackstory: ${current.backstory}\n`;
  return s.trim();
}
async function copyCurrent() {
  const text = currentAsText();
  if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    try { await navigator.share({ title: 'My art task', text }); return; } catch (e) { /* fall through */ }
  }
  copyText(text); toast('⧉ Copied to clipboard');
}
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).catch(() => fallbackCopy(t)); }
  else fallbackCopy(t);
}
function fallbackCopy(t) {
  const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
}

/* ---------- Helpers ---------- */
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- Feeling lucky ---------- */
function feelingLucky() {
  state.prefs.effort = ri(1, 4);
  state.prefs.medium = pick(['T', 'D']);
  save();
  syncSegments();
  generate();
}

/* ---------- Theme ---------- */
function applyTheme() {
  const t = state.prefs.theme || 'system';
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

/* ---------- Daily reminder ---------- */
function checkReminder() {
  const r = state.prefs.reminder;
  if (!r || !r.enabled || !r.time) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = todayKey();
  if (state.prefs.lastReminded === today) return;
  if (state.history.some((h) => h.date === today)) return;
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  if (hhmm >= r.time) {
    try { new Notification('Ignite 🔥', { body: 'You haven\'t made anything today — time to start.', icon: 'icons/icon-192.png' }); } catch (e) {}
    state.prefs.lastReminded = today; save();
  }
}

/* ---------- Data backup ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ignite-backup-' + todayKey() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!d || typeof d !== 'object') throw new Error('bad');
      state.history = Array.isArray(d.history) ? d.history : [];
      state.favorites = Array.isArray(d.favorites) ? d.favorites : [];
      state.prefs = d.prefs && typeof d.prefs === 'object' ? d.prefs : {};
      save();
      applyTheme(); refreshControls(); buildSettings();
      renderStreakChip(); renderCalendar(); renderLog();
      toast('Data imported');
    } catch (e) { toast('Could not read that backup file'); }
  };
  reader.readAsText(file);
}
function clearData() {
  if (!confirm('Delete all sessions, favorites and settings? This cannot be undone.')) return;
  state = { history: [], favorites: [], prefs: {} };
  save();
  applyTheme(); refreshControls(); buildSettings();
  renderStreakChip(); renderCalendar(); renderLog();
  toast('All data cleared');
}

/* ---------- Settings panel ---------- */
function toolChipsHTML(list) {
  return list.map((t) => {
    const st = toolState(t);
    return `<button class="tool-chip" data-tool="${escapeHTML(t)}" data-state="${st}" title="${st}">${escapeHTML(t)}</button>`;
  }).join('');
}
function buildSettings() {
  const el = $('#tab-settings');
  const theme = state.prefs.theme || 'system';
  const r = state.prefs.reminder || { enabled: false, time: '18:00' };
  const emph = state.prefs.emphasis || 'pillars';
  el.innerHTML = `
    <div class="card settings-card">
      <div class="settings-group">
        <div class="settings-label">Task emphasis</div>
        <div class="segmented emphasis-seg">
          <button data-emph="pillars"${emph === 'pillars' ? ' class="active"' : ''}>My pillars</button>
          <button data-emph="balanced"${emph === 'balanced' ? ' class="active"' : ''}>Balanced</button>
          <button data-emph="wildcard"${emph === 'wildcard' ? ' class="active"' : ''}>Wildcard</button>
        </div>
        <div class="settings-hint"><b>My pillars</b> leans hard toward character/portrait, environment/landscape, 3D&nbsp;blockout, and combinations of them. <b>Balanced</b> evens things out; <b>Wildcard</b> brings back more of the long tail (leaves, still life, patterns…). Everything can still appear — this just changes how often.</div>
      </div>
      <div class="settings-group">
        <div class="settings-label">My tools <button id="tools-reset" class="link-btn">reset</button></div>
        <div class="settings-hint">Tap a tool to cycle <b>Off</b> · <b>Rare</b> · <b>Normal</b> · <b>Often</b>. Turn off what you don't own and the suggester only picks from your kit; set favorites to <b>Often</b>. It never picks by task type — just this weighting.</div>
        <div class="tools-sub">Traditional</div>
        <div class="tool-chips" data-pool="traditional">${toolChipsHTML(TRADITIONAL_TOOLS)}</div>
        <div class="tools-sub">Digital</div>
        <div class="tool-chips" data-pool="digital">${toolChipsHTML(DIGITAL_TOOLS)}</div>
      </div>
      <div class="settings-group">
        <div class="settings-label">Appearance</div>
        <div class="segmented theme-seg">
          <button data-theme-opt="system"${theme === 'system' ? ' class="active"' : ''}>System</button>
          <button data-theme-opt="dark"${theme === 'dark' ? ' class="active"' : ''}>Dark</button>
          <button data-theme-opt="light"${theme === 'light' ? ' class="active"' : ''}>Light</button>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-label">Daily reminder</div>
        <label class="opt toggle"><input type="checkbox" id="reminder-toggle"${r.enabled ? ' checked' : ''}><span>Nudge me if I haven't created yet</span></label>
        <div class="reminder-time-row"><span>Remind me at</span><input type="time" id="reminder-time" value="${r.time || '18:00'}"></div>
        <div class="settings-hint">Fires while the app is open or installed as an app. Needs notification permission.</div>
      </div>
      <div class="settings-group">
        <div class="settings-label">Your data</div>
        <div class="settings-hint">Everything lives only on this device. Export a backup to keep it safe or move it to another device.</div>
        <div class="settings-actions">
          <button id="export-btn" class="btn-mini">⬇ Export backup</button>
          <button id="import-btn" class="btn-mini">⬆ Import backup</button>
          <input type="file" id="import-file" accept="application/json" class="hidden">
          <button id="clear-btn" class="btn-mini danger">Clear all data</button>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-label">About</div>
        <div class="settings-hint">Ignite — a random art task assigner that helps you start. All data stays on your device.</div>
      </div>
    </div>`;

  $$('[data-emph]', el).forEach((b) => b.addEventListener('click', () => {
    state.prefs.emphasis = b.dataset.emph; save();
    $$('[data-emph]', el).forEach((x) => x.classList.toggle('active', x === b));
  }));
  $$('.tool-chip', el).forEach((chip) => chip.addEventListener('click', () => {
    const name = chip.dataset.tool;
    const next = TOOL_STATES[(TOOL_STATES.indexOf(toolState(name)) + 1) % TOOL_STATES.length];
    state.prefs.toolWeights = state.prefs.toolWeights || {};
    state.prefs.toolWeights[name] = next;
    save();
    chip.dataset.state = next; chip.title = next;
  }));
  $('#tools-reset', el).addEventListener('click', () => {
    state.prefs.toolWeights = {}; save();
    $$('.tool-chip', el).forEach((c) => { c.dataset.state = 'normal'; c.title = 'normal'; });
    toast('Tools reset to Normal');
  });
  $$('[data-theme-opt]', el).forEach((b) => b.addEventListener('click', () => {
    state.prefs.theme = b.dataset.themeOpt; save(); applyTheme();
    $$('[data-theme-opt]', el).forEach((x) => x.classList.toggle('active', x === b));
  }));
  $('#reminder-toggle', el).addEventListener('change', async (e) => {
    const on = e.target.checked;
    state.prefs.reminder = state.prefs.reminder || { time: '18:00' };
    state.prefs.reminder.enabled = on;
    if (on && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (err) {}
    }
    if (on && (!('Notification' in window) || Notification.permission !== 'granted')) {
      toast('Allow notifications to receive reminders');
    }
    save();
  });
  $('#reminder-time', el).addEventListener('change', (e) => {
    state.prefs.reminder = state.prefs.reminder || {};
    state.prefs.reminder.time = e.target.value; save();
  });
  $('#export-btn', el).addEventListener('click', exportData);
  $('#import-btn', el).addEventListener('click', () => $('#import-file', el).click());
  $('#import-file', el).addEventListener('change', (e) => { if (e.target.files[0]) importData(e.target.files[0]); });
  $('#clear-btn', el).addEventListener('click', clearData);
}

/* ---------- Build controls ---------- */
function refreshControls() {
  if (state.prefs.effort == null) state.prefs.effort = 2;
  if (state.prefs.medium == null) state.prefs.medium = 'TD';
  if (state.prefs.emphasis == null) state.prefs.emphasis = 'pillars';
  syncSegments();
  const f = $('#focus-select'); if (f) f.value = focusFilter();
  const c = $('#challenge-toggle'); if (c) c.checked = challengeOn();
}
function buildControls() {
  // energy
  const eSeg = $('#energy-seg');
  EFFORTS.forEach((e) => {
    const b = document.createElement('button');
    b.dataset.effort = e.id;
    b.innerHTML = `<span class="seg-flame" style="opacity:${e.heat}">🔥</span><span>${e.name}</span><span class="seg-sub">${e.sub}</span>`;
    b.addEventListener('click', () => { state.prefs.effort = e.id; save(); syncSegments(); });
    eSeg.appendChild(b);
  });
  // medium
  const mSeg = $('#medium-seg');
  [['T', 'Traditional'], ['D', 'Digital'], ['TD', 'Surprise me']].forEach(([val, label]) => {
    const b = document.createElement('button');
    b.dataset.medium = val; b.textContent = label;
    b.addEventListener('click', () => { state.prefs.medium = val; save(); syncSegments(); });
    mSeg.appendChild(b);
  });
  // focus
  const focus = $('#focus-select');
  const cats = ['Any', ...[...new Set(TASKS.map((t) => t.c))].sort()];
  focus.innerHTML = cats.map((c) => `<option value="${c}">${c === 'Any' ? 'Any subject' : c}</option>`).join('');
  focus.value = focusFilter();
  focus.addEventListener('change', () => { state.prefs.focus = focus.value; save(); });
  // challenge
  const ch = $('#challenge-toggle');
  ch.checked = challengeOn();
  ch.addEventListener('change', () => {
    state.prefs.challenge = ch.checked; save();
    if (current) { // reflect immediately
      if (ch.checked && !current.constraint) current.constraint = pick(CONSTRAINTS);
      if (!ch.checked) current.constraint = null;
      renderResult(false);
    }
  });

  refreshControls();
}
function syncSegments() {
  $$('#energy-seg button').forEach((b) => b.classList.toggle('active', +b.dataset.effort === state.prefs.effort));
  $$('#medium-seg button').forEach((b) => b.classList.toggle('active', b.dataset.medium === state.prefs.medium));
}

/* ---------- Navigation (single page) ---------- */
function openSettings() {
  buildSettings();
  $('#settings-modal').classList.remove('hidden');
}
function closeSettings() { $('#settings-modal').classList.add('hidden'); }
function initNav() {
  // Streak chip scrolls to the calendar section
  $('#streak-chip').addEventListener('click', () => {
    $('#sec-calendar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // Settings modal (cog)
  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', closeSettings);
  $('#settings-modal').addEventListener('click', (e) => { if (e.target.id === 'settings-modal') closeSettings(); });
  // Log sub-tabs
  $$('.log-tab').forEach((b) => b.addEventListener('click', () => {
    $$('.log-tab').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); currentLogTab = b.dataset.log; renderLog();
  }));
}

/* ---------- Wire up ---------- */
function init() {
  applyTheme();
  buildControls();
  initNav();

  $('#generate-btn').addEventListener('click', () => generate());
  $('#lucky-btn').addEventListener('click', feelingLucky);
  $('#reroll-all-btn').addEventListener('click', () => generate());
  $('#done-btn').addEventListener('click', openNoteModal);
  $('#fav-btn').addEventListener('click', saveFavorite);
  $('#copy-btn').addEventListener('click', copyCurrent);

  $$('.reroll-btn').forEach((b) => b.addEventListener('click', () => rerollField(b.dataset.reroll)));
  $$('.lock-btn').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.lock; locks[f] = !locks[f];
    b.classList.toggle('locked', locks[f]); b.textContent = locks[f] ? '🔒' : '🔓';
  }));

  $('#backstory-btn').addEventListener('click', generateBackstory);

  $('#timer-start').addEventListener('click', toggleTimer);
  $('#timer-reset').addEventListener('click', resetTimer);

  $('#cal-prev').addEventListener('click', () => { calView.setMonth(calView.getMonth() - 1); renderCalendar(); });
  $('#cal-next').addEventListener('click', () => { calView.setMonth(calView.getMonth() + 1); renderCalendar(); });

  $('#modal-cancel').addEventListener('click', () => { $('#modal').classList.add('hidden'); pendingSession = null; });
  $('#modal-save').addEventListener('click', commitSession);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') { $('#modal').classList.add('hidden'); pendingSession = null; } });

  renderStreakChip();
  renderCalendar();
  renderLog();

  checkReminder();
  setInterval(checkReminder, 60000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
