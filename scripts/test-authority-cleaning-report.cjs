const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const page = fs.readFileSync(require('node:path').join(__dirname, '../public/modules/egenkontrol/rapporter.html'), 'utf8');
const block = page.slice(page.indexOf('        // Operational instance status'), page.indexOf('        if (authorityReceivingMetaEl)'));
function extract(name) {
  const start = page.indexOf('    function ' + name + '(');
  const end = page.indexOf('\n    function ', start + 1);
  return page.slice(start, end);
}
(async () => {
  const resolver = await import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(require('node:path').join(__dirname, '../public/modules/egenkontrol/routineCardsResolver.js'))).toString('base64'));
  const plans = [1,2,3,4].flatMap(i => ['koeleskab_rengoering', 'cleaning_fridge_control'].map((routineType,j) => ({
    id: 'plan' + i + j, companyId:'company', locationId:'main', dateKey:'2026-10-07', routineType,
    title:'Køleskab rengøring · Køleskab ' + i, equipmentId:'fridge' + i, equipmentName:'Køleskab ' + i,
    equipmentType:'fridge', status:j ? 'active' : 'pending'
  })));
  plans.push({...plans[0],id:'old',dateKey:'2026-10-06'});
  const entries = ['08:00','13:00'].map((time,i) => ({...plans[0],id:'entry'+i,taskInstanceId:'plan10',status:'completed',createdAt:'2026-10-07T'+time+':00+02:00',performedAt:'2026-10-07T'+time+':00+02:00',comment:'Rengjort',performedByName:'Tester'}));
  const context = {
    ...resolver, console:{log(){}}, SETTINGS:{companyId:'company',locationId:'main'},reportId:null,
    activeHaccpSnapshot:{equipmentConfiguration:{effectiveDate:'2026-10-07',units:[1,2].map(i=>({id:'fridge'+i,name:'Køleskab '+i,type:'fridge'})),retiredEquipmentIds:['fridge3','fridge4']}},
    periodFilter:{value:'today'},fromDateFilter:{value:''},toDateFilter:{value:''}, cleaningEntries:entries,cleaningPlanItems:plans,
    authorityCleaningMetaEl:{},authorityCleaningListEl:{}, document:{getElementById(){return {value:'all'};}},
    getEntryFilterDate:(e)=>e.dateKey,toFilterDateKey:v=>v,getTodayKey:()=> '2026-10-07',getDateKeyForDaysAgo:()=> '2026-07-10',
    matchesReportCategory:()=>true,reportCategoryValue:()=> 'all',getEntryEquipmentKey:e=>e.equipmentId,
    resolveEntryDateKey:e=>e.dateKey,getEntryHandledAt:e=>e.performedAt || null,getTaskDisplayTitle:e=>e.title,
    getEntryAreaLabel:e=>e.equipmentName,escapeHtml:s=>String(s ?? '').replaceAll('<','&lt;'),
    isCompletedReportEntry:e=>e.status==='completed',isAuthorityDeviationEntry:e=>e.status==='deviation',
    buildPill:(k,v)=>k+':'+v+'|',formatDateTime:v=>v || '—',
    getEntryProcessDetails:e=>'<strong>Rutine:</strong> '+e.title+'<br><strong>Område/udstyr:</strong> '+e.equipmentName+'<br><strong>Status:</strong> '+e.status+'<br><strong>Udført af:</strong> '+e.performedByName+'<br>'+e.comment,
    renderEntryMediaAssets:()=>'',getAlertCorrectiveText:()=> 'Ikke registreret endnu'
  };
  vm.createContext(context);
  vm.runInContext(extract('entryMatchesPeriod') + extract('renderAuthorityList') + 'function run(){'+block+'}',context);
  context.run();
  let html = context.authorityCleaningListEl.innerHTML;
  assert.equal((html.match(/<li>/g)||[]).length,3,'Two real executions and one pending unit');
  assert.ok(html.includes('08:00') && html.includes('13:00') && html.includes('Tester') && html.includes('Rengjort'));
  assert.ok(!html.includes('fridge3') && !html.includes('Køleskab 3') && !html.includes('Køleskab 4') && !html.includes('active'));
  assert.equal((html.match(/Afventer/g)||[]).length,1);
  assert.ok(!html.includes('Køleskab 1 · Køleskab 1'));
  assert.ok(context.authorityCleaningMetaEl.innerHTML.includes('Planpunkter:2'));
  context.fromDateFilter.value='2026-10-06';context.toDateFilter.value='2026-10-06';context.cleaningEntries=[];
  context.run();html=context.authorityCleaningListEl.innerHTML;
  assert.equal((html.match(/<li>/g)||[]).length,1,'Historical date has only its own planned control');
  assert.ok(html.includes('2026-10-06') && !html.includes('2026-10-07') && !html.includes('Udført:'));
  context.cleaningPlanItems=[];context.cleaningEntries=entries;context.fromDateFilter.value='';context.toDateFilter.value='';context.run();
  assert.equal((context.authorityCleaningListEl.innerHTML.match(/<li>/g)||[]).length,2,'Entries remain even without current templates');
  assert.ok(!page.includes('loadScopedCollection("task_instances", { includeDateKey: true })'));
  console.log('PASS: duplicate aliases, selected equipment, report dates, separate execution times, pending without fabricated execution, and preserved historical entries.');
})().catch(e=>{console.error(e);process.exitCode=1;});
