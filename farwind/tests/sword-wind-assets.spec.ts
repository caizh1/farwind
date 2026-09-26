import {test,expect} from '@playwright/test';
test('独立素材固定预览：六图集加载、逐帧和正常速度播放',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/docs/sword-wind/assets/preview.html');await expect(page.locator('#status')).toContainText('已装载 6 个图集');
 await expect(page.locator('#approval')).toContainText('上撩动作与地面切痕已通过用户视觉验收');
 await page.getByRole('button',{name:'暂停播放',exact:true}).click();
 for(const at of [0,35,70,110,135,210,270,340,400,444,470,600]){await page.locator('#scrub').fill(String(at));await expect(page.locator('#status')).toContainText(`时间 ${at} 毫秒`);}
 const prefix=process.env.FARWIND_WIND_RUN==='acceptance'?'acceptance':'rise';
 await page.locator('#scrub').fill('160');await page.screenshot({path:`docs/sword-wind/evidence/${prefix}-preview-normal-browser.png`});
 await page.locator('#zoom').scrollIntoViewIfNeeded();await page.screenshot({path:`docs/sword-wind/evidence/${prefix}-preview-enlarged-browser.png`});
 await page.locator('#play').scrollIntoViewIfNeeded();await page.getByRole('button',{name:'从头播放',exact:true}).click();await page.getByRole('button',{name:'继续播放',exact:true}).click();await page.waitForTimeout(3000);expect(errors).toEqual([]);
 const video=page.video();await page.close();await video!.saveAs(`docs/sword-wind/evidence/${prefix}-asset-preview.webm`);
});
