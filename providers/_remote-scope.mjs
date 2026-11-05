// @ts-check
// Remote-scope classifier shared by the remote-board providers (RemoteOK,
// Remotive, We Work Remotely, Remote.co). Answers one question per posting:
// can a remote worker living in the United States (California) take this job?
//
// Inputs are the board's own location / region / tag strings, plus the
// description for a narrow set of explicit exclusion phrases only. A
// description routinely names many countries (offices, customers, "we have
// teammates in Brazil"), so a country name in body text is never read as a
// restriction; only wording that says who may NOT apply is.
//
// Scopes:
//   us              - open to US residents (US / USA / North America / Americas / a US state / US time zone)
//   worldwide       - worldwide / anywhere / global, with no US exclusion
//   unknown         - no usable signal (empty, or just "Remote")
//   excludes-us     - worldwide-style posting that explicitly excludes the US
//   excludes-ca     - US posting that explicitly cannot hire in California
//   timezone-non-us - limited to non-US time zones (CET, GMT+1..+12, IST, ...)
//   non-us          - limited to named non-US regions or countries
//
// scan.mjs reads job.remoteScope through `remote_scope_filter` in portals.yml.
// Files prefixed with _ are never loaded as providers (see _registry.mjs).

const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware',
  'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky',
  'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
  'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico',
  'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
  'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
  'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
];

const US_RE = new RegExp(
  [
    '\\bu\\.?s\\.?a?\\b(?!\\$)', // US, U.S., USA
    '\\bunited states\\b',
    '\\bnorth america\\b',
    '\\bamericas\\b',
    '\\b(?:est|edt|cst|cdt|mst|mdt|pst|pdt|et|ct|mt|pt)\\b',
    '\\b(?:eastern|central|mountain|pacific) (?:standard )?time\\b',
    '\\bus time ?zones?\\b',
    `\\b(?:${US_STATES.join('|')})\\b`,
  ].join('|'),
  'i',
);

const WORLDWIDE_RE = /\b(?:worldwide|world ?wide|anywhere|global(?:ly)?|any ?where in the world|all countries|international)\b/i;

// Explicit "cannot hire here" wording. Only these phrases are read from the
// description, because they state an exclusion rather than mention a place.
const EXCLUDES_US_RE = /\b(?:excluding|except(?: for)?|not (?:open|available) (?:to|in)|cannot (?:hire|employ|accept)[^.]{0,30}(?:in|from)|no candidates from|outside (?:of )?the)\s+(?:the\s+)?(?:u\.?s\.?a?|united states)\b|\bnon-?u\.?s\.?(?: based)? (?:only|candidates only)\b|\b(?:u\.?s\.?a?|united states)[- ]based candidates (?:are )?not (?:eligible|considered)\b/i;

const EXCLUDES_CA_RE = /\b(?:excluding|except(?: for)?|not (?:open|available) (?:to|in)|cannot (?:hire|employ|accept)[^.]{0,40}(?:in|from)|unable to (?:hire|employ)[^.]{0,40}(?:in|from)|(?:does|do|will) not (?:hire|employ|consider)[^.]{0,40}(?:in|from))\s+(?:the state of\s+)?(?:california|ca)\b|\bcalifornia (?:residents|candidates) (?:are )?(?:not|ineligible)\b|\bnot (?:be )?considered[^.]{0,30}california\b/i;

const NON_US_TZ_RE = /\b(?:cet|cest|eet|eest|wet|bst|ist|aest|aedt|jst|sgt|hkt|cat|eat|wat|brt|art|gmt ?\+ ?(?:[1-9]|1[0-4])|utc ?\+ ?(?:[1-9]|1[0-4])|european time ?zones?|emea time ?zones?|apac time ?zones?)\b/i;

const NON_US_REGION_RE = /\b(?:europe|european union|\beu\b|emea|uk|united kingdom|england|ireland|germany|france|spain|portugal|netherlands|poland|italy|sweden|norway|denmark|finland|switzerland|austria|belgium|czech|romania|ukraine|latam|latin america|south america|brazil|argentina|mexico|colombia|chile|peru|apac|asia|india|philippines|pakistan|indonesia|vietnam|singapore|japan|china|australia|new zealand|africa|nigeria|kenya|south africa|egypt|middle east|uae|israel|turkey|canada(?! and| &| or| \/)|ontario|toronto|vancouver)\b/i;

/**
 * Classify a posting's remote scope.
 *
 * `title` is read only for a non-US region suffix ("Billing Analyst -
 * Philippines", "Operations Manager - LATAM"), and only when the location
 * itself does not name the US.
 *
 * @param {{location?: string, tags?: string[]|string, description?: string, title?: string}} input
 * @returns {'us'|'worldwide'|'unknown'|'excludes-us'|'excludes-ca'|'timezone-non-us'|'non-us'}
 */
export function classifyRemoteScope({ location = '', tags = [], description = '', title = '' } = {}) {
  const tagText = Array.isArray(tags) ? tags.join(' ') : String(tags || '');
  const where = `${location || ''} ${tagText}`.replace(/\s+/g, ' ').trim();
  const body = String(description || '');

  if (EXCLUDES_US_RE.test(where) || EXCLUDES_US_RE.test(body)) return 'excludes-us';

  const namesUs = US_RE.test(where);
  if (namesUs) {
    if (EXCLUDES_CA_RE.test(where) || EXCLUDES_CA_RE.test(body)) return 'excludes-ca';
    return 'us';
  }
  if (EXCLUDES_CA_RE.test(where) || EXCLUDES_CA_RE.test(body)) return 'excludes-ca';

  if (NON_US_TZ_RE.test(where)) return 'timezone-non-us';
  if (NON_US_REGION_RE.test(String(title || '')) || NON_US_TZ_RE.test(String(title || ''))) return 'non-us';
  if (WORLDWIDE_RE.test(where)) return 'worldwide';
  if (NON_US_REGION_RE.test(where)) return 'non-us';
  return 'unknown';
}

/** Scopes a US / California resident can take. */
export const US_OPEN_SCOPES = Object.freeze(['us', 'worldwide', 'unknown']);
