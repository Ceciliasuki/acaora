import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
import base from './playwright.config';

export default defineConfig({
 ...base,
 testMatch:'browser-auth-compatibility.spec.ts',
 testIgnore:[],
 outputDir:'test-results/compatibility',
 reporter:[['list'],['html',{outputFolder:'test-results/compatibility-report',open:'never'}]],
 workers:2,
 retries:0,
 projects:[
  {name:'chromium',use:{...base.use,browserName:'chromium',launchOptions:{}}},
  ...(existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')?[{name:'edge',use:{...base.use,browserName:'chromium' as const,channel:'msedge',launchOptions:{}}}]:[]),
  {name:'firefox',use:{...base.use,browserName:'firefox',launchOptions:{}}},
  {name:'webkit',use:{...base.use,browserName:'webkit',launchOptions:{}}},
 ],
});
