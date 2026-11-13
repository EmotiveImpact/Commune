/** Source-level regression checks for the recovered review. Browser journeys remain a separate gate. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const dir = await mkdtemp(join(tmpdir(), 'commune-green-'));
const output = join(dir, 'components.cjs');
await build({ stdin: {contents: `export { CommuneWalkthrough, WALKTHROUGH_EXAMPLES } from './src/green/CommuneWalkthrough'; export { JournalLayout } from './src/green/JournalLayout'; export { default as GreenPages } from './src/green/GreenPages'; export { default as Home } from './src/green/TogetherMock';`, resolveDir: process.cwd(), loader:'tsx'}, outfile:output, bundle:true, platform:'node', format:'cjs', external:['react','react/jsx-runtime'], loader:{'.css':'empty'}, alias:{'@commune/core/stories':resolve('../packages/core/src/stories/index.ts')}, logLevel:'silent'});
// A transient bundle is loaded from the package so React resolves to this checkout.
const Module = require('node:module');
const compiled = new Module(output); compiled.paths = Module._nodeModulePaths(process.cwd()); compiled._compile(await readFile(output,'utf8'), output);
const {CommuneWalkthrough, WALKTHROUGH_EXAMPLES, JournalLayout, GreenPages, Home}=compiled.exports;
const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server');
await rm(dir,{recursive:true});
const render = (Component, props={})=>renderToStaticMarkup(React.createElement(Component,props));
const guides=JSON.parse(await readFile('src/green/guides.json','utf8'));

test('All four fixed walkthrough examples total £60 and retain four participants',()=>{
 assert.deepEqual(Object.keys(WALKTHROUGH_EXAMPLES),['Equal','Exact','Percentage','Shares']);
 for(const example of Object.values(WALKTHROUGH_EXAMPLES)){assert.equal(example.shares.length,4);assert.equal(example.shares.reduce((a,b)=>a+b,0),60);assert.ok(example.shares.every(n=>n>0));}
});
test('Walkthrough starts as an explicit illustration, not an account or payment flow',()=>{
 const html=render(CommuneWalkthrough); for(const text of ['Add the shared cost','Add example expense','Nothing is saved and no money moves.','£60.00']) assert.ok(html.includes(text),text);
});
test('Company pages show proposed prices and no promise of an active trial or QR joining',()=>{
 const price=render(GreenPages,{page:'pricing'});for(const text of ['Proposed pricing','Proposed group price','Who would pay for a plan?','Planned'])assert.ok(price.includes(text),text);
 assert.ok(!price.includes('There is no free plan')); assert.ok(!price.includes('Start your free trial'));
 const how=render(GreenPages,{page:'how'}); assert.ok(how.includes('QR and sticker joining are planned'));assert.ok(how.includes('Illustrated Commune walkthrough'));
});
test('Homepage has working guide destinations without the prototype switcher',()=>{
 const html=render(Home);assert.ok(!html.includes('Journal options'));assert.ok(!html.includes('journal-g.html'));
 for(const id of ['home','work','trips'])assert.ok(html.includes(`/journal.html?guide=${id}`));
 assert.ok(html.includes('not a current app screenshot'));
});
test('All guides retain full worked examples',()=>{
 assert.deepEqual(guides.map(g=>g.id),['home','work','trips']);for(const guide of guides){assert.equal(guide.sections.length,4);assert.ok(guide.sections.some(s=>s.example));}
});
test('Editorial journal retains featured story, guide routes and story rail',()=>{
 const stories=[{id:'roast',title:'Sunday dinner',commune:'Maple House',cat:'Home',beats:[{h:'Together',img:'a'},{h:'Cooking together',img:'b'}]}];
 const html=render(JournalLayout,{guides,stories,asset:x=>`/${x}.jpg`,StoryViewer:()=>null,StoryRail:()=>React.createElement('div',null,'Story rail')});
 for(const text of ['Sunday dinner','Filter practical guides','journal-stories','Story rail','/journal.html?guide=home'])assert.ok(html.includes(text),text);
});
