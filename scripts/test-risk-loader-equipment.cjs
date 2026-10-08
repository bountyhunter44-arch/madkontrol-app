const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname, '../public/modules/egenkontrol/riskAnalysisService.js'),'utf8');
const start=source.indexOf('export async function loadRiskAnalysisFromFirestore('),end=source.indexOf('\nexport async function getExistingRiskAnalysis(',start);
const loader=source.slice(start,end).replace('export async function','async function');
(async()=>{
 const configuration={effectiveDate:'2026-10-07',units:[{id:'fridge1',type:'fridge',name:'Køleskab 1'},{id:'fridge2',type:'fridge',name:'Køleskab 2'}],retiredEquipmentIds:['fridge3','fridge4']};
 const current={companyId:'company',locationId:'main',version:'2.0.0',source:'edited_onboarding',equipmentConfiguration:configuration,controlPoints:[{routineKey:'koeleskab_temperatur',equipmentId:'fridge1'},{routineKey:'koeleskab_temperatur',equipmentId:'fridge2'}]};
 const stale={version:'99.0.0',createdAt:{toDate:()=>new Date()},controlPoints:[1,2,3,4].map(i=>({routineKey:'koeleskab_temperatur',equipmentId:'fridge'+i}))};
 const context={db:{},console:{log(){},warn(){},error(){}},doc:()=>({}),getDoc:async()=>({exists:()=>true,data:()=>current}),collection:()=>({}),query:()=>({}),where:()=>({}),getDocs:async()=>({docs:[{id:'old_snapshot',data:()=>stale}]}),compareSemver:(a,b)=>parseInt(a)-parseInt(b),shouldRegenerateCanonicalRiskAnalysis:()=>false};vm.createContext(context);vm.runInContext(loader,context);
 const result=await context.loadRiskAnalysisFromFirestore('company','main');assert.equal(result.equipmentConfiguration,configuration);assert.equal(result.controlPoints.length,2);assert.equal(result.source,'risk_analysis_current');
 const resolver=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(require('node:path').join(__dirname, '../public/modules/egenkontrol/routineCardsResolver.js'),'utf8')).toString('base64'));
 const templates=[1,2,3,4].map(i=>({id:'temp'+i,active:true,routineType:'koeleskab_temperatur',equipmentId:'fridge'+i,equipmentType:'fridge',equipmentName:'Køleskab '+i}));
 const log=console.log;console.log=()=>{};let cards;try{cards=resolver.resolveRoutineCardsForLocation({companyId:'company',locationId:'main',selectedDate:'2026-10-07',riskAnalysis:result,taskTemplates:templates});}finally{console.log=log;}assert.equal(cards.length,2);assert.deepEqual(cards.map(x=>x.equipmentId).sort(),['fridge1','fridge2']);
 assert.equal(stale.controlPoints.length,4,'Historical snapshots must stay intact');console.log('Risk loader → routine resolver: current equipment preserved, older four-fridge snapshot excluded, two current fridge routines passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
