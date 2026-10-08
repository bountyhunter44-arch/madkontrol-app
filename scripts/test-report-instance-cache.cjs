'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname, '../public/modules/egenkontrol/rapporter.html'),'utf8');
const start=html.indexOf('    async function findTaskInstanceForEntry('),end=html.indexOf('    function resolveCategory(',start);
const sandbox={};vm.createContext(sandbox);vm.runInContext(html.slice(start,end)+'\nthis.find=findTaskInstanceForEntry;',sandbox);
(async()=>{
 const cache=new Map(),failed=new Set(),one={id:'first',taskId:'cooling',dateKey:'2026-10-05'},two={id:'second',taskId:'cooling',dateKey:'2026-10-06'};
 cache.set(one.id,one);cache.set(two.id,two);cache.set('taskId:cooling:2026-10-05',one);cache.set('taskId:cooling:2026-10-06',two);
 assert.equal(await sandbox.find({taskInstanceId:'first'},cache,failed),one);
 assert.equal(await sandbox.find({task_instance_id:'second'},cache,failed),two);
 assert.equal(await sandbox.find({taskId:'cooling',dateKey:'2026-10-06'},cache,failed),two);
 assert.equal(await sandbox.find({taskID:'cooling',dateKey:'2026-10-05'},cache,failed),one);
 assert.equal(await sandbox.find({taskId:'cooling',dateKey:'2026-10-07'},cache,failed),null);
 assert.equal(await sandbox.find({taskInstanceId:'outside-authorized-scope'},cache,failed),null);
 for(let i=0;i<10000;i++)assert.equal(await sandbox.find({taskInstanceId:'second'},cache,failed),two);
 console.log('Report enrichment preserves legacy ID aliases and date-specific matches; missing/out-of-scope data does not trigger per-entry network requests. 10,000 cached lookups passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
