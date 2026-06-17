/**
 * Elaborazione documenti in batch/retry (V2 Step 3). Stessa logica della route
 * /api/documenti/process ma fuori dal request path: utile per ri-processare
 * documenti 'failed' o riconciliare a posteriori. Usa l'orchestratore puro
 * (`lib/documents/process`) con le deps reali (service role + factory adapter).
 *
 *   npm run process:documents -- --reference-id VAL-XXXXXXXX --mode all
 *   npm run process:documents -- --reference-id VAL-XXXXXXXX --mode reconcile
 *   npm run process:documents -- --reference-id VAL-XXXXXXXX --dry-run
 */
import { createServiceClient } from '@/lib/db/client';
import { buildProcessDeps } from '@/lib/documents/build-process-deps';
import { extractPending, reconcileReference, revertReference } from '@/lib/documents/process';

type Mode = 'extract' | 'reconcile' | 'revert' | 'all';

interface Args {
  referenceId: string | null;
  mode: Mode;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : null;
  };
  const m = get('--mode');
  const mode: Mode = m === 'extract' || m === 'reconcile' || m === 'revert' ? m : 'all';
  return {
    referenceId: get('--reference-id'),
    mode,
    dryRun: argv.includes('--dry-run'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

const HELP = `Elaborazione documenti (vision/whisper/catasto + reconcile/re-enrich)

Uso:
  npm run process:documents -- --reference-id <VAL-...> [--mode <extract|reconcile|revert|all>] [--dry-run]

Opzioni:
  --reference-id  reference della valutazione (obbligatorio)
  --mode          extract | reconcile | revert | all (default all)
  --dry-run       stampa l'intento, senza chiamare LLM/DB
  --help, -h      questo aiuto
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (!args.referenceId) throw new Error('--reference-id è obbligatorio');

  console.log(`\n── Elaborazione documenti (${args.referenceId}, mode=${args.mode}) ──`);
  if (args.dryRun) {
    console.log('[dry-run] nessuna chiamata LLM/DB.');
    return;
  }

  const service = createServiceClient();
  const deps = await buildProcessDeps(service);

  if (args.mode === 'extract' || args.mode === 'all') {
    console.log('  extract  :', await extractPending(args.referenceId, deps));
  }
  if (args.mode === 'reconcile' || args.mode === 'all') {
    console.log('  reconcile:', await reconcileReference(args.referenceId, deps));
  }
  if (args.mode === 'revert') {
    console.log('  revert   :', await revertReference(args.referenceId, deps));
  }
  console.log('\n✓ Completato.');
}

main().catch((err: unknown) => {
  console.error('\n✗ Elaborazione documenti fallita:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
