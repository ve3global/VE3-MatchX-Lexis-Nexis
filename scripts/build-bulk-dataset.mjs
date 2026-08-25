/**
 * Turns a raw LC_London-style CSV (Forename/Surname/Date of Birth/address
 * columns) into the two enriched data files Newman drives
 * docs/postman/bulk-data-validation/LN-Replica-BulkDataValidation.postman_collection.json
 * with: one row per source row, mapped to POST /reports's inline fields,
 * plus a pre-computed ExpectedStatus/ExpectedErrors pair derived directly
 * from src/modules/reports/schema.ts's real validation rules (NAME_RE,
 * DATE_RE, max-length checks) — not guessed, not re-derived by hand per
 * dataset. Re-run this whenever the source CSV changes.
 *
 * Usage:
 *   node scripts/build-bulk-dataset.mjs <source.csv> <full-out.csv> <sample-out.csv> [sampleSize=2000]
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';

const SRC = process.argv[2];
const OUT_FULL = process.argv[3];
const OUT_SAMPLE = process.argv[4];
const SAMPLE_SIZE = Number(process.argv[5] ?? 2000);

if (!SRC || !OUT_FULL || !OUT_SAMPLE) {
  console.error(
    'Usage: node scripts/build-bulk-dataset.mjs <source.csv> <full-out.csv> <sample-out.csv> [sampleSize=2000]',
  );
  process.exit(1);
}

// Minimal RFC4180 CSV line parser (quoted fields, embedded commas, ""
// escaped quotes). Assumes no embedded newlines inside quoted fields.
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        fields.push(cur);
        cur = '';
      } else cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

// Always quote our own output — simple and unambiguous for Newman's CSV reader.
function csvField(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

// Mirrors src/modules/reports/schema.ts exactly.
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const NAME_RE = /^\p{L}+(?:['\- ]\p{L}+)*$/u;

function nameErrors(field, value, codeMax, codeInvalid) {
  const errs = [];
  if (value.length > 64) errs.push({ field, code: codeMax });
  else if (!NAME_RE.test(value)) errs.push({ field, code: codeInvalid });
  return errs;
}

// Agreed CSV -> report-field mapping: House Name/Number -> address1
// (required), Building Name -> address2, Street -> address3, District ->
// address4, Town+County folded into address5 (all optional, no length
// issues found on any of them in the LC London dataset).
function buildRequestFields(row) {
  return {
    Forename: row['Forename'],
    Surname: row['Surname'],
    Dob: row['Date of Birth'],
    Address1: row['House Name/Number'],
    Address2: row['Building Name'],
    Address3: row['Street'],
    Address4: row['District'],
    Address5: [row['Town'], row['County']].filter(Boolean).join(', '),
    Postcode: row['Postcode'],
  };
}

function computeExpected(fields) {
  const errors = [];
  errors.push(...nameErrors('forename', fields.Forename, 1128, 1286));
  errors.push(...nameErrors('surname', fields.Surname, 1130, 1287));
  if (!DOB_RE.test(fields.Dob)) errors.push({ field: 'dob', code: 1013 });
  if (fields.Postcode.length > 8) errors.push({ field: 'address.postcode', code: 1136 });
  if (fields.Address1.length > 64) errors.push({ field: 'address.address1', code: 1131 });

  return { status: errors.length > 0 ? 422 : 201, errors };
}

const OUT_HEADER = [
  'RowId',
  'Forename',
  'Surname',
  'Dob',
  'Address1',
  'Address2',
  'Address3',
  'Address4',
  'Address5',
  'Postcode',
  'ExpectedStatus',
  'ExpectedErrors',
];

async function countRows(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let n = -1; // subtract the header
  for await (const line of rl) if (line !== '') n++;
  return n;
}

async function main() {
  const totalRows = await countRows(SRC);
  const sampleIndexes = new Set();
  while (sampleIndexes.size < Math.min(SAMPLE_SIZE, totalRows)) {
    sampleIndexes.add(1 + Math.floor(Math.random() * totalRows));
  }

  const rl = createInterface({ input: createReadStream(SRC), crlfDelay: Infinity });
  const fullOut = createWriteStream(OUT_FULL);
  const sampleOut = createWriteStream(OUT_SAMPLE);
  fullOut.write(OUT_HEADER.join(',') + '\n');
  sampleOut.write(OUT_HEADER.join(',') + '\n');

  let header = null;
  let rowNum = 0;
  const statusCounts = { 201: 0, 422: 0 };
  const sampleStatusCounts = { 201: 0, 422: 0 };
  let sampleWritten = 0;

  for await (const line of rl) {
    if (line === '') continue;
    const parsed = parseCsvLine(line);
    if (header === null) {
      header = parsed;
      continue;
    }
    rowNum++;
    const row = Object.fromEntries(header.map((h, i) => [h, parsed[i]]));
    const fields = buildRequestFields(row);
    const expected = computeExpected(fields);
    statusCounts[expected.status]++;

    const outLine = [
      csvField(row['ID']),
      csvField(fields.Forename),
      csvField(fields.Surname),
      csvField(fields.Dob),
      csvField(fields.Address1),
      csvField(fields.Address2),
      csvField(fields.Address3),
      csvField(fields.Address4),
      csvField(fields.Address5),
      csvField(fields.Postcode),
      csvField(expected.status),
      csvField(JSON.stringify(expected.errors)),
    ].join(',');

    fullOut.write(outLine + '\n');

    if (sampleIndexes.has(rowNum)) {
      sampleOut.write(outLine + '\n');
      sampleStatusCounts[expected.status]++;
      sampleWritten++;
    }
  }

  fullOut.end();
  sampleOut.end();

  console.log('Full dataset:', rowNum, 'rows ->', statusCounts);
  console.log('Sample dataset:', sampleWritten, 'rows ->', sampleStatusCounts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
