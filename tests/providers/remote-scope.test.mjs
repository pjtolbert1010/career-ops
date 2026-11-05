// tests/providers/remote-scope.test.mjs — remote-board scope, salary and
// feed-URL helpers added for the Career Reef remote-board move (2026-11-05):
// providers/_remote-scope.mjs, remoteok/remotive salary parsing, WWR category
// feeds, Remote.co robots.txt + listing parsing, and scan.mjs's
// remote_scope_filter. Deterministic, no network.
import { pass, fail, ROOT } from '../helpers.mjs';
import { join } from 'path';
import { pathToFileURL } from 'url';

console.log('\nProvider — remote scope / remote boards');

const load = (p) => import(pathToFileURL(join(ROOT, p)).href);

function check(cond, label) {
  if (cond) pass(label);
  else fail(label);
}

try {
  const { classifyRemoteScope: c } = await load('providers/_remote-scope.mjs');
  const cases = [
    [{ location: 'Worldwide' }, 'worldwide'],
    [{ location: 'USA Only' }, 'us'],
    [{ location: 'North America' }, 'us'],
    [{ location: 'Texas' }, 'us'],
    [{ location: 'Remote' }, 'unknown'],
    [{ location: '' }, 'unknown'],
    [{ location: 'Europe' }, 'non-us'],
    [{ location: 'LATAM' }, 'non-us'],
    [{ location: 'Germany, Denmark, United Kingdom' }, 'non-us'],
    [{ location: 'CET +/- 2 hours' }, 'timezone-non-us'],
    [{ location: 'Anywhere', description: 'Open to candidates excluding the US.' }, 'excludes-us'],
    [{ location: 'United States', description: 'This role is not open to California residents.' }, 'excludes-ca'],
    [{ location: 'Worldwide', description: 'We are unable to hire in California at this time.' }, 'excludes-ca'],
    [{ location: 'Worldwide', title: 'Billing Support Analyst - Philippines' }, 'non-us'],
    // A country named in body text is not a restriction.
    [{ location: 'Worldwide', description: 'We have teammates in Brazil and Germany.' }, 'worldwide'],
  ];
  for (const [input, want] of cases) {
    const got = c(input);
    check(got === want, `classifyRemoteScope(${JSON.stringify(input)}) → ${want}${got === want ? '' : ` (got ${got})`}`);
  }

  const { remoteOkSalary } = await load('providers/remoteok.mjs');
  check(remoteOkSalary(0, 0) === undefined, 'remoteOkSalary: 0/0 → none');
  check(remoteOkSalary(4000, 4000) === undefined, 'remoteOkSalary: monthly-looking 4000 → none');
  const ro = remoteOkSalary(90000, 120000);
  check(ro && ro.min === 90000 && ro.max === 120000 && ro.currency === 'USD', 'remoteOkSalary: 90000-120000 USD');

  const { remotiveSalary, remotiveFeedUrl } = await load('providers/remotive.mjs');
  const rv = remotiveSalary('$170k - $200k');
  check(rv && rv.min === 170000 && rv.max === 200000, 'remotiveSalary: "$170k - $200k"');
  check(remotiveSalary('$3.5k–$5k/month') === undefined, 'remotiveSalary: monthly → none');
  check(remotiveSalary('$1000 per task') === undefined, 'remotiveSalary: per task → none');
  check(remotiveFeedUrl({}) === 'https://remotive.com/api/remote-jobs', 'remotiveFeedUrl: bare');
  check(remotiveFeedUrl({ category: 'business' }).endsWith('?category=business'), 'remotiveFeedUrl: category');

  const { wwrFeedUrls } = await load('providers/weworkremotely.mjs');
  check(wwrFeedUrls({})[0] === 'https://weworkremotely.com/remote-jobs.rss', 'wwrFeedUrls: default global feed');
  const cat = wwrFeedUrls({ categories: ['remote-product-jobs', '../evil', 'remote-product-jobs'] });
  check(cat.length === 1 && cat[0] === 'https://weworkremotely.com/categories/remote-product-jobs.rss', 'wwrFeedUrls: slug-safe, deduped');

  const { robotsAllows, parseRemoteCoListing } = await load('providers/remoteco.mjs');
  check(robotsAllows('User-agent: *\nDisallow: /remote-jobs/', '/remote-jobs/operations/') === false, 'robotsAllows: disallowed path');
  check(robotsAllows('User-agent: *\nDisallow: /api\n', '/remote-jobs/operations/') === true, 'robotsAllows: unrelated disallow');
  check(robotsAllows('User-agent: *\nDisallow: /remote-jobs/\nAllow: /remote-jobs/operations/', '/remote-jobs/operations/') === true, 'robotsAllows: longer allow wins');
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'JobPosting', title: 'Operations Manager', url: 'https://remote.co/job/ops-manager/',
    hiringOrganization: { name: 'Acme' }, datePosted: '2026-11-01',
    applicantLocationRequirements: [{ name: 'USA' }],
    baseSalary: { currency: 'USD', value: { minValue: 95000, maxValue: 120000, unitText: 'YEAR' } },
  })}</script>`;
  const rc = parseRemoteCoListing(html);
  check(rc.length === 1 && rc[0].company === 'Acme' && rc[0].remoteScope === 'us' && rc[0].salary?.min === 95000, 'parseRemoteCoListing: JSON-LD JobPosting');
  check(parseRemoteCoListing('<a href="https://evil.example/job/x/">X</a>').length === 0, 'parseRemoteCoListing: off-host link ignored');

  const { buildRemoteScopeFilter } = await load('scan.mjs');
  const off = buildRemoteScopeFilter(undefined);
  check(off('non-us') === null, 'remote_scope_filter absent → null (location_filter decides)');
  const f = buildRemoteScopeFilter({ allow: ['us', 'worldwide', 'unknown'] });
  check(f('us') === true && f('worldwide') === true && f('unknown') === true, 'remote_scope_filter: US-open scopes kept');
  check(f('non-us') === false && f('excludes-us') === false && f('excludes-ca') === false && f('timezone-non-us') === false, 'remote_scope_filter: non-US scopes dropped');
  check(f(undefined) === null, 'remote_scope_filter: job without scope → null');
} catch (e) {
  fail(`remote-scope tests threw: ${e?.stack || e}`);
}
