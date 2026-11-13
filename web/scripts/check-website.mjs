import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++};
const dist='dist';
for(const page of ['index','how-it-works','life-together','pricing','about','journal']){
 const html=readFileSync(`${dist}/${page}.html`,'utf8');
 for(const [,url] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  if(/^(https?:|mailto:|#)/.test(url))continue;
  check(existsSync(join(dist,url.replace(/^\//,'').split('?')[0])),`${page}: missing ${url}`);
 }
}
const storyIds=readdirSync(`${dist}/s`);
check(storyIds.length===12,'All 12 story routes remain');
for(const id of storyIds)check(existsSync(`${dist}/s/${id}/index.html`),`Story ${id}`);
const chunks=readdirSync(`${dist}/assets`).filter(x=>x.endsWith('.js')).map(x=>readFileSync(`${dist}/assets/${x}`,'utf8')).join('\n');
for(const [,url] of chunks.matchAll(/["'](\/(?:t\/)?[^"'<>]+\.(?:jpg|jpeg|webp|png|svg))["']/g)){
 check(existsSync(join(dist,url.slice(1))),`Missing image ${url}`);
}
check(chunks.includes('https://app.ourcommune.io/signup'),'Original signup destination');
check(!chunks.includes('There is no free plan, and no catch.'),'No contradictory pricing claim');
check(!chunks.includes('Start your 7-day free trial'),'No promised live trial CTA');
check(!existsSync(`${dist}/business-mock.html`),'Study pages excluded');
console.log(`${checks} website artifact checks passed`);
