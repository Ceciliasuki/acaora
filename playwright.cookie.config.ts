import {defineConfig} from '@playwright/test';
import compatibility from './playwright.compat.config';

const baseURL=process.env.ACAORA_COOKIE_AUDIT_URL;
if(!baseURL||!/^https:\/\/127\.0\.0\.1:\d+$/.test(baseURL))throw new Error('Run through scripts/run-auth-cookie-audit.mjs with an isolated HTTPS loopback server.');
export default defineConfig({
 ...compatibility,
 testMatch:'browser-auth.cookie.ts',
 webServer:undefined,
 outputDir:'test-results/cookies',
 reporter:[['list'],['html',{outputFolder:'test-results/cookie-report',open:'never'}]],
 projects:compatibility.projects!.map(project=>({...project,use:{...project.use,baseURL,ignoreHTTPSErrors:true}})),
});
