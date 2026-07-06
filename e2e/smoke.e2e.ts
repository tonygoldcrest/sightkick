import path from 'path';
import { test, expect, Page } from '@playwright/test';
import { launchApp, Harness } from './support';
import { toAssetUrl } from '../src/main/util';

let harness: Harness;
let page: Page;

// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  if (page && testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach('screenshot', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  }

  await harness?.app.close();
});

test.describe('first run', () => {
  test('guides the user to select a library folder', async () => {
    harness = await launchApp({ seedLibrary: false });
    page = await harness.app.firstWindow();

    await expect(page.getByText('Pick a folder for your songs.')).toBeVisible();
    await expect(page.getByText('Select folder')).toBeVisible();
  });
});

test.describe('seeded library', () => {
  test('scans the folder, lists the song, and renders real sheet music', async () => {
    harness = await launchApp({ seedLibrary: true });
    page = await harness.app.firstWindow();

    await expect(page.getByText('No songs in this folder.')).toBeVisible();

    await page.getByTestId('settings-trigger').click();
    await page.getByTestId('rescan-folder').click();

    const song = page.getByText('Master of Puppets').first();

    await expect(song).toBeVisible({ timeout: 30_000 });

    const albumUrl = toAssetUrl(
      path.join(harness.libraryDir, 'test-song', 'album.png'),
    );
    const fetched = await page.evaluate(async (url) => {
      const response = await fetch(url);

      return { ok: response.ok, size: (await response.blob()).size };
    }, albumUrl);

    expect(fetched.ok).toBe(true);
    expect(fetched.size).toBeGreaterThan(0);

    const cover = page.locator('img[src^="sightkick://"]').first();

    await expect(cover).toBeVisible();
    await expect
      .poll(
        async () => cover.evaluate((el: HTMLImageElement) => el.naturalWidth),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    await song.click();

    await page.getByRole('button', { name: 'perform' }).click();

    const sheet = page.locator('svg').first();

    await expect(sheet).toBeVisible();
    await expect
      .poll(async () => page.locator('svg path').count(), { timeout: 30_000 })
      .toBeGreaterThan(0);
  });
});
