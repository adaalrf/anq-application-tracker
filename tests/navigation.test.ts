import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNavigation, navigationUrl } from '../src/client/navigation.js';
test('application selection belongs to Applications while follow-up/activity links restore their view', () => {
  assert.deepEqual(readNavigation('?application=example'), {
    view: 'applications',
    applicationId: 'example',
  });
  assert.deepEqual(readNavigation('?view=followups&application=ignored'), {
    view: 'followups',
    applicationId: null,
  });
  assert.deepEqual(readNavigation('?view=activity'), {
    view: 'activity',
    applicationId: null,
  });
  assert.deepEqual(readNavigation('?view=unknown'), {
    view: 'applications',
    applicationId: null,
  });
});
test('navigation preserves a deployment prefix and unrelated query parameters', () => {
  assert.equal(
    navigationUrl('https://example.test/tracker/?view=activity&theme=paper#content', {
      view: 'applications',
      applicationId: 'a b',
    }),
    '/tracker/?theme=paper&application=a+b#content',
  );
  assert.equal(
    navigationUrl('https://example.test/?application=old', {
      view: 'followups',
      applicationId: null,
    }),
    '/?view=followups',
  );
});
