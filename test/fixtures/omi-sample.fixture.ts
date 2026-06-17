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
  row(['NORD OVEST', 'LOMBARDIA', 'MI', '015146', 'F205', '', 'F205', 'MILANO', 'Centro storico', 'MI_1', '20', 'Abitazioni civili', '1']),
  row(['NORD OVEST', 'LOMBARDIA', 'MI', '015146', 'F205', '', 'F205', 'MILANO', 'Semicentro', 'MI_2', '20', 'Abitazioni civili', '2']),
].join('\n');

export const SAMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark>
    <ExtendedData><SchemaData><SimpleData name="LinkZona">MI_1</SimpleData></SchemaData></ExtendedData>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      9.18,45.46,0 9.20,45.46,0 9.20,45.475,0 9.18,45.475,0 9.18,45.46,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>
  <Placemark>
    <ExtendedData><SchemaData><SimpleData name="LinkZona">SARD_AFRICA</SimpleData></SchemaData></ExtendedData>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      8.0,0.0,0 8.1,0.0,0 8.1,0.1,0 8.0,0.1,0 8.0,0.0,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark>
</Document></kml>`;
