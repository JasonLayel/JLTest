import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    category: z.enum([
      '3D Rendering',
      '3D Film Cinematics & Editing',
      'VR/AR/XR',
      'Interactive Experiences',
    ]),
    summary: z.string(),
    year: z.string().optional(),
    role: z.string().optional(),
    tools: z.array(z.string()).default([]),
    hero: z.string(), // path relative to src/assets
    heroAlt: z.string().default(''),
    order: z.number().default(99),
    // true while the case study is a structured slot awaiting real content
    isSlot: z.boolean().default(false),
  }),
});

export const collections = { work };
