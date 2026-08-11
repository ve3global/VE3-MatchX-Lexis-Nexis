import { int, pick, seedFrom, subSeed } from '../../lib/determinism.js';

export interface AddressCandidate {
  reference: string;
  full_address: string;
  house: string;
  street: string;
  town: string;
  postcode: string;
}

export interface AddressLookupInput {
  postcode?: string;
  full_address?: string;
  house?: string;
  street?: string;
  town?: string;
}

const STREET_NAMES = [
  'High Street',
  'Church Lane',
  'Mill Road',
  'Station Road',
  'Victoria Avenue',
  'Park Road',
  'Kings Road',
  'Queens Drive',
];

const TOWN_NAMES = [
  'Bristol',
  'Leeds',
  'Manchester',
  'Sheffield',
  'Nottingham',
  'Reading',
  'Exeter',
  'York',
];

const POSTCODES = ['AB1 2CD', 'EF3 4GH', 'JK5 6LM', 'NP7 8QR'];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').trim();
}

/**
 * Doc parity special-case (constitution.md's determinism engine section):
 * the PDF's sample subject's address is 204 Julius Road, BS7 8EU. A lookup
 * that matches it always returns that address, reproducing the doc's own
 * sample response.
 */
function isDocSample(input: AddressLookupInput): boolean {
  const postcode = input.postcode ? normalize(input.postcode) : '';
  const fullAddress = input.full_address ? input.full_address.toLowerCase() : '';
  return postcode === 'bs78eu' || fullAddress.includes('julius road');
}

function buildCandidate(
  house: string,
  street: string,
  town: string,
  postcode: string,
): AddressCandidate {
  return {
    reference: Buffer.from(JSON.stringify({ house, street, town, postcode })).toString('base64url'),
    full_address: `${house} ${street}, ${town}, ${postcode}`,
    house,
    street,
    town,
    postcode,
  };
}

function generateCandidate(seed: number, input: AddressLookupInput): AddressCandidate {
  const house = input.house ?? String(int(subSeed(seed, 'house'), 1, 200));
  const street = input.street ?? pick(subSeed(seed, 'street'), STREET_NAMES);
  const town = input.town ?? pick(subSeed(seed, 'town'), TOWN_NAMES);
  const postcode = input.postcode ?? pick(subSeed(seed, 'postcode'), POSTCODES);
  return buildCandidate(house, street, town, postcode);
}

/**
 * A fully/near-fully specified address (free-text `full_address`, or all of
 * house+street+town given) is treated as "confirm this one address" — one
 * candidate back. A partial lookup (postcode alone, or postcode plus a
 * couple of hints) is treated as "search" — several plausible candidates
 * sharing that postcode, same shape a real postcode-lookup API returns.
 */
function isSpecificAddress(input: AddressLookupInput): boolean {
  return Boolean(input.full_address) || Boolean(input.house && input.street && input.town);
}

export function lookupAddresses(input: AddressLookupInput): AddressCandidate[] {
  const root = seedFrom(
    input.postcode ?? '',
    input.full_address ?? '',
    input.house ?? '',
    input.street ?? '',
    input.town ?? '',
  );

  if (isDocSample(input)) {
    const sample = buildCandidate('204', 'Julius Road', 'Bristol', 'BS7 8EU');
    if (isSpecificAddress(input)) {
      return [sample];
    }
    const extra = int(root, 0, 2);
    return [
      sample,
      ...Array.from({ length: extra }, (_, i) =>
        generateCandidate(subSeed(root, `candidate:${i}`), input),
      ),
    ];
  }

  if (isSpecificAddress(input)) {
    return [generateCandidate(subSeed(root, 'candidate:0'), input)];
  }

  const total = int(root, 1, 4);
  return Array.from({ length: total }, (_, i) =>
    generateCandidate(subSeed(root, `candidate:${i}`), input),
  );
}

export function decodeReference(reference: string): AddressCandidate | null {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(reference, 'base64url').toString('utf8'));
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof (decoded as Record<string, unknown>).house !== 'string' ||
      typeof (decoded as Record<string, unknown>).street !== 'string' ||
      typeof (decoded as Record<string, unknown>).town !== 'string' ||
      typeof (decoded as Record<string, unknown>).postcode !== 'string'
    ) {
      return null;
    }
    const { house, street, town, postcode } = decoded as Record<string, string>;
    return buildCandidate(house, street, town, postcode);
  } catch {
    return null;
  }
}
