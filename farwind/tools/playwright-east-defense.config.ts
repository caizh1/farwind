import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
import { resolve } from "node:path";
const root=process.env.FARWIND_EVIDENCE_ROOT ?? "docs/village-defense/m3/evidence";
export default defineConfig({...base,testDir:"../tests",workers:1,webServer:undefined,
  use:{...base.use,baseURL:process.env.FARWIND_URL ?? "http://127.0.0.1:5203/"},
  outputDir:resolve(root,"browser-output"),reporter:[["list"],["json",{outputFile:resolve(root,"browser-results.json")}]]});
