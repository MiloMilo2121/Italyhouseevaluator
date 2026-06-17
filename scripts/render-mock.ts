/**
 * Genera un file HTML standalone di ANTEPRIMA (report + perizia con dati fittizi)
 * usando le funzioni di render PURE dell'app. Nessun DB/LLM/env.
 *   npm run render:mock            → scrive mock-preview.html
 *   npm run render:mock -- <path>  → scrive nel path indicato
 */
import { writeFileSync } from 'node:fs';
import { renderMockDocument } from '@/lib/mock/preview';

const out = process.argv[2] ?? 'mock-preview.html';
writeFileSync(out, renderMockDocument(), 'utf-8');
console.log(`✓ Anteprima scritta in ${out}`);
