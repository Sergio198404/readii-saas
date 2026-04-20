// Common UK SOC 2020 codes used in skilled worker sponsorship.
// `requires_crc`: role category that typically requires a criminal record certificate
// (education, healthcare, social care). Used to trigger Q6 in the questionnaire.
// Not exhaustive — admin can type a custom SOC code if not listed.

export const SOC_CODES = [
  // Executives & directors
  { code: '1115', label: 'Chief executives and senior officials', requires_crc: false },
  { code: '1131', label: 'Financial managers and directors', requires_crc: false },
  { code: '1132', label: 'Marketing and sales directors', requires_crc: false },
  // Science & engineering
  { code: '2111', label: 'Chemical scientists', requires_crc: false },
  { code: '2112', label: 'Biological scientists and biochemists', requires_crc: false },
  { code: '2121', label: 'Civil engineers', requires_crc: false },
  { code: '2122', label: 'Mechanical engineers', requires_crc: false },
  { code: '2123', label: 'Electrical engineers', requires_crc: false },
  { code: '2124', label: 'Electronics engineers', requires_crc: false },
  { code: '2126', label: 'Design and development engineers', requires_crc: false },
  // IT
  { code: '2134', label: 'IT project and programme managers', requires_crc: false },
  { code: '2135', label: 'IT business analysts, architects and systems designers', requires_crc: false },
  { code: '2136', label: 'Programmers and software development professionals', requires_crc: false },
  { code: '2137', label: 'Web design and development professionals', requires_crc: false },
  { code: '2139', label: 'IT and telecommunications professionals n.e.c.', requires_crc: false },
  // Healthcare (CRC required)
  { code: '2211', label: 'Medical practitioners', requires_crc: true },
  { code: '2212', label: 'Psychologists', requires_crc: true },
  { code: '2221', label: 'Physiotherapists', requires_crc: true },
  { code: '2231', label: 'Nurses', requires_crc: true },
  // Education (CRC required)
  { code: '2312', label: 'Further education teaching professionals', requires_crc: true },
  { code: '2314', label: 'Secondary education teaching professionals', requires_crc: true },
  { code: '2315', label: 'Primary and nursery education teaching professionals', requires_crc: true },
  // Finance & business analysis
  { code: '2411', label: 'Chartered and certified accountants', requires_crc: false },
  { code: '2413', label: 'Management accountants', requires_crc: false },
  { code: '2421', label: 'Management consultants', requires_crc: false },
  { code: '2423', label: 'Business analysts', requires_crc: false },
  { code: '2425', label: 'Actuaries, economists and statisticians', requires_crc: false },
  // Legal
  { code: '2451', label: 'Solicitors and lawyers', requires_crc: false },
  // Design
  { code: '3421', label: 'Graphic designers', requires_crc: false },
  { code: '3422', label: 'Product, clothing and related designers', requires_crc: false },
  // Sales & marketing associates
  { code: '3543', label: 'Marketing associate professionals', requires_crc: false },
  { code: '3545', label: 'Sales accounts and business development managers', requires_crc: false },
  // Care (CRC required)
  { code: '6141', label: 'Nursing auxiliaries and assistants', requires_crc: true },
  { code: '6145', label: 'Care workers and home carers', requires_crc: true },
];

export function socRequiresCriminalRecord(code) {
  const entry = SOC_CODES.find(s => s.code === code);
  return entry?.requires_crc ?? false;
}
