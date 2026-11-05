import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workModel } from '../docs-due.mjs';

test('workModel reads the report location lines, hybrid wins over remote', () => {
  assert.equal(workModel('| Work mode | Remote, United States (posting) |'), 'remote');
  assert.equal(workModel('- **Location:** Remote, USA\nposting_location: "Remote, USA"'), 'remote');
  assert.equal(workModel('**Location:** Spokane, WA (hybrid)\nLocation: Spokane, WA | Hybrid | Remote'), 'hybrid');
  assert.equal(workModel('Telework: Hybrid; in-office days not stated'), 'hybrid');
  assert.equal(workModel('posting_location: "West Sacramento (Yolo County)"'), 'hybrid');
  assert.equal(workModel('No location anywhere, though the word remote appears in prose.'), 'unknown');
});
