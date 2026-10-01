import {defineConfig} from '@playwright/test';
import runes from './playwright-runes.config';
export default defineConfig({...runes,testMatch:['rune-elements.spec.ts','runes.spec.ts'],outputDir:'/tmp/farwind-rune-elements-browser'});
