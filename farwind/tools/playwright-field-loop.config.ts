import {defineConfig} from "@playwright/test";
import base from "./playwright-first-map.config";
export default defineConfig({...base,testMatch:"field-loop.spec.ts",outputDir:"../.first-map-local/field-loop-results"});
