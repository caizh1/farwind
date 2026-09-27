import {defineConfig} from "@playwright/test";
const url=process.env.FARWIND_URL??"http://127.0.0.1:5187",port=new URL(url).port||"5187";
export default defineConfig({testDir:"../tests",testMatch:["day-night.spec.ts","day-night-failure.spec.ts","day-night-journey.spec.ts"],outputDir:"../.parry-local/day-night/browser-results",timeout:180000,workers:1,
  use:{baseURL:url,viewport:{width:1280,height:720},headless:false,trace:"retain-on-failure",launchOptions:{args:["--use-angle=metal","--ignore-gpu-blocklist"]}},
  reporter:[["list"]],webServer:{command:`npm run dev -- --port ${port}`,url,reuseExistingServer:true}});
