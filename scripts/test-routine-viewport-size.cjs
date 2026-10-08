const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname, '../public/modules/egenkontrol/rutiner.html'),'utf8');
const start=html.indexOf('        function clearRoutineViewportFit()'),end=html.indexOf('        function getCompactRoutinePageItems(',start);
for(const [width,height] of [[1366,650],[1280,600],[1024,768],[390,700]]){
 const styles={zoom:'0.62'},classes=new Set(['routine-viewport-fit']);
 const taskListEl={scrollHeight:1300,style:{removeProperty:key=>delete styles[key]},classList:{remove:key=>classes.delete(key)}};
 const context={taskListEl,window:{innerWidth:width,innerHeight:height}};vm.createContext(context);vm.runInContext(html.slice(start,end),context);
 context.scheduleRoutineViewportFit();assert.equal(styles.zoom,undefined);assert.equal(classes.has('routine-viewport-fit'),false);
 context.scheduleRoutineViewportFit();assert.equal(styles.zoom,undefined,'Resize and re-render must never shrink routines');
}
console.log('Routine viewport: short laptop screens, tablet/mobile and repeated resizing keep natural text size.');
