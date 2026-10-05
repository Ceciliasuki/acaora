import {expect, test} from '@playwright/test';
import {installApiMocks, makeTextPdf} from './helpers';

test('an import finishing its device file write after logout cannot repopulate the guest library', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true});
  await page.addInitScript(() => {
    localStorage.setItem('acaora:paper-panels', JSON.stringify({library: true, notes: true}));
    const controlled = window as typeof window & {originalBlocked?: boolean; releaseOriginal?: () => void};
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(...args) {
      const result = transaction.apply(this, args);
      if (args[0] === 'originals' && args[1] === 'readwrite') {
        Object.defineProperty(result, 'oncomplete', {set(callback) {
          result.addEventListener('complete', async event => {
            controlled.originalBlocked = true;
            await new Promise<void>(resolve => {controlled.releaseOriginal = resolve;});
            callback?.call(result, event);
          });
        }});
      }
      return result;
    };
  });
  await page.goto('/papers');
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'private-import.pdf', mimeType: 'application/pdf', buffer: makeTextPdf()});
  await expect.poll(() => page.evaluate(() => (window as typeof window & {originalBlocked?: boolean}).originalBlocked)).toBe(true);
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(page.locator('.library-privacy strong')).toHaveText('设备端记忆');
  await page.evaluate(() => (window as typeof window & {releaseOriginal?: () => void}).releaseOriginal?.());
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await expect(page.getByText('private-import.pdf', {exact: true})).toHaveCount(0);
  await expect(page.locator('.plab-index-open')).toHaveCount(0);
});
