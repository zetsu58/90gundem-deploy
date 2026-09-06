// +90Gündem V22 smoke tests — no external API calls required.
// Run: node tests/v22-newsroom-smoke.mjs
import assert from 'node:assert/strict';

const norm=s=>String(s||'').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü ]/gi,' ').replace(/\s+/g,' ').trim();
const words=s=>new Set(norm(s).split(' ').filter(x=>x.length>3));
function similarity(a,b){const A=words(a),B=words(b);let n=0;for(const x of A)if(B.has(x))n++;return A.size&&B.size?n/Math.min(A.size,B.size):0}
function fuse(evidence,ai,n,official,viral){let final=Math.round(evidence*.65+ai*.35);if(n<2&&!official)final=Math.min(final,69);if(n<2&&official)final=Math.min(90,Math.max(final,75));return {verification:final,decision:final<55?'reject':(final<75||viral<45?'review':'publish')}}
function imageGate(score,usable=true){return score<35?'drop_image':score<55?'review_or_replace':usable?'use':'review_or_replace'}

const tests=[];const test=(name,fn)=>tests.push([name,fn]);
test('same story similarity is detected',()=>assert.ok(similarity('Galatasaray yeni transfer için görüşmelere başladı','Galatasaray transfer görüşmelerine başladı')>=.5));
test('unrelated stories are not matched',()=>assert.ok(similarity('Galatasaray transfer görüşmeleri başladı','Merkez Bankası faiz kararını açıkladı')<.4));
test('single non-official source cannot auto publish',()=>{const r=fuse(95,100,1,false,90);assert.equal(r.verification,69);assert.equal(r.decision,'review')});
test('official primary source may pass controlled gate',()=>{const r=fuse(90,90,1,true,80);assert.ok(r.verification>=75);assert.equal(r.decision,'publish')});
test('two-source strong evidence can publish',()=>assert.equal(fuse(90,90,2,false,80).decision,'publish'));
test('weak verification rejects',()=>assert.equal(fuse(35,40,1,false,80).decision,'reject'));
test('low viral score forces review',()=>assert.equal(fuse(95,95,2,false,20).decision,'review'));
test('bad image is dropped',()=>assert.equal(imageGate(20),'drop_image'));
test('uncertain image is reviewed',()=>assert.equal(imageGate(50),'review_or_replace'));
test('relevant usable image passes',()=>assert.equal(imageGate(80,true),'use'));

let failed=0;for(const [name,fn] of tests){try{fn();console.log('✅',name)}catch(e){failed++;console.error('❌',name,'\n ',e.message)}}
console.log(`\nV22 smoke: ${tests.length-failed}/${tests.length} passed`);if(failed)process.exit(1);
