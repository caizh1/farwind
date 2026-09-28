import {defineConfig} from '@playwright/test';
import base from './playwright-first-map.config';
export default defineConfig({...base,testMatch:'wilderness-enemies.spec.ts',outputDir:'../.first-map-local/creature-results'});
