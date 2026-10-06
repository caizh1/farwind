import {defineConfig} from '@playwright/test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export default defineConfig({testDir:'../tests',testMatch:'east-boss-tier-five.spec.ts',workers:1,retries:0,timeout:180000,use:{baseURL:process.env.FARWIND_TEST_BASE_URL??'http://127.0.0.1:5374',headless:true,viewport:{width:1440,height:1000},video:{mode:'on',size:{width:1440,height:1000}},launchOptions:{args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}},outputDir:join(tmpdir(),'farwind-east-boss-tier-five',String(process.pid)),reporter:[['list']]});
