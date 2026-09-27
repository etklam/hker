import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const enabled=process.env.DIRECTORY_E2E_FIXTURE==='1';
test.describe('directory viewport acceptance',()=>{
 test.skip(!enabled,'Requires deterministic isolated fixture');
 for(const width of [390,768,1440]) {
  test(`public and admin at ${width}px`,async({browser})=>{
   await mkdir('.impeccable/review/release',{recursive:true});
   const context=await browser.newContext({viewport:{width,height:900},storageState:process.env.DIRECTORY_E2E_STATE??'.next/directory-e2e-state.json'});
   const page=await context.newPage();
   await page.goto('/');await expect(page.getByRole('heading',{name:/搵到香港/})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`.impeccable/review/release/public-${width}.png`,fullPage:true});
   await page.goto('/search');await expect(page.locator('main').getByRole('button',{name:'搜尋',exact:true})).toBeVisible();
   await page.screenshot({path:`.impeccable/review/release/search-${width}.png`,fullPage:true});
   await page.goto('/listing/repair-shop');await expect(page.getByRole('heading',{name:'測試維修店',exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`.impeccable/review/release/detail-${width}.png`,fullPage:true});
   for (const [state, url, heading] of [
     ['empty', '/search?q=missing-visual-fixture', '暫時未有符合的收錄'],
     ['invalid', '/search?priceMin=-1', '搜尋條件無效'],
     ['long', '/listing/long-content', '長內容測試資源'],
   ]) {
     await page.goto(url); await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
     expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
     await page.screenshot({path:`.impeccable/review/release/${state}-${width}.png`,fullPage:true});
   }
   await page.goto('/admin/listings');await expect(page.getByRole('button',{name:'新增收錄',exact:true})).toBeVisible();
   await expect(page.getByRole('row').filter({hasText:'測試維修店'})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`.impeccable/review/release/admin-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'新增收錄',exact:true}).click();
   await page.getByRole('dialog').getByLabel('名稱',{exact:true}).fill('香港本地服務與社群收錄長名稱測試'.repeat(5));
   await page.screenshot({path:`.impeccable/review/release/editor-${width}.png`});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await context.close();
  });
 }
});
