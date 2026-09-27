import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
export default defineConfig({testDir:'../tests',testMatch:'parry-feedback-v3.production.ts',timeout:45000,workers:1,retries:0,outputDir:'../.parry-local/v3/production-results',reporter:[['list'],['json',{outputFile:resolve('.parry-local/v3/production-browser.json')}]],use:{baseURL:'http://127.0.0.1:5214',viewport:{width:1280,height:720},screenshot:'only-on-failure',launchOptions:{args:['--enable-gpu','--enable-webgl','--use-angle=metal']}}});
