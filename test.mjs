import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate,DEFAULTS,clone,prepare,progressPoints,COSTS,simulateFishing} from './engines.mjs';
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,`${label}: browser ${a}, MATLAB ${b}`);
const array=v=>Array.isArray(v)?v:[v];
const cases=JSON.parse(fs.readFileSync(new URL('./test-data/cases.json',import.meta.url),'utf8'));
for(const item of cases){
  const ref=JSON.parse(fs.readFileSync(new URL(`./test-data/${item.name}.json`,import.meta.url),'utf8'));
  const s=calculate(item.type,{...clone(DEFAULTS[item.type]),...item.settings}).scenarios[0],p=s.best;
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
const r=simulateFishing(c,10,0,0),spawns=(84+10)*5;
r.catches.forEach((v,i)=>near(v,spawns*c.spawnRates[i]*c.catchRates[i],`analytic catch ${i}`));
near(r.hooksEarned,0,'no hook rewards');
const noPurchases=calculate('fishing',{...clone(DEFAULTS.fishing),allowGoldenHookPurchases:false,goldenHooksOwned:30}).scenarios[0];
assert.equal(noPurchases.best.buyB,0);
const small=calculate('cooking',{...clone(DEFAULTS.cooking),remainingEventMode:true,remainingDays:.2,currentRound:3,currentReward:15,pointsTowardsNextReward:100,usePointsMultiplier:false}).scenarios[0];
near(small.schedule.at(-1).hours,4.8,'partial last day');near(small.schedule.at(-1).cumulative,15380,'partial final target');
console.log('PASS validation, completed targets, activity ranges, hook purchase controls, analytic catch rates, and partial-day schedules.');
