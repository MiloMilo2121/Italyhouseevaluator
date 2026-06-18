import { EXPECTED_VALORI_HEADERS, EXPECTED_ZONE_HEADERS } from '@/lib/omi/csv';

/**
 * Mini-campione OMI inline (VALORI + ZONE + KML) per testare la pipeline pura
 * senza dipendere dai dati reali. Tre zone: MI_1 (con geometria), MI_2 (senza
 * geometria → gap tipo Forlì-Cesena), SARD_AFRICA (geometria fuori Italia).
 */

const row = (fields: string[]): string => fields.join(';') + ';'; // `;` finale spurio

export const SAMPLE_VALORI = [
  'Quotazioni Immobiliari - 2024 Semestre 2;', // didascalia da scartare
  EXPECTED_VALORI_HEADERS.join(';') + ';',
  row(['NORD OVEST', 'LOMBARDIA', 'MI', '015146', 'F205', '', 'F205', 'MILANO', 'B', '1', 'MI_1', '20', 'Abitazioni civili', 'NORMALE', '', '2.800,00', '3.400,00', 'L', '10,50', '13,00', 'L']),
  row(['NORD OVEST', 'LOMBARDIA', 'MI', '015146', 'F205', '', 'F205', 'MILANO', 'B', '1', 'MI_1', '20', 'Abitazioni civili', 'OTTIMO', '', '3.500,00', '4.200,00', 'L', '0,00', '0,00', 'L']),
  row(['NORD OVEST', 'LOMBARDIA', 'MI', '015146', 'F205', '', 'F205', 'MILANO', 'C', '2', 'MI_2', '20', 'Abitazioni civili', 'NORMALE', '', '2.200,00', '2.700,00', 'L', '9,00', '11,00', 'L']),
].join('\n');

export const SAMPLE_ZONE = [
  'Zone OMI - 2024 Semestre 2;',
  EXPECTED_ZONE_HEADERS.join(';') + ';',
  row(['NORD OVEST', 'LOMBARDIA', 'MI', '015146', 'F205', '', 'F205', 'MILANO', 'B', 'Centro storico', '1', 'MI_1', '20', 'Abitazioni civili', 'NORMALE', '1']),
  row(['NORD OVEST', 'LOMBARDIA', 'MI', '015146', 'F205', '', 'F205', 'MILANO', 'C', 'Semicentro', '2', 'MI_2', '20', 'Abitazioni civili', 'NORMALE', '2']),
].join('\n');

/**
 * KML nel formato reale "perimetri OMI": ExtendedData con <Data name="CODCOM">
 * + <Data name="CODZONA"> (il campo LINKZONA è vuoto). La chiave geometrica è
 * `${CODCOM}_${CODZONA}` (uppercase) e combacia con `${Comune_amm}_${Zona}` del
 * VALORI: F205_1 (Milano zona 1, geometria valida) e SARD_AF (fuori Italia).
 */
export const SAMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark>
    <name>MILANO - Zona OMI 1</name>
    <ExtendedData>
      <Data name="LINKZONA"><value></value></Data>
      <Data name="CODCOM"><value>F205</value></Data>
      <Data name="CODZONA"><value>1</value></Data>
    </ExtendedData>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      9.18,45.46,0 9.20,45.46,0 9.20,45.475,0 9.18,45.475,0 9.18,45.46,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>
  <Placemark>
    <name>SARD - Zona OMI AF</name>
    <ExtendedData>
      <Data name="CODCOM"><value>SARD</value></Data>
      <Data name="CODZONA"><value>AF</value></Data>
    </ExtendedData>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      8.0,0.0,0 8.1,0.0,0 8.1,0.1,0 8.0,0.1,0 8.0,0.0,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>
</Document></kml>`;
