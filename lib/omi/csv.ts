/**
 * Parsing dei CSV OMI. Insidie reali del formato (documentate):
 * - separatore `;`
 * - una riga di didascalia iniziale da scartare
 * - un `;` finale spurio per riga (campo vuoto in coda)
 * - encoding non dichiarato → il chiamante decodifica come UTF-8
 *
 * §8 — Conformità colonne: le intestazioni del CSV reale sono validate
 * all'avvio; se numero/ordine non corrispondono allo schema atteso si fallisce
 * con un messaggio chiaro, invece di mappare male i campi silenziosamente.
 */

/** Tracciato atteso del file VALORI (quotazioni). Adattabile per semestre. */
export const EXPECTED_VALORI_HEADERS = [
  'Area_territoriale',
  'Regione',
  'Prov',
  'Comune_ISTAT',
  'Comune_cat',
  'Sez',
  'Comune_amm',
  'Comune_descrizione',
  'Fascia',
  'Zona',
  'LinkZona',
  'Cod_Tip',
  'Descr_Tipologia',
  'Stato',
  'Stato_prev',
  'Compr_min',
  'Compr_max',
  'Sup_NL_compr',
  'Loc_min',
  'Loc_max',
  'Sup_NL_loc',
] as const;

/** Tracciato atteso del file ZONE. */
export const EXPECTED_ZONE_HEADERS = [
  'Area_territoriale',
  'Regione',
  'Prov',
  'Comune_ISTAT',
  'Comune_cat',
  'Sez',
  'Comune_amm',
  'Comune_descrizione',
  'Zona_Descr',
  'LinkZona',
  'Cod_tip_prevalente',
  'Descr_tip_prevalente',
  'Microzona',
] as const;

export class OmiHeaderMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OmiHeaderMismatchError';
  }
}

function splitLines(raw: string): string[] {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

/** Token di una riga, togliendo il `;` finale spurio (campo vuoto in coda). */
function splitRow(line: string): string[] {
  const tokens = line.split(';');
  if (tokens.length > 0 && tokens[tokens.length - 1] === '') tokens.pop();
  return tokens;
}

export function validateHeaders(actual: string[], expected: readonly string[]): void {
  const normalize = (s: string): string => s.trim();
  const a = actual.map(normalize);
  const e = expected.map(normalize);
  if (a.length !== e.length || e.some((name, i) => a[i] !== name)) {
    const diff = e
      .map((name, i) => (a[i] === name ? `  ✓ ${name}` : `  ✗ atteso "${name}", trovato "${a[i] ?? '<mancante>'}"`))
      .join('\n');
    const extra = a.length > e.length ? `\n  + colonne extra: ${a.slice(e.length).join(', ')}` : '';
    throw new OmiHeaderMismatchError(
      `Intestazioni CSV OMI non conformi (attese ${e.length}, trovate ${a.length}):\n${diff}${extra}`,
    );
  }
}

export interface CsvParseResult {
  rows: Record<string, string>[];
  malformedLineNumbers: number[];
}

/**
 * Parsa un CSV OMI: scarta la didascalia iniziale, valida l'header (§8), mappa
 * le righe dati per nome colonna prendendo i primi `expected.length` token
 * (robusto al `;` finale). Righe con meno token dell'atteso sono segnalate.
 */
export function parseOmiCsv(raw: string, expected: readonly string[]): CsvParseResult {
  const lines = splitLines(raw);
  // Scarta la prima riga (didascalia) e le righe vuote in testa.
  let idx = 0;
  while (idx < lines.length && lines[idx]!.trim() === '') idx++;
  idx++; // didascalia
  while (idx < lines.length && lines[idx]!.trim() === '') idx++;

  const headerLine = lines[idx];
  if (headerLine === undefined) {
    throw new OmiHeaderMismatchError('File CSV OMI privo di riga di intestazione.');
  }
  validateHeaders(splitRow(headerLine), expected);
  idx++;

  const rows: Record<string, string>[] = [];
  const malformedLineNumbers: number[] = [];
  for (let i = idx; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    const tokens = splitRow(line);
    if (tokens.length < expected.length) {
      malformedLineNumbers.push(i + 1); // 1-based
      continue;
    }
    const record: Record<string, string> = {};
    for (let c = 0; c < expected.length; c++) record[expected[c]!] = (tokens[c] ?? '').trim();
    rows.push(record);
  }
  return { rows, malformedLineNumbers };
}
