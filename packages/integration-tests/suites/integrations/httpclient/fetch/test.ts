import { expect } from '@playwright/test';
import { Event } from '@sentry/types';

import { sentryTest } from '../../../../utils/fixtures';
import { getFirstSentryEnvelopeRequest } from '../../../../utils/helpers';

sentryTest(
  'should assign request and response context from a failed 500 fetch request',
  async ({ getLocalTestPath, page }) => {
    // Skipping this test when running in bundle mode, because `@sentry/integrations` bundle
    // is not injected to the page with the current test setup.
    if (process.env.PW_BUNDLE?.includes('bundle')) {
      sentryTest.skip();
    }

    const url = await getLocalTestPath({ testDir: __dirname });

    await page.route('**/foo', route => {
      return route.fulfill({
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'Internal Server Error',
          },
        }),
        headers: {
          'Content-Type': 'text/html',
        },
      });
    });

    const eventData = await getFirstSentryEnvelopeRequest<Event>(page, url);

    expect(eventData.exception?.values).toHaveLength(1);

    // Not able to get the cookies from the request/response because of Playwright bug
    // https://github.com/microsoft/playwright/issues/11035
    expect(eventData).toMatchObject({
      message: 'HTTP Client Error with status code: 500',
      exception: {
        values: [
          {
            type: 'Error',
            value: 'HTTP Client Error with status code: 500',
            mechanism: {
              type: 'http.client',
              handled: true,
            },
          },
        ],
      },
      request: {
        url: 'http://localhost:7654/foo',
        method: 'GET',
        headers: {
          accept: 'application/json',
          cache: 'no-cache',
          'content-type': 'application/json',
        },
      },
      contexts: {
        response: {
          status_code: 500,
          body_size: 45,
          headers: {
            'content-type': 'text/html',
            'content-length': '45',
          },
        },
      },
    });
  },
);
