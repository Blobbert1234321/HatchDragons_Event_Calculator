// Browser ports of the separate MATLAB planners. No network calls or dependencies.
export const COSTS = [
  [50,100,150,200,200,250,250,250,300,300,300,350,300,400,350,350],
  [60,120,190,250,250,310,310,320,370,380,370,440,370,500,440,450],
  [75,150,225,300,300,375,375,375,450,450,450,525,450,600,525,525]
];
export const INGREDIENTS = ['Mushroom','Potato','Parsnip','Fish','Meat'];
export const COLORS = ['White','Red','Blue','Yellow','Purple'];
export const POLICIES = ['No golden hooks','Purple only','Purple + yellow','Purple + yellow + blue','Purple + yellow + blue + red','All colors'];
const common = {resourceUseStrategy:"lowestGemCost",resourcePreference:0,eventDays:7,desiredCompletions:2,dailyActions:10,remainingEventMode:false,
  remainingDays:2.8,currentRound:1,currentReward:12,pointsTowardsNextReward:100,
  usePointsMultiplier:false,pointsMultiplierCostGems:1085,pointsMultiplierDays:5,
  multiplierAlreadyPurchased:false,multiplierDaysRemaining:0,
  rangeMode:true,rangeMin:6,rangeMax:14,rangeStep:1,cooldownHours:1.5,rewardPointCosts:COSTS};
export const DEFAULTS = {
  cooking:{...common,ingredientsPerBag:6,ingredientsPerCook:5,ingredientsPerInstantCook:5,
    baseIngredientPoints:[10,12,16,22,28],bonusPoints:[2,2,3,4,5],
    basicBagPercentages:[38.53,25.55,18.54,11.64,5.73],fancyBagPercentages:[0,7.49,42.75,27.54,22.22],
    fancyBagsOwned:0,instantCooksOwned:0,useEqualAmounts:false,gemsPerFancyBag:20,gemsPerInstantCook:25,
    freeBonusRoundsPerIngredient:4,remainingFreeBonusRoundsPerIngredient:3,
    currentIngredientInventory:[0,0,0,0,0],bonusEnabled:[true,true,true,true,true]},
  fishing:{...common,fishPerSpawn:5,fishPerSuccessfulCatch:2,fishHurriesOwned:0,goldenHooksOwned:0,
    gemsPerFishHurry:30,gemsPerGoldenHook:10,fishPointValues:[6,8,10,12,14],
    catchRates:[.7,.7,.6,.5,.4],spawnPercentages:[37.71,24.71,18.84,12.52,6.23],
    comboThresholds:[8,6,5,5,4],comboSpawnOutcomes:[3,5,0],comboHookOutcomes:[0,0,2],
    comboOutcomeProbabilities:[1/3,1/3,1/3],expectedLeftoverFish:[0,0,0,0,0],
    currentFishInventory:[0,0,0,0,0],currentComboProgress:[0,0,0,0,0],
    allowGoldenHookPurchases:true,maxHookPriorityLevel:5}
};
export const clone = v => JSON.parse(JSON.stringify(v));
const sum = a => a.reduce((s,v)=>s+v,0);
const zeros = () => [0,0,0,0,0];
const add = (a,b) => a.map((v,i)=>v+b[i]);
const scale = (a,n) => a.map(v=>v*n);
const norm = a => scale(a,1/sum(a));
const epsFloor = n => Math.floor(n+1e-9);
function assert(ok,message){if(!ok)throw new Error(message);}
function number(n,label,min=0,max=1e6,integer=false){
  assert(typeof n==='number' && Number.isFinite(n) && n>=min && n<=max && (!integer||Number.isInteger(n)),
    `${label}: enter ${integer?'a whole number':'a number'} between ${min} and ${max}.`);
}
function vector(a,label,n=5,min=0,max=100000,integer=false){
  assert(Array.isArray(a)&&a.length===n,`${label} needs ${n} values.`);
  a.forEach(v=>number(v,label,min,max,integer));
}
export function progressPoints(round,reward,partial,costs=COSTS){
  number(round,'Current round',1,3,true); number(reward,'Last claimed reward',0,16,true);
  number(partial,'Points toward next reward');
  const all=costs.flat(),claimed=(round-1)*16+reward;
  assert(claimed===all.length?partial===0:partial<all[claimed],
    'Points toward the next reward must be below its cost. Increase the last claimed reward if you have already earned it.');
  return sum(all.slice(0,claimed))+partial;
}
export function prepare(type,input){
  const c={...clone(DEFAULTS[type]),...clone(input)};
  assert(['lowestGemCost','proportional','custom'].includes(c.resourceUseStrategy),'Choose a valid resource use strategy.');
  number(c.resourcePreference,'Resource preference',-100,100);
  assert(type!=='cooking'||!c.useEqualAmounts||c.resourceUseStrategy==='lowestGemCost','Turn off equal resource amounts to use proportional or custom preference.');
  number(c.eventDays,'Event length',.01,30); number(c.desiredCompletions,'Completions',1,3,true);
  number(c.cooldownHours,'Cooldown',.1,24); number(c.dailyActions,'Daily actions',0,Math.floor(24/c.cooldownHours),true);
  number(c.pointsMultiplierDays,'Multiplier duration',.01,30); number(c.pointsMultiplierCostGems,'Multiplier gem cost');
  assert(Array.isArray(c.rewardPointCosts)&&c.rewardPointCosts.length===3,'Enter three rounds of reward costs.');
  c.rewardPointCosts.forEach(a=>vector(a,'Reward costs',16,.001,100000));
  c.startPoints=0; c.days=c.eventDays;
  if(c.remainingEventMode){
    number(c.remainingDays,'Remaining days',.001,c.eventDays);
    c.days=c.remainingDays;
    c.startPoints=progressPoints(c.currentRound,c.currentReward,c.pointsTowardsNextReward,c.rewardPointCosts);
  }
  c.totalTarget=sum(c.rewardPointCosts.slice(0,c.desiredCompletions).flat());
  c.remainingTarget=Math.max(0,c.totalTarget-c.startPoints);
  c.boostDays=c.usePointsMultiplier?Math.min(c.days,c.pointsMultiplierDays):0;
  c.multiplierFee=c.usePointsMultiplier?c.pointsMultiplierCostGems:0;
  // Cooking's original MATLAB script only uses already-purchased settings in FROM NOW mode.
  if(c.usePointsMultiplier&&c.multiplierAlreadyPurchased&&(type==='fishing'||c.remainingEventMode)){
    number(c.multiplierDaysRemaining,'Remaining multiplier days',0,c.pointsMultiplierDays);
    c.boostDays=Math.min(c.days,c.multiplierDaysRemaining); c.multiplierFee=0;
    if(c.boostDays===0)c.usePointsMultiplier=false;
  }
  if(!c.remainingTarget)c.multiplierFee=0;
  if(type==='cooking'){
    vector(c.baseIngredientPoints,'Ingredient base points',5,.001,100000);
    vector(c.bonusPoints,'Ingredient bonus points',5,0,100000);
    vector(c.basicBagPercentages,'Basic bag chances',5,0,100);
    vector(c.fancyBagPercentages,'Fancy bag chances',5,0,100);
    assert(sum(c.basicBagPercentages)>0,'At least one basic bag chance must be greater than zero.');
    assert(sum(c.fancyBagPercentages)>0,'At least one fancy bag chance must be greater than zero.');
    c.basicRates=norm(c.basicBagPercentages);c.fancyRates=norm(c.fancyBagPercentages);
    for(const key of ['ingredientsPerBag','ingredientsPerCook','ingredientsPerInstantCook'])number(c[key],key,1,100,true);
    for(const key of ['fancyBagsOwned','instantCooksOwned'])number(c[key],key,0,10000,true);
    number(c.gemsPerFancyBag,'Fancy bag cost',.01);number(c.gemsPerInstantCook,'Instant cook cost',.01);
    number(c.freeBonusRoundsPerIngredient,'Expected bonus batches per ingredient',0,10000,true);
    number(c.remainingFreeBonusRoundsPerIngredient,'Remaining expected bonus batches per ingredient',0,10000,true);
    vector(c.currentIngredientInventory,'Starting ingredients',5,0,10000,true);
    assert(Array.isArray(c.bonusEnabled)&&c.bonusEnabled.length===5&&c.bonusEnabled.every(v=>typeof v==='boolean'),'Select ingredient bonuses.');
    c.startInventory=c.remainingEventMode?c.currentIngredientInventory:zeros();
    c.freeRounds=c.remainingEventMode?c.remainingFreeBonusRoundsPerIngredient:c.freeBonusRoundsPerIngredient;
  }else{
    for(const key of ['fishPerSpawn','fishPerSuccessfulCatch'])number(c[key],key,1,100,true);
    for(const key of ['fishHurriesOwned','goldenHooksOwned'])number(c[key],key,0,10000,true);
    number(c.gemsPerFishHurry,'Fish hurry cost',.01);number(c.gemsPerGoldenHook,'Golden hook cost',.01);
    number(c.maxHookPriorityLevel,'Hook priority level',0,5,true);
    vector(c.fishPointValues,'Fish points',5,.01);vector(c.catchRates,'Catch rates',5,.001,1);
    vector(c.spawnPercentages,'Spawn percentages',5,0,100);assert(sum(c.spawnPercentages)>0,'At least one spawn chance must be positive.');
    vector(c.comboThresholds,'Combo thresholds',5,1,1000,true);
    vector(c.currentFishInventory,'Starting fish',5,0,10000,true);
    vector(c.expectedLeftoverFish,'Expected leftover fish',5,0,10000,true);
    vector(c.currentComboProgress,'Combo progress',5,0,1000,true);
    assert(c.currentComboProgress.every((v,i)=>v<c.comboThresholds[i]),'Each combo counter must be below its combo threshold.');
    vector(c.comboSpawnOutcomes,'Combo fish outcomes',3,0,1000,true);
    vector(c.comboHookOutcomes,'Combo hook outcomes',3,0,1000,true);
    vector(c.comboOutcomeProbabilities,'Combo probabilities',3,0,1);
    assert(Math.abs(sum(c.comboOutcomeProbabilities)-1)<1e-8,'Combo probabilities must total 100%.');
    c.spawnRates=norm(c.spawnPercentages);
    c.meanSpawn=sum(c.comboSpawnOutcomes.map((v,i)=>v*c.comboOutcomeProbabilities[i]));
    c.meanHooks=sum(c.comboHookOutcomes.map((v,i)=>v*c.comboOutcomeProbabilities[i]));
    assert(c.meanSpawn/Math.min(...c.comboThresholds)<1,'The combo-spawn loop must produce fewer than one new catch opportunity per catch.');
  }
  return c;
}
export function calculate(type,input,onProgress=()=>{}){
  assert(['cooking','fishing'].includes(type),'Unknown event.');
  const base=prepare(type,input),activities=[];
  if(base.rangeMode){
    number(base.rangeMin,'Range start',0,Math.floor(24/base.cooldownHours),true);
    number(base.rangeMax,'Range end',base.rangeMin,Math.floor(24/base.cooldownHours),true);
    number(base.rangeStep,'Range step',1,16,true);
    for(let n=base.rangeMin;n<=base.rangeMax;n+=base.rangeStep)activities.push(n);
  }else activities.push(base.dailyActions);
  const scenarios=activities.map((n,i)=>{
    const c={...base,dailyActions:n};
    onProgress({message:`Calculating ${n} daily actions…`,fraction:i/activities.length});
    const r=type==='cooking'?findCooking(c):findFishing(c,p=>onProgress({...p,fraction:(i+p.fraction)/activities.length}));
    r.schedule=makeSchedule(c,r.best);r.config=c;r.type=type;
    return r;
  });
  return {type,scenarios};
}
function cookSlots(collected,freeCapacity,instantCapacity,quota,c){
  const BASE=c.baseIngredientPoints,BONUS=c.bonusPoints,enabled=c.bonusEnabled;
  const used=zeros(),freeBonus=zeros(),instantBonus=zeros();
  let capacity=freeCapacity+instantCapacity;
  const cookingPriority=[0,1,2,3,4].sort((a,b)=>BASE[b]-BASE[a]);
  for(const i of cookingPriority){used[i]=Math.min(collected[i],Math.max(0,capacity));capacity-=used[i];}
  const priority=[0,1,2,3,4].sort((a,b)=>BONUS[b]*enabled[b]-BONUS[a]*enabled[a]);
  for(const i of priority)if(enabled[i]){freeBonus[i]=Math.min(used[i],quota,freeCapacity);freeCapacity-=freeBonus[i];}
  for(const i of priority)if(enabled[i]){instantBonus[i]=Math.min(used[i]-freeBonus[i],instantCapacity);instantCapacity-=instantBonus[i];}
  const earned=used.map((v,i)=>v*BASE[i]+(freeBonus[i]+instantBonus[i])*BONUS[i]);
  return {used,freeBonus,instantBonus,earned};
}
export function evaluateCooking(c,bags,instants){
  const BASE=c.baseIngredientPoints,BONUS=c.bonusPoints,BASIC=c.basicRates,FANCY=c.fancyRates;
  const totalBags=epsFloor(c.days*c.dailyActions),totalCooks=epsFloor(c.days*c.dailyActions);
  const fancy=scale(FANCY,bags*c.ingredientsPerBag),slots=instants*c.ingredientsPerInstantCook;
  const quota=c.freeRounds*c.ingredientsPerCook;
  const collected=add(add(c.startInventory,scale(BASIC,totalBags*c.ingredientsPerBag)),fancy);
  let r;
  if(!c.usePointsMultiplier){
    r=cookSlots(collected,totalCooks*c.ingredientsPerCook,slots,quota,c);
    r.multiplierExtra=zeros();r.boostedUsed=zeros();r.earlyPoints=0;r.latePoints=sum(r.earned);
  }else{
    if(slots+1e-8<sum(fancy))return {feasible:false,score:-Infinity,used:zeros()};
    const earlyBags=epsFloor(c.boostDays*c.dailyActions),earlyCooks=epsFloor(c.boostDays*c.dailyActions);
    const earlyCollected=add(c.startInventory,scale(BASIC,earlyBags*c.ingredientsPerBag));
    const early=cookSlots(earlyCollected,earlyCooks*c.ingredientsPerCook,Math.max(0,slots-sum(fancy)),quota*c.boostDays/c.days,c);
    const lateCollected=add(scale(BASIC,(totalBags-earlyBags)*c.ingredientsPerBag),earlyCollected.map((v,i)=>Math.max(0,v-early.used[i])));
    const late=cookSlots(lateCollected,(totalCooks-earlyCooks)*c.ingredientsPerCook,0,quota*(c.days-c.boostDays)/c.days,c);
    const fancyEarned=fancy.map((v,i)=>v*(BASE[i]+BONUS[i]*c.bonusEnabled[i]));
    r={used:add(add(fancy,early.used),late.used),boostedUsed:add(fancy,early.used),
      freeBonus:add(early.freeBonus,late.freeBonus),instantBonus:add(fancy.map((v,i)=>v*c.bonusEnabled[i]),early.instantBonus),
      multiplierExtra:scale(add(fancyEarned,early.earned),.5),earned:add(scale(add(fancyEarned,early.earned),1.5),late.earned),
      earlyPoints:sum(add(fancyEarned,early.earned))*1.5,latePoints:sum(late.earned)};
  }
  r.feasible=true;r.score=sum(r.earned);r.collected=collected;
  return r;
}
function resourcePreference(c,a,b,ownedA,ownedB,earned=0){
  const stockA=Math.min(a,ownedA)/Math.max(1,ownedA);
  const stockB=Math.min(ownedB,Math.max(0,b-earned))/Math.max(1,ownedB);
  const t=c.resourceUseStrategy==='custom'?c.resourcePreference/100:0;
  const wa=(1+t)/2,wb=(1-t)/2;
  return {stockA,stockB,preferenceRank:c.resourceUseStrategy==='lowestGemCost'?[]:[Math.max(wa*stockA,wb*stockB),wa*stockA+wb*stockB]};
}
function cookingPlan(c,bags,instants,r){
  const buyA=Math.max(0,bags-c.fancyBagsOwned),buyB=Math.max(0,instants-c.instantCooksOwned);
  const resourceGems=buyA*c.gemsPerFancyBag+buyB*c.gemsPerInstantCook;
  return {...resourcePreference(c,bags,instants,c.fancyBagsOwned,c.instantCooksOwned),a:bags,b:instants,buyA,buyB,resourceGems,multiplierGems:c.multiplierFee,totalGems:resourceGems+c.multiplierFee,
    score:r.score,earlyPoints:r.earlyPoints,latePoints:r.latePoints,result:r};
}
function findCooking(c){
  const BASE=c.baseIngredientPoints,BONUS=c.bonusPoints,BASIC=c.basicRates,FANCY=c.fancyRates;
  const averageFancy=sum(FANCY.map((v,i)=>v*BASE[i]));
  const averageBasic=sum(BASIC.map((v,i)=>v*BASE[i]));
  const bagAverages=[{name:'Basic bag',one:averageBasic,six:averageBasic*c.ingredientsPerBag,five:averageBasic*Math.min(c.ingredientsPerBag,c.ingredientsPerCook)},
    {name:'Fancy bag',one:averageFancy,six:averageFancy*c.ingredientsPerBag,five:averageFancy*Math.min(c.ingredientsPerBag,c.ingredientsPerCook)}];
  if(c.remainingTarget===0)return {best:{a:0,b:0,buyA:0,buyB:0,resourceGems:0,multiplierGems:0,totalGems:0,score:0,earlyPoints:0,latePoints:0},details:[],tradeoffs:[],bagAverages};
  const basicIngredients=epsFloor(c.days*c.dailyActions)*c.ingredientsPerBag;
  const freeCapacity=epsFloor(c.days*c.dailyActions)*c.ingredientsPerCook;
  let maxFancy=Math.ceil(c.remainingTarget/(c.ingredientsPerBag*averageFancy));
  if(c.useEqualAmounts)maxFancy=Math.max(maxFancy,Math.ceil(Math.max(0,c.remainingTarget/averageFancy-freeCapacity)/c.ingredientsPerInstantCook));
  assert(maxFancy<=3000,'This search is too large. Reduce the target or check resource values.');
  const plans=[];
  for(let f=0;f<=maxFancy;f++){
    const maxI=Math.ceil((sum(c.startInventory)+basicIngredients+f*c.ingredientsPerBag)/c.ingredientsPerInstantCook);
    const start=c.useEqualAmounts?f:0,end=c.useEqualAmounts?f:maxI;
    for(let instant=start;instant<=end;instant++){
      const r=evaluateCooking(c,f,instant);
      if(r.feasible&&r.score>=c.remainingTarget&&r.collected.slice(2).every((v,i)=>v-r.used[i+2]<1e-8)){
        plans.push(cookingPlan(c,f,instant,r));break;
      }
    }
  }
  assert(plans.length,'No plan fits these settings. Equal resource use can conflict with instant-cooking all fancy food during the multiplier. Turn off equal amounts or increase daily actions.');
  plans.sort((a,b)=>a.totalGems-b.totalGems||(a.preferenceRank[0]??0)-(b.preferenceRank[0]??0)||(a.preferenceRank[1]??0)-(b.preferenceRank[1]??0)||(a.a+a.b)-(b.a+b.b)||a.a-b.a);
  const best=plans[0],r=best.result;
  const details=INGREDIENTS.map((name,i)=>{
    const bonus=r.freeBonus[i]+r.instantBonus[i],base=r.used[i]*BASE[i];
    return {name,basePoints:BASE[i],bonusEnabled:c.bonusEnabled[i],bonusPerItem:BONUS[i]*c.bonusEnabled[i],
      fromBasic:basicIngredients*BASIC[i],fromFancy:best.a*c.ingredientsPerBag*FANCY[i],starting:c.startInventory[i],
      collected:r.collected[i],used:r.used[i],leftover:Math.max(0,r.collected[i]-r.used[i])<1e-8?0:Math.max(0,r.collected[i]-r.used[i]),
      boostedUsed:r.boostedUsed[i],freeBonus:r.freeBonus[i],instantBonus:r.instantBonus[i],bonusCooked:bonus,
      normalCooked:Math.max(0,r.used[i]-bonus),baseEarned:base,bonusEarned:bonus*BONUS[i],multiplierExtra:r.multiplierExtra[i],points:r.earned[i]};
  });
  let minI=Infinity;
  const tradeoffs=plans.toSorted((a,b)=>a.a-b.a).filter(p=>{if(p.b<minI){minI=p.b;return true;}return false;});
  return {best,details,tradeoffs,bagAverages,naturalCount:epsFloor(c.days*c.dailyActions),baseline:evaluateCooking(c,0,0).score};
}

function fishingPhase(c,spawnCount,hooks,counter,level){
  const catches=zeros(),spawnedTotal=zeros(),hookedTotal=zeros(),combosTotal=zeros();
  let pending=spawnCount,hooksEarned=0,comboSpawns=0;
  for(let generation=0;generation<1000;generation++){
    if(pending<1e-10)return {catches,spawned:spawnedTotal,hooked:hookedTotal,combos:combosTotal,hooksEarned,comboSpawns,hooks,counter};
    let rewards=0;
    for(let i=4;i>=0;i--){
      const spawned=pending*c.spawnRates[i];
      const hooked=i>=5-level?Math.min(spawned,Math.max(0,hooks)):0;
      hooks-=hooked;
      const caught=hooked+(spawned-hooked)*c.catchRates[i];
      const total=counter[i]+caught,combos=Math.floor((total+1e-10)/c.comboThresholds[i]);
      counter[i]=Math.max(0,total-combos*c.comboThresholds[i]);rewards+=combos;
      catches[i]+=caught;spawnedTotal[i]+=spawned;hookedTotal[i]+=hooked;combosTotal[i]+=combos;
    }
    const earned=rewards*c.meanHooks;pending=rewards*c.meanSpawn;hooks+=earned;
    hooksEarned+=earned;comboSpawns+=pending;
  }
  throw new Error('Combo chain did not converge. Check the combo settings.');
}
export function simulateFishing(c,hurries,initialHooks,level){
  const groups=epsFloor(c.days*c.dailyActions),earlyGroups=c.usePointsMultiplier?epsFloor(c.boostDays*c.dailyActions):0;
  const earlySpawns=earlyGroups*c.fishPerSpawn+(c.usePointsMultiplier?hurries*c.fishPerSpawn:0);
  const lateSpawns=(groups-earlyGroups)*c.fishPerSpawn+(!c.usePointsMultiplier?hurries*c.fishPerSpawn:0);
  const early=fishingPhase(c,earlySpawns,initialHooks,[...c.currentComboProgress],level);
  const late=fishingPhase(c,lateSpawns,early.hooks,early.counter,level);
  let earlyFish=scale(early.catches,c.fishPerSuccessfulCatch),lateFish=scale(late.catches,c.fishPerSuccessfulCatch);
  if(c.usePointsMultiplier)earlyFish=add(earlyFish,c.currentFishInventory);else lateFish=add(lateFish,c.currentFishInventory);
  const leftLate=lateFish.map((v,i)=>Math.min(v,c.expectedLeftoverFish[i]));
  const leftEarly=earlyFish.map((v,i)=>Math.min(v,Math.max(0,c.expectedLeftoverFish[i]-leftLate[i])));
  const earlyTraded=earlyFish.map((v,i)=>Math.max(0,v-leftEarly[i]));
  const lateTraded=lateFish.map((v,i)=>Math.max(0,v-leftLate[i]));
  const earlyEarned=earlyTraded.map((v,i)=>v*c.fishPointValues[i]*(c.usePointsMultiplier?1.5:1));
  const lateEarned=lateTraded.map((v,i)=>v*c.fishPointValues[i]);
  const hooked=add(early.hooked,late.hooked),leftover=add(leftEarly,leftLate);
  return {score:sum(add(earlyEarned,lateEarned)),earlyPoints:sum(earlyEarned),latePoints:sum(lateEarned),
    catches:add(early.catches,late.catches),spawned:add(early.spawned,late.spawned),hooked,hooksUsed:sum(hooked),
    hooksEarned:early.hooksEarned+late.hooksEarned,hooksRemaining:late.hooks,combos:add(early.combos,late.combos),comboProgress:late.counter,
    inventory:add(earlyFish,lateFish),leftover,leftoverShortfall:c.expectedLeftoverFish.map((v,i)=>Math.max(0,v-leftover[i])),
    traded:add(earlyTraded,lateTraded),pointsByColor:add(earlyEarned,lateEarned),comboSpawns:early.comboSpawns+late.comboSpawns,earlyTraded,lateTraded};
}
function fishingPlan(c,h,allowance,level,r){
  const buyA=Math.max(0,h-c.fishHurriesOwned),buyB=Math.max(0,allowance-c.goldenHooksOwned);
  const resourceGems=buyA*c.gemsPerFishHurry+buyB*c.gemsPerGoldenHook;
  return {...resourcePreference(c,h,r.hooksUsed,c.fishHurriesOwned,c.goldenHooksOwned,r.hooksEarned),a:h,b:r.hooksUsed,buyA,buyB,resourceGems,multiplierGems:c.multiplierFee,totalGems:resourceGems+c.multiplierFee,
    level,allowance,policy:POLICIES[level],score:r.score,earlyPoints:r.earlyPoints,latePoints:r.latePoints,result:r};
}
function betterFishing(a,b){
  const aa=[a.resourceGems,...a.preferenceRank,a.b,a.a,a.level],bb=[b.resourceGems,...b.preferenceRank,b.b,b.a,b.level];
  for(let i=0;i<aa.length;i++)if(Math.abs(aa[i]-bb[i])>1e-8)return aa[i]<bb[i];
  return false;
}
function findFishing(c,onProgress){
  if(!c.remainingTarget)return {best:{a:0,b:0,buyA:0,buyB:0,resourceGems:0,multiplierGems:0,totalGems:0,score:0,earlyPoints:0,latePoints:0,policy:POLICIES[0]},details:[],tradeoffs:[],policySummary:[]};
  let upper=0;
  while(simulateFishing(c,upper,0,0).score<c.remainingTarget){upper=Math.max(1,upper*2);assert(upper<=65536,'Target is too large. Check the settings.');}
  let lo=0,hi=upper;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(simulateFishing(c,mid,0,0).score>=c.remainingTarget)hi=mid;else lo=mid+1;}
  const maxH=lo;
  assert(maxH<=2500,'This search is unusually large. Reduce the target or check the fish values.');
  let best=fishingPlan(c,maxH,0,0,simulateFishing(c,maxH,0,0));
  const ceiling=best.resourceGems,policyBest=Array(c.maxHookPriorityLevel+1).fill(null);policyBest[0]=best;
  const tradeoffs=[];
  for(let h=0;h<=maxH;h++){
    if(h%5===0)onProgress({message:`Comparing fishing resources: ${h} of ${maxH} hurries`,fraction:h/(maxH+1)});
    const hurryCost=Math.max(0,h-c.fishHurriesOwned)*c.gemsPerFishHurry;
    if(hurryCost>ceiling)continue;
    let local=null;
    for(let level=0;level<=c.maxHookPriorityLevel;level++){
      const maxBuy=c.allowGoldenHookPurchases?Math.floor((ceiling-hurryCost)/c.gemsPerGoldenHook+1e-9):0;
      const natural=epsFloor(c.days*c.dailyActions)*c.fishPerSpawn;
      const useful=Math.ceil((natural+h*c.fishPerSpawn+50)/(1-c.meanSpawn/Math.min(...c.comboThresholds)));
      const end=level===0?0:Math.min(c.goldenHooksOwned+maxBuy,useful);
      assert(end<=20000,'Too many hook allowances to compare. Reduce the resource budget.');
      let stage=null;
      // Fully enumerate, rather than assuming resource outcomes are monotonic.
      for(let allowance=0;allowance<=end;allowance++){
        const r=simulateFishing(c,h,allowance,level);
        if(r.score<c.remainingTarget-1e-8)continue;
        const candidate=fishingPlan(c,h,allowance,level,r);
        if(!stage||betterFishing(candidate,stage))stage=candidate;
      }
      if(!stage)continue;
      if(!local||betterFishing(stage,local))local=stage;
      if(betterFishing(stage,best))best=stage;
      if(!policyBest[level]||betterFishing(stage,policyBest[level]))policyBest[level]=stage;
    }
    if(local)tradeoffs.push(local);
  }
  const r=best.result;
  const details=COLORS.map((name,i)=>({name,pointsPerFish:c.fishPointValues[i],spawned:r.spawned[i],catches:r.catches[i],
    received:r.catches[i]*c.fishPerSuccessfulCatch,starting:c.currentFishInventory[i],hooked:r.hooked[i],combos:r.combos[i],
    comboProgress:r.comboProgress[i],traded:r.traded[i],leftover:r.leftover[i],shortfall:r.leftoverShortfall[i],points:r.pointsByColor[i]}));
  return {best,details,tradeoffs,policySummary:policyBest.filter(Boolean),naturalCount:epsFloor(c.days*c.dailyActions)};
}
export function ordinal(n){const m=n%100;return `${n}${m>=11&&m<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th')}`;}
export function makeSchedule(c,p){
  if(!c.remainingTarget)return [];
  const costs=c.rewardPointCosts.slice(0,c.desiredCompletions).flat(),thresholds=[];
  let s=0;for(const cost of costs){s+=cost;thresholds.push(s);}
  const hours=[];for(let h=24;h<=24*c.days+1e-8;h+=24)hours.push(h);
  if(!hours.length||Math.abs(hours.at(-1)-24*c.days)>1e-8)hours.push(24*c.days);
  let previous=thresholds.filter(v=>v<=c.startPoints+1e-9).length,previousPoints=0;
  return hours.map((hour,i)=>{
    let added=c.remainingTarget*(hour/24)/c.days;
    if(c.usePointsMultiplier&&c.boostDays>0){
      let profile=p.earlyPoints*Math.min(hour/24,c.boostDays)/c.boostDays;
      if(c.days>c.boostDays)profile+=p.latePoints*Math.max(0,hour/24-c.boostDays)/(c.days-c.boostDays);
      added=c.remainingTarget*profile/(p.earlyPoints+p.latePoints);
    }
    const cumulative=i===hours.length-1?c.totalTarget:c.startPoints+added;
    const claimed=thresholds.filter(v=>v<=cumulative+1e-9).length;
    const reward=claimed?(claimed-1)%16+1:0,round=claimed?Math.floor((claimed-1)/16)+1:1;
    const nextReward=claimed<costs.length?claimed%16+1:null;
    const progress=nextReward?100*(cumulative-(claimed?thresholds[claimed-1]:0))/costs[claimed]:100;
    const completions=[];for(let r=1;r<=c.desiredCompletions;r++)if(previous<r*16&&claimed>=r*16)completions.push(r);
    const dailyPoints=added-previousPoints;previousPoints=added;previous=claimed;
    return {day:i+1,hours:hour,dailyPoints,pointsFromNow:added,cumulative,reward,round,nextReward,progress,completions,deadline:i===hours.length-1};
  });
}
