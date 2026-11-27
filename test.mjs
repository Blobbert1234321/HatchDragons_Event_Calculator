import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate,DEFAULTS,clone,prepare,progressPoints,COSTS,simulateFishing,evaluateCooking} from './engines.mjs';
import {createSpreadsheet,workbookSheets} from './spreadsheet.mjs';
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,`${label}: browser ${a}, MATLAB ${b}`);
const array=v=>Array.isArray(v)?v:[v];
const cases=JSON.parse(fs.readFileSync(new URL('./test-data/cases.json',import.meta.url),'utf8'));
// Reference cases were exported with the earlier defaults; keep their inputs explicit.
const referenceDefaults=type=>({...clone(DEFAULTS[type]),desiredCompletions:3,dailyActions:12,usePointsMultiplier:true,rangeMode:false,...(type==='cooking'?{freeBonusRoundsPerIngredient:7}:{})});
for(const item of cases){
  const ref=JSON.parse(fs.readFileSync(new URL(`./test-data/${item.name}.json`,import.meta.url),'utf8'));
  const s=calculate(item.type,{...referenceDefaults(item.type),...item.settings}).scenarios[0],p=s.best;
  if(item.type==='cooking'){
    const pairs={a:'FancyBags',b:'InstantCooks',buyA:'FancyBagsToBuy',buyB:'InstantCooksToBuy',score:'ExpectedPoints',resourceGems:'ResourceGems',totalGems:'ExtraGems',multiplierGems:'MultiplierGems',earlyPoints:'BoostedPeriodPoints',latePoints:'UnboostedPeriodPoints'};
    for(const [key,field] of Object.entries(pairs))near(p[key],ref.summary[field],`${item.name} ${key}`);
    array(ref.details).forEach((d,i)=>{
      for(const [key,field] of Object.entries({collected:'Collected',used:'Used',leftover:'LeftOver',freeBonus:'FreeBonusCooked',instantBonus:'InstantBonusCooked',normalCooked:'CookedWithoutBonus',points:'PointsEarned',multiplierExtra:'MultiplierExtraPoints'}))near(s.details[i][key],d[field],`${item.name} ${d.Ingredient} ${key}`);
    });
  }else{
    near(p.a,ref.summary.hurries,`${item.name} hurries`);near(p.b,ref.summary.result.hooksUsed,`${item.name} hooks`);
    for(const field of ['buyHurries','buyHooks','resourceGems','totalGems'])near(p[{buyHurries:'buyA',buyHooks:'buyB'}[field]||field],ref.summary[field],`${item.name} ${field}`);
    near(p.score,ref.summary.result.score,`${item.name} score`);near(p.level,ref.summary.level,`${item.name} policy`);
    array(ref.details).forEach((d,i)=>{
      for(const [key,field] of Object.entries({spawned:'Spawned',catches:'SuccessfulCatches',received:'FishReceived',hooked:'GoldenHooksUsed',combos:'CombosEarned',comboProgress:'EndingComboProgress',traded:'TradedFish',leftover:'LeftOver',points:'PointsEarned'}))near(s.details[i][key],d[field],`${item.name} ${d.Color} ${key}`);
    });
  }
  const days=array(ref.schedule);assert.equal(s.schedule.length,days.length);
  days.forEach((d,i)=>{for(const [key,field] of Object.entries({hours:'HoursElapsed',dailyPoints:'DailyPoints',pointsFromNow:'PointsFromNow',cumulative:'CumulativePoints'}))near(s.schedule[i][key],d[field],`${item.name} schedule ${i} ${key}`);});
  console.log(`PASS MATLAB parity: ${item.name}`);
}
assert.deepEqual(COSTS.map(r=>r.reduce((a,b)=>a+b,0)),[4100,5130,6150]);
near(progressPoints(2,6,100),5380,'round 2 exact progress');
assert.throws(()=>progressPoints(2,6,310),/next reward/);
for(const type of ['cooking','fishing']){
  const settings={...clone(DEFAULTS[type]),remainingEventMode:true,currentRound:3,currentReward:16,pointsTowardsNextReward:0};
  const done=calculate(type,settings).scenarios[0];assert.equal(done.best.totalGems,0);assert.equal(done.schedule.length,0);
  const range=calculate(type,{...clone(DEFAULTS[type]),rangeMode:true,rangeMin:10,rangeMax:12,rangeStep:2});
  assert.deepEqual(range.scenarios.map(s=>s.config.dailyActions),[10,12]);
  range.scenarios.forEach(s=>assert.ok(s.best.score>=s.config.remainingTarget-1e-8));
  assert.throws(()=>calculate(type,{...clone(DEFAULTS[type]),dailyActions:17}),/Daily actions/);
}
const c=prepare('fishing',{...clone(DEFAULTS.fishing),usePointsMultiplier:false,comboSpawnOutcomes:[0,0,0],comboHookOutcomes:[0,0,0]});
const r=simulateFishing(c,10,0,0),spawns=(c.days*c.dailyActions+10)*5;
r.catches.forEach((v,i)=>near(v,spawns*c.spawnRates[i]*c.catchRates[i],`analytic catch ${i}`));
near(r.hooksEarned,0,'no hook rewards');
const noPurchases=calculate('fishing',{...clone(DEFAULTS.fishing),allowGoldenHookPurchases:false,goldenHooksOwned:30}).scenarios[0];
assert.equal(noPurchases.best.buyB,0);
const small=calculate('cooking',{...clone(DEFAULTS.cooking),desiredCompletions:3,rangeMode:false,remainingEventMode:true,remainingDays:.2,currentRound:3,currentReward:15,pointsTowardsNextReward:100,usePointsMultiplier:false}).scenarios[0];
near(small.schedule.at(-1).hours,4.8,'partial last day');near(small.schedule.at(-1).cumulative,15380,'partial final target');
console.log('PASS validation, completed targets, activity ranges, hook purchase controls, analytic catch rates, and partial-day schedules.');
const original=prepare('cooking',DEFAULTS.cooking);
const doubled=prepare('cooking',{...clone(DEFAULTS.cooking),baseIngredientPoints:[20,24,32,44,56],bonusPoints:[4,4,6,8,10]});
near(evaluateCooking(doubled,29,35).score,2*evaluateCooking(original,29,35).score,'custom base and bonus points');
const meatOnly=prepare('cooking',{...clone(DEFAULTS.cooking),dailyActions:0,usePointsMultiplier:false,fancyBagPercentages:[0,0,0,0,100]});
const meatPlan=evaluateCooking(meatOnly,1,2);
assert.deepEqual(meatPlan.collected,[0,0,0,0,6]);near(meatPlan.score,198,'custom fancy chance and bonus points');
const noBonus=prepare('cooking',{...clone(DEFAULTS.cooking),dailyActions:0,usePointsMultiplier:false,fancyBagPercentages:[0,0,0,0,100],bonusPoints:[0,0,0,0,0]});
near(evaluateCooking(noBonus,1,2).score,168,'zero custom bonus');
const mushroomOnly=prepare('cooking',{...clone(DEFAULTS.cooking),eventDays:1,dailyActions:2,usePointsMultiplier:false,basicBagPercentages:[100,0,0,0,0]});
assert.deepEqual(evaluateCooking(mushroomOnly,0,0).collected,[12,0,0,0,0]);
const reordered=prepare('cooking',{...clone(DEFAULTS.cooking),eventDays:1,dailyActions:1,usePointsMultiplier:false,basicBagPercentages:[50,0,0,0,50],baseIngredientPoints:[1000,12,16,22,28]});
assert.deepEqual(evaluateCooking(reordered,0,0).used,[3,0,0,0,2]);
assert.throws(()=>prepare('cooking',{...clone(DEFAULTS.cooking),basicBagPercentages:[0,0,0,0,0]}),/basic bag chance/);
assert.throws(()=>prepare('cooking',{...clone(DEFAULTS.cooking),fancyBagPercentages:[0,0,0,0,0]}),/fancy bag chance/);
assert.throws(()=>prepare('cooking',{...clone(DEFAULTS.cooking),bonusPoints:[-1,2,3,4,5]}),/bonus points/);
const custom=calculate('cooking',doubled).scenarios[0];
near(custom.bagAverages[0].one,2*calculate('cooking',DEFAULTS.cooking).scenarios[0].bagAverages[0].one,'custom bag averages');
assert.ok(custom.best.a<29,'Custom point values should change the resource recommendation.');
console.log('PASS editable ingredient points, bonus values, bag probabilities, priorities, resource recommendations, and validation.');
for(const type of ['cooking','fishing']){
  const d=DEFAULTS[type];
  assert.equal(d.desiredCompletions,2); assert.equal(d.dailyActions,10);
  assert.equal(d.usePointsMultiplier,false); assert.equal(d.rangeMode,true);
  const fresh=calculate(type,d);
  assert.deepEqual(fresh.scenarios.map(s=>s.config.dailyActions),[6,7,8,9,10,11,12,13,14]);
  assert.ok(fresh.scenarios.every(s=>s.best.score>=9230-1e-8 && s.best.multiplierGems===0));
}
assert.equal(DEFAULTS.cooking.freeBonusRoundsPerIngredient,4);
const batches=prepare('cooking',{...clone(DEFAULTS.cooking),rangeMode:false,freeBonusRoundsPerIngredient:4});
const batchPlan=evaluateCooking(batches,40,50);
assert.ok(batchPlan.freeBonus.every(n=>n<=20+1e-8));
console.log('PASS new first-visit defaults, comparison range, multiplier off, and four bonus batches.');

// Read the stored ZIP records independently to check the downloaded workbook.
function parts(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=new Map();let offset=0;
  while(view.getUint32(offset,true)===0x04034b50){
    const size=view.getUint32(offset+18,true),n=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
    const start=offset+30+n+extra;
    out.set(new TextDecoder().decode(bytes.slice(offset+30,offset+30+n)),new TextDecoder().decode(bytes.slice(start,start+size)));
    offset=start+size;
  }
  return out;
}
for(const type of ['cooking','fishing']){
  for(const settings of [DEFAULTS[type],{...clone(DEFAULTS[type]),remainingEventMode:true,rangeMode:false}]){
    const all=calculate(type,settings),sheets=workbookSheets(all),archive=parts(createSpreadsheet(all));
    assert.equal(archive.get('xl/workbook.xml').match(/<sheet /g).length,sheets.length);
    assert.equal(sheets.some(s=>s.name==='Daily comparison'),settings.rangeMode);
    assert.equal([...archive.keys()].filter(k=>/^xl\/charts\/chart\d+\.xml$/.test(k)).length,settings.rangeMode?3:2);
    assert.equal(sheets[0].rows.find(r=>r[0]==='ADDITIONAL GEMS NEEDED')[1],all.scenarios[0].best.totalGems);
    assert.equal(sheets.find(s=>s.name==='Breakdown').rows[0].at(-1),all.scenarios[0].details[0].points);
    for(const sheet of sheets)for(const row of sheet.rows)for(const value of row)assert.ok(value!==undefined&&!(typeof value==='number'&&!Number.isFinite(value)));
    assert.ok(archive.get('xl/styles.xml').includes('#,##0.0'));
    assert.ok(archive.get('xl/worksheets/sheet1.xml').includes(String(all.scenarios[0].best.score)),'Full numeric precision must be retained.');
    assert.ok(!archive.get('xl/workbook.xml').includes('Resource A'));
  }
  const complete=calculate(type,{...clone(DEFAULTS[type]),rangeMode:false,remainingEventMode:true,currentRound:2,currentReward:16,pointsTowardsNextReward:0});
  assert.doesNotThrow(()=>createSpreadsheet(complete));
}
console.log('PASS Excel export for both events, ranges, current progress, completed targets, charts, purchase totals, and numeric precision.');

// New strategy results exported directly from the updated MATLAB scripts.
const strategyCases=JSON.parse(fs.readFileSync(new URL('./test-data/resource-strategies.json',import.meta.url),'utf8'));
for(const item of strategyCases){
  const best=calculate(item.type,{...clone(DEFAULTS[item.type]),...item.settings}).scenarios[0].best;
  for(const [key,value] of Object.entries(item.expected))near(key==='gems'?best.totalGems:best[key],value,`${item.type} strategy ${item.name} ${key}`);
}
for(const type of ['cooking','fishing']){
  assert.equal(DEFAULTS[type].resourceUseStrategy,'lowestGemCost');
  assert.equal(DEFAULTS[type].resourcePreference,0);
  assert.throws(()=>prepare(type,{resourceUseStrategy:'invalid'}),/strategy/);
  assert.throws(()=>prepare(type,{resourcePreference:101}),/preference/);
  const all=calculate(type,{...clone(DEFAULTS[type]),resourceUseStrategy:'proportional',rangeMode:true,rangeMin:10,rangeMax:12,...(type==='cooking'?{fancyBagsOwned:40,instantCooksOwned:70}:{fishHurriesOwned:40,goldenHooksOwned:300})});
  assert.equal(all.scenarios.length,3);
  for(const s of all.scenarios){assert.ok(s.best.score>=s.config.remainingTarget);assert.equal(s.best.totalGems,0);}
  assert.doesNotThrow(()=>createSpreadsheet(all));
}
assert.throws(()=>prepare('cooking',{useEqualAmounts:true,resourceUseStrategy:'proportional'}),/equal resource/);
console.log('PASS 17 MATLAB strategy comparisons, default strategy, input validation, preference ranges, and spreadsheet exports.');
