import {DEFAULTS,clone,INGREDIENTS,COLORS,POLICIES,ordinal} from './engines.mjs';
const $=s=>document.querySelector(s);
const form=$('#settings-form');
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(Math.abs(n)<1e-8?0:n):'—';
const integer=n=>num(n,0);
const states={cooking:clone(DEFAULTS.cooking),fishing:clone(DEFAULTS.fishing)};
const cache={},signatures={};
let eventType='cooking',worker=null,jobType=null,activeScenario=0,toastTimer;
function mergeSettings(type,incoming){
  const clean=clone(DEFAULTS[type]);
  if(!incoming||typeof incoming!=='object')return clean;
  const matches=(v,model)=>Array.isArray(model)?Array.isArray(v)&&v.length===model.length&&v.every((item,i)=>matches(item,model[i])):
    typeof model==='number'?typeof v==='number'&&Number.isFinite(v):typeof v===typeof model;
  for(const key of Object.keys(clean))if(matches(incoming[key],clean[key]))clean[key]=incoming[key];
  return clean;
}
try{
  const saved=JSON.parse(localStorage.getItem('hatchdragons-planner-v1'));
  if(saved&&typeof saved==='object')for(const type of ['cooking','fishing'])if(saved[type])states[type]=mergeSettings(type,saved[type]);
}catch{}
try{
  const encoded=new URLSearchParams(location.hash.slice(1)).get('plan');
  if(encoded){
    if(encoded.length>30000)throw new Error('Shared settings are too large.');
    const bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    const shared=JSON.parse(new TextDecoder().decode(bytes));
    if(['cooking','fishing'].includes(shared.type)&&shared.settings&&typeof shared.settings==='object'){
      eventType=shared.type;states[eventType]=mergeSettings(eventType,shared.settings);
    }
  }
}catch{showToast('Could not read that shared plan. Your saved settings are still available.');}
function get(path){return path.split('.').reduce((v,k)=>v?.[k],states[eventType]);}
function set(path,value){const keys=path.split('.');let o=states[eventType];for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=value;}
function save(){try{localStorage.setItem('hatchdragons-planner-v1',JSON.stringify(states));}catch{}}
function input(path,label,{min=0,max=100000,step=1,hint='',scale=1}={}){
  const value=get(path),id=`f-${path.replaceAll('.','-')}`;
  return `<label class="field" for="${id}"><span class="field-label">${label}</span><input id="${id}" type="number" data-path="${path}" data-scale="${scale}" value="${value==null?'':esc(value*scale)}" min="${min}" max="${max}" step="${step}" required>${hint?`<span class="field-hint">${hint}</span>`:''}</label>`;
}
function select(path,label,options){return `<label class="field"><span class="field-label">${label}</span><select data-path="${path}" data-number="true">${options.map(([value,text])=>`<option value="${value}" ${get(path)===value?'selected':''}>${text}</option>`).join('')}</select></label>`;}
function check(path,label,hint=''){return `<label class="check-field"><input type="checkbox" data-path="${path}" ${get(path)?'checked':''}><span>${label}${hint?`<span class="helper">${hint}</span>`:''}</span></label>`;}
const conditional=(when,content)=>`<div class="conditional" data-when="${when}">${content}</div>`;
const section=(title,content,icon='✧')=>`<section class="form-section"><h3 class="section-caption"><span class="section-icon" aria-hidden="true">${icon}</span>${title}</h3>${content}</section>`;
const advanced=(title,content,open=false)=>`<details class="advanced" ${open?'open':''}><summary>${title}</summary><div class="advanced-body">${content}</div></details>`;
function vectorInputs(path,names,{label='Inventory',secondPath=null,secondLabel='',secondCheck=false,min=0,secondMin=0,max=10000,secondMax=10000,scale=1,secondScale=1,step=1}={}){
  const colors=eventType==='fishing'?['#eef1f6','#ef8d8d','#79aaf8','#e9cf75','#c5a2f3']:['#bba896','#d4bd8d','#d59b7b','#79b7c1','#c0869b'];
  return `<div class="compact-grid"><span class="column-title">${eventType==='fishing'?'Fish':'Ingredient'}</span><span class="column-title">${label}</span><span class="column-title">${secondLabel}</span></div>`+names.map((name,i)=>{
    const first=`<input type="number" aria-label="${esc(name+' '+label)}" data-path="${path}.${i}" data-scale="${scale}" min="${min}" max="${max}" step="${step}" value="${get(path)?.[i]==null?'':esc(get(path)[i]*scale)}" required>`;
    let second='';
    if(secondPath)second=secondCheck?`<span class="check-cell"><input type="checkbox" aria-label="${esc(name+' '+secondLabel)}" data-path="${secondPath}.${i}" ${get(secondPath)?.[i]?'checked':''}></span>`:`<input type="number" aria-label="${esc(name+' '+secondLabel)}" data-path="${secondPath}.${i}" data-scale="${secondScale}" min="${secondMin}" max="${secondMax}" step="${step}" value="${get(secondPath)?.[i]==null?'':esc(get(secondPath)[i]*secondScale)}" required>`;
    return `<div class="compact-grid"><span class="color-label"><span class="swatch" style="background:${colors[i]}" aria-hidden="true"></span>${name}</span>${first}${second||'<span></span>'}</div>`;
  }).join('');
}
function renderForm(){
  const cooking=eventType==='cooking';
  document.documentElement.style.setProperty('--accent',cooking?'#f5b477':'#77d1e1');
  $('#event-kicker').textContent=cooking?'COOKING EVENT':'FISHING EVENT';
  const mode=`<div class="segmented" role="group" aria-label="Planning starting point">${[[false,'Full event'],[true,'From now']].map(([v,label])=>`<label><input type="radio" name="planning-mode" data-path="remainingEventMode" data-boolean="${v}" ${get('remainingEventMode')===v?'checked':''}><span>${label}</span></label>`).join('')}</div>`;
  const goal=section('Your event',mode+`<div class="field-row">${select('desiredCompletions','Completions',[[1,'1 completion'],[2,'2 completions'],[3,'3 completions']])}${input('dailyActions',cooking?'Collections & cooks / day':'Free spawn groups / day',{max:16,hint:cooking?'One basic bag + one free batch.':'Five fish per free group.'})}</div>`+
    conditional('remainingEventMode',input('remainingDays','Days remaining',{min:.001,max:30,step:'any',hint:'Decimals work: 2 days + 18 hours = 2.75.'})+
      `<div class="field-row">${input('currentRound','Current round',{min:1,max:3})}${input('currentReward','Last claimed reward',{max:16})}</div>`+
      input('pointsTowardsNextReward','Points toward next reward',{step:'any',hint:'Reward 0 means no rewards claimed in this round. Completions includes rounds already finished.'})));
  const owned=section('Resources you already have',`<div class="field-row">${input(cooking?'fancyBagsOwned':'fishHurriesOwned',cooking?'Fancy bags':'Fish hurries',{max:10000})}${input(cooking?'instantCooksOwned':'goldenHooksOwned',cooking?'Instant cooks':'Golden hooks',{max:10000})}</div>`, '◇');
  const boost=section('Points multiplier',`<div class="toggle-card">${check('usePointsMultiplier','<strong>Use the 1.5× multiplier</strong>',`${integer(get('pointsMultiplierCostGems'))} gems · lasts ${num(get('pointsMultiplierDays'))} days`)}</div>`+
    conditional('usePointsMultiplier&remainingEventMode',check('multiplierAlreadyPurchased','I already purchased the multiplier','An active multiplier is not charged again.')+
      conditional('multiplierAlreadyPurchased',input('multiplierDaysRemaining','Multiplier days remaining',{max:30,step:'any',hint:'0 means it has expired.'}))), '✦');
  let specific;
  if(cooking){
    specific=advanced('Ingredients & bonuses',
      conditional('!remainingEventMode',input('freeBonusRoundsPerIngredient','Expected bonus batches per ingredient',{max:10000,hint:'Each bonus batch assumes 5 of each enabled ingredient receive bonus points. For example, 4 batches means up to 20 of each ingredient get bonuses through regular cooking. Instant cooks can add more.'}))+
      conditional('remainingEventMode',input('remainingFreeBonusRoundsPerIngredient','Remaining expected bonus batches per ingredient',{max:10000,hint:'Count only the batches you expect during the time left. Each batch assumes 5 of each enabled ingredient get bonus points through regular cooking. Instant cooks can add more.'}))+
      '<p class="helper" style="margin-bottom:13px">Enable bonuses you plan to use. Starting inventory applies in From now mode.</p>'+
      vectorInputs('currentIngredientInventory',INGREDIENTS,{label:'Owned',secondPath:'bonusEnabled',secondLabel:'Bonus',secondCheck:true})+
      '<p class="helper">Instant cooks add shared bonus slots, used for the largest bonuses first. All parsnip, fish, and meat are cooked.</p>')+
      advanced('Ingredient points & bag chances',
      '<h3>Points per ingredient</h3>'+vectorInputs('baseIngredientPoints',INGREDIENTS,{label:'Base',min:.001,max:100000,secondPath:'bonusPoints',secondLabel:'Bonus',secondMax:100000,step:'any'})+
      '<p class="helper">Bonus switches above still apply.</p><h3>Bag chances (%)</h3>'+
      vectorInputs('basicBagPercentages',INGREDIENTS,{label:'Basic %',max:100,secondPath:'fancyBagPercentages',secondLabel:'Fancy %',secondMax:100,step:'any'})+
      '<p class="helper">Chances are adjusted to total 100% to account for rounding.</p>')+
      advanced('Cooking resource rules',check('useEqualAmounts','Use equal fancy bags and instant cooks','This can be infeasible with the multiplier: six fancy ingredients need more than one five-item instant cook.')+
      `<div class="field-row">${input('ingredientsPerBag','Items per bag',{min:1,max:100})}${input('ingredientsPerCook','Items per free cook',{min:1,max:100})}</div>`+
      input('ingredientsPerInstantCook','Items per instant cook',{min:1,max:100})+
      '<p class="helper">During the boosted period, all fancy ingredients require instant cooking. Remaining days use basic bags and free cooks at 1×.</p>');
  }else{
    specific=advanced('Fish inventory & combos',
      '<p class="helper" style="margin-bottom:13px">Starting fish are already caught but untraded. Leftovers are fish you expect to be unable to trade at the deadline.</p>'+
      vectorInputs('currentFishInventory',COLORS,{label:'Owned',secondPath:'expectedLeftoverFish',secondLabel:'Left over'})+
      '<h3>Current combo counters</h3>'+vectorInputs('currentComboProgress',COLORS,{label:'Catches',max:999})+
      '<p class="helper">Each successful catch advances the counter by one, even though you receive two fish. Counters must be below their thresholds.</p>')+
      advanced('Golden hook preferences',select('maxHookPriorityLevel','Allowed hook colors',POLICIES.map((v,i)=>[i,v]))+
      check('allowGoldenHookPurchases','Allow buying golden hooks','The planner still prefers lower gem spending, then fewer hooks used.')+
      '<p class="helper">The search also tests every lower hook policy, including no hooks. Hooks earned from combos can be used in later combo generations.</p>')+
      advanced('Fish points & catch rates',vectorInputs('fishPointValues',COLORS,{label:'Points',secondPath:'catchRates',secondLabel:'Catch %',secondScale:100,secondMax:100,step:'any'})+
      '<h3>Spawn chances & combo thresholds</h3>'+vectorInputs('spawnPercentages',COLORS,{label:'Spawn %',max:100,secondPath:'comboThresholds',secondLabel:'Combo',secondMax:1000,step:'any'})+
      `<div class="field-row">${input('fishPerSpawn','Fish per group',{min:1,max:100})}${input('fishPerSuccessfulCatch','Fish per catch',{min:1,max:100})}</div>`+
      '<p class="helper">Spawn percentages are normalized to account for rounding. Catch rates apply without a golden hook.</p>')+
      advanced('Combo reward outcomes',
      [0,1,2].map((i)=>`<h3>Outcome ${i+1}</h3><div class="field-row">${input(`comboSpawnOutcomes.${i}`,'Fish spawned',{max:1000})}${input(`comboHookOutcomes.${i}`,'Hooks earned',{max:1000})}</div>${input(`comboOutcomeProbabilities.${i}`,'Chance %',{max:100,step:'any',scale:100})}`).join('')+
      '<p class="helper">The three chances must total 100%. Combo-spawned fish can trigger more combos.</p>');
  }
  const comparison=advanced('Compare daily activity',check('rangeMode','Compare a range of daily actions','Find out how playing more or less changes your resource budget.')+
    conditional('rangeMode',`<div class="field-row three">${input('rangeMin','From',{max:16})}${input('rangeMax','To',{max:16})}${input('rangeStep','Step',{min:1,max:16})}</div><p class="helper">Each row shows the resources and extra gems needed for that many daily actions.</p>`));
  const rules=advanced('Event length, gem costs & rewards',input('eventDays','Full event length (days)',{min:.01,max:30,step:'any'})+
    input('cooldownHours','Free action cooldown (hours)',{min:.1,max:24,step:'any'})+
    `<div class="field-row">${input(cooking?'gemsPerFancyBag':'gemsPerFishHurry',cooking?'Gems / fancy bag':'Gems / fish hurry',{min:.01,step:'any'})}${input(cooking?'gemsPerInstantCook':'gemsPerGoldenHook',cooking?'Gems / instant cook':'Gems / golden hook',{min:.01,step:'any'})}</div>`+
    `<div class="field-row">${input('pointsMultiplierCostGems','Multiplier gems',{step:'any'})}${input('pointsMultiplierDays','Multiplier days',{min:.01,max:30,step:'any'})}</div>`+
    '<p class="helper">Exact reward costs are shown below. Changes apply only to this event tab.</p>'+
    [0,1,2].map(r=>`<h3>Round ${r+1} reward costs</h3><div class="reward-inputs">${get('rewardPointCosts')[r].map((v,i)=>`<input type="number" aria-label="Round ${r+1} reward ${i+1} points" data-path="rewardPointCosts.${r}.${i}" min="0.001" max="100000" step="any" value="${esc(v)}" required>`).join('')}</div>`).join(''));
  form.innerHTML=goal+owned+boost+specific+comparison+rules;
  updateConditional();
}
function updateConditional(){form.querySelectorAll('[data-when]').forEach(el=>{
  el.hidden=!el.dataset.when.split('&').every(term=>term.startsWith('!')?!get(term.slice(1)):!!get(term));
});}
form.addEventListener('input',e=>{
  const el=e.target;if(!el.dataset.path)return;
  if(el.type==='radio'&&!el.checked)return;
  const value=el.dataset.boolean!==undefined?el.dataset.boolean==='true':el.type==='checkbox'?el.checked:el.type==='number'?el.valueAsNumber/(Number(el.dataset.scale)||1):el.dataset.number?Number(el.value):el.value;
  set(el.dataset.path,value);save();updateConditional();markStale();
});
form.addEventListener('change',e=>{if(e.target.tagName==='SELECT')e.target.dispatchEvent(new Event('input',{bubbles:true}));});
function markStale(){if(cache[eventType]){$('#result-state').textContent='Settings changed — calculate to update';$('#result-state').classList.add('stale');}}
function stopJob(){if(worker)worker.terminate();worker=null;jobType=null;$('#busy-panel').hidden=true;$('#calculate-button').innerHTML='Calculate my plan <span aria-hidden="true">✦</span>';}
function runCalculation(e){
  e?.preventDefault();if(worker){stopJob();markStale();return;}
  const invalid=[...form.querySelectorAll('input,select')].find(el=>!el.closest('[hidden]')&&!el.checkValidity());
  if(invalid){let parent=invalid.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}invalid.reportValidity();return;}
  $('#error-message').hidden=true;$('#busy-panel').hidden=false;$('#busy-message').textContent='Preparing calculation…';
  $('#calculate-button').textContent='Stop calculation';$('#result-state').textContent='Calculating your plan…';$('#result-state').classList.remove('stale');
  const type=eventType,signature=JSON.stringify(states[type]);jobType=type;
  try{worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});}catch(error){showError('Open the calculator through a website or local preview server. Browser workers do not run by double-clicking this HTML file.');stopJob();return;}
  worker.onmessage=({data})=>{
    if(data.progress){$('#busy-message').textContent=data.progress.message;return;}
    stopJob();
    if(data.error){showError(data.error);return;}
    cache[type]=data.result;signatures[type]=signature;
    activeScenario=Math.max(0,data.result.scenarios.findIndex(s=>s.config.dailyActions===JSON.parse(signature).dailyActions));
    $('#export-button').disabled=false;renderResults();
    if(signature!==JSON.stringify(states[type]))markStale();
  };
  worker.onerror=()=>{stopJob();showError('The calculation could not start. Check that all website files were uploaded, then reload and try again.');};
  worker.postMessage({type,settings:clone(states[type])});
}
form.addEventListener('submit',runCalculation);
function showError(message){$('#error-message').textContent=message;$('#error-message').hidden=false;$('#result-state').textContent='Please check your settings';}
function showToast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4500);}
function switchEvent(type){
  if(type===eventType&&form.children.length)return;
  if(worker)stopJob();eventType=type;
  activeScenario=Math.max(0,cache[type]?.scenarios.findIndex(s=>s.config.dailyActions===states[type].dailyActions)??0);
  $('#error-message').hidden=true;
  document.querySelectorAll('[data-event]').forEach(button=>{const active=button.dataset.event===type;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  $('#calculator-panel').setAttribute('aria-labelledby',`tab-${type}`);
  renderForm();
  if(cache[type]){renderResults();if(signatures[type]!==JSON.stringify(states[type]))markStale();}
  else{$('#results').innerHTML='<div class="empty-state"><span class="empty-symbol" aria-hidden="true">✦</span><h2>Let’s plan your event.</h2><p>Calculate your settings to see resources, gem costs, and reward targets.</p></div>';runCalculation();}
}
document.querySelectorAll('[data-event]').forEach(button=>{
  button.addEventListener('click',()=>switchEvent(button.dataset.event));
  button.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const type=eventType==='cooking'?'fishing':'cooking';switchEvent(type);$(`#tab-${type}`).focus();}});
});
$('#reset-button').addEventListener('click',()=>{stopJob();states[eventType]=clone(DEFAULTS[eventType]);save();renderForm();markStale();showToast(`${eventType==='cooking'?'Cooking':'Fishing'} defaults restored. Calculate to update your plan.`);});

function table(headers,rows,{rowClass=()=>'',empty='No rows to show.'}={}){
  return `<div class="table-scroll"><table><thead><tr>${headers.map((h,i)=>`<th scope="col" class="${i?'number':''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map((row,i)=>`<tr class="${rowClass(i)}">${row.map((v,j)=>`<td class="${j?'number':''}">${v}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">${empty}</td></tr>`}</tbody></table></div>`;
}
function block(title,subtitle,body,tag=''){return `<section class="result-block"><div class="block-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${tag?`<span class="tag">${tag}</span>`:''}</div>${body}</section>`;}
function chart(points,y,label,best){
  if(!points.length)return '';
  const width=640,height=220,left=60,right=23,top=15,bottom=43;
  let xmin=Math.min(...points.map(p=>p.a)),xmax=Math.max(...points.map(p=>p.a));if(xmin===xmax){xmin=Math.max(0,xmin-1);xmax=xmin+2;}
  let ymax=Math.max(...points.map(p=>p[y]),best[y],1)*1.08;
  const x=n=>left+(n-xmin)/(xmax-xmin)*(width-left-right),yp=n=>height-bottom-n/ymax*(height-top-bottom);
  const fmt=n=>n>=1000?`${num(n/1000,1)}k`:num(n,1);
  let grid='';for(let i=0;i<=4;i++){const v=ymax*i/4;grid+=`<line x1="${left}" y1="${yp(v)}" x2="${width-right}" y2="${yp(v)}" stroke="#344153" stroke-width="1"/><text x="${left-10}" y="${yp(v)+4}" text-anchor="end" fill="#a7b4c6" font-size="12">${fmt(v)}</text>`;}
  for(let i=0;i<=4;i++){const v=xmin+(xmax-xmin)*i/4;grid+=`<text x="${x(v)}" y="${height-bottom+23}" text-anchor="middle" fill="#a7b4c6" font-size="12">${num(v,0)}</text>`;}
  const path=points.map((p,i)=>`${i?'L':'M'}${x(p.a)},${yp(p[y])}`).join(' ');
  const xLabel=eventType==='cooking'?'Fancy bags used':'Fish hurries used';
  return `<div class="chart-wrap"><p class="chart-title">${label}</p><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)} against ${xLabel.toLowerCase()}. The table below contains all values.">${grid}<path d="${path}" fill="none" stroke="#bea6ff" stroke-width="2"/>${points.map(p=>`<circle class="chart-point" cx="${x(p.a)}" cy="${yp(p[y])}" r="4" fill="#bea6ff" tabindex="0" data-tip="${esc(`${num(p.a)} ${xLabel.toLowerCase().split(' used')[0]}, ${num(p[y])} ${label.toLowerCase()}`)}"><title>${num(p.a)}: ${num(p[y])}</title></circle>`).join('')}<circle cx="${x(best.a)}" cy="${yp(best[y])}" r="7" fill="#f5b477" stroke="#171f2b" stroke-width="2"><title>Recommended: ${num(best.a)}, ${num(best[y])}</title></circle><text x="${(width+left-right)/2}" y="${height-4}" text-anchor="middle" fill="#a7b4c6" font-size="12">${xLabel}</text></svg><div class="chart-tooltip" hidden></div></div>`;
}
function renderResults(){
  const all=cache[eventType];if(!all)return;
  const s=all.scenarios[activeScenario],c=s.config,p=s.best,cooking=eventType==='cooking';
  $('#export-button').disabled=false;
  $('#result-state').classList.remove('stale');$('#result-state').textContent=`${cooking?'Cooking':'Fishing'} plan · ${num(c.days)} days · ${integer(c.dailyActions)} actions/day`;
  let html='';
  if(all.scenarios.length>1)html+=`<label class="scenario-select">Explore a daily activity scenario<select id="scenario-select">${all.scenarios.map((r,i)=>`<option value="${i}" ${i===activeScenario?'selected':''}>${r.config.dailyActions} actions / day</option>`).join('')}</select></label>`;
  const done=c.remainingTarget===0;
  html+=`<div class="summary-card"><div class="summary-top"><div><div class="summary-title">${done?'TARGET ALREADY REACHED':'YOUR RECOMMENDED PLAN'}</div><h2>${done?'You’ve earned your target.':`${integer(p.a)} ${cooking?'fancy bags':'fish hurries'} + ${num(p.b)} ${cooking?'instant cooks':'golden hooks'}`}</h2><p>${done?'No additional resources or gems are needed.':`The lowest additional gem cost among the modeled resource combinations.${cooking?'':` Hook policy: ${esc(p.policy)}.`}`}</p></div><span class="estimate-badge">${done?'Complete':'Expected-value estimate'}</span></div><div class="summary-bottom"><span>Goal <strong>${c.desiredCompletions} completions</strong></span><span>Still needed <strong>${num(c.remainingTarget)} pts</strong></span><span>Expected final total <strong>${num(c.startPoints+p.score)} pts</strong></span></div></div>`;
  html+=`<div class="metric-grid"><div class="metric-card"><div class="metric-label">${cooking?'Fancy bags':'Fish hurries'} to buy</div><div class="metric-value">${integer(p.buyA)}</div><div class="metric-foot">${num(p.buyA*(cooking?c.gemsPerFancyBag:c.gemsPerFishHurry))} gems · ${cooking?c.fancyBagsOwned:c.fishHurriesOwned} owned</div></div><div class="metric-card"><div class="metric-label">${cooking?'Instant cooks':'Golden hooks'} to buy</div><div class="metric-value">${integer(p.buyB)}</div><div class="metric-foot">${num(p.buyB*(cooking?c.gemsPerInstantCook:c.gemsPerGoldenHook))} gems · ${cooking?c.instantCooksOwned:c.goldenHooksOwned} owned</div></div><div class="metric-card gem-card"><div class="metric-label">Additional gems needed</div><div class="metric-value">${num(p.totalGems)}</div><div class="metric-foot">${num(p.resourceGems)} resources + ${num(p.multiplierGems)} multiplier</div></div></div>`;
  if(!cooking&&!done){
    html+=block('Your golden hooks','Combo rewards are credited before later combo generations.',`<div class="phase-grid"><div class="phase-card">Expected hooks earned<strong>${num(p.result.hooksEarned)}</strong></div><div class="phase-card">Expected hooks left over<strong>${num(Math.max(0,c.goldenHooksOwned+p.buyB+p.result.hooksEarned-p.b))}</strong></div></div>`);
    if(s.details.some(d=>d.shortfall>1e-8))html+='<p class="warn-note">Some expected leftover reserves exceed the available fish. Those fish types contribute no trade points until their reserve is covered.</p>';
  }
  if(!done){
    const scheduleBody=`<div class="schedule-list">${s.schedule.map(d=>`<div class="schedule-row"><div class="schedule-time"><strong>${d.deadline?'Deadline':`Day ${d.day}`}</strong>${num(d.hours)} hours</div><div><div class="schedule-reward">${d.reward?`${ordinal(d.reward)} reward · Round ${d.round}`:'Before the first reward'}</div>${d.nextReward?`<span class="schedule-progress">${num(d.progress,1)}% toward the ${ordinal(d.nextReward)} reward</span>`:'<span class="schedule-progress">Final completion earned</span>'}${d.completions.map(n=>`<span class="milestone">Completion ${n}</span>`).join(' ')}</div><div class="schedule-total"><strong>${num(d.cumulative)}</strong>total points</div></div>`).join('')}</div>`;
    html+=block('Your reward schedule',c.remainingEventMode?'Checkpoints from now, including the final partial day.':'A daily pace toward your chosen completion target.',scheduleBody+`<p class="block-note">${c.usePointsMultiplier?`The first ${num(c.boostDays)} days are boosted; later earnings are at 1×. `:''}These are smooth point checkpoints, not exact login or bonus-window times.</p>`,`${num(c.days*24)} HOURS`);
  }
  if(c.usePointsMultiplier&&!done){html+=block('The multiplier window','Only points earned during the active period receive 1.5×.',`<div class="phase-grid"><div class="phase-card">First ${num(c.boostDays)} days · 1.5×<strong>${num(p.earlyPoints)} pts</strong></div><div class="phase-card">Remaining ${num(c.days-c.boostDays)} days · 1×<strong>${num(p.latePoints)} pts</strong></div></div>`);}
  if(s.tradeoffs.length){
    const graphs=chart(s.tradeoffs,'b',cooking?'Instant cooks used':'Expected golden hooks used',p)+chart(s.tradeoffs,'totalGems','Additional gems needed',p);
    html+=block('Find your resource balance','Explore the combinations. The highlighted point is your recommendation.',`<div class="chart-area">${graphs}</div><div class="chart-legend"><span><span class="legend-mark"></span>Modeled combinations</span><span><span class="legend-mark recommended"></span>Recommended</span></div><details class="details-toggle"><summary>View the trade-off table</summary>${table([cooking?'Fancy bags':'Fish hurries',cooking?'Instant cooks':'Hooks used','Expected points','Extra gems'],s.tradeoffs.map(t=>[num(t.a),num(t.b),num(t.score),num(t.totalGems)]),{rowClass:i=>s.tradeoffs[i].a===p.a&&Math.abs(s.tradeoffs[i].b-p.b)<1e-7?'recommended':''})}</details>`);
  }
  if(all.scenarios.length>1){html+=block('Daily activity comparison','Each row uses the same inventory and target.',table(['Actions / day',cooking?'Fancy bags used':'Fish hurries used',cooking?'Instant cooks used':'Golden hooks used',cooking?'Fancy bags to buy':'Fish hurries to buy',cooking?'Instant cooks to buy':'Golden hooks to buy','Extra gems'],all.scenarios.map(r=>[num(r.config.dailyActions),num(r.best.a),num(r.best.b),num(r.best.buyA),num(r.best.buyB),num(r.best.totalGems)]),{rowClass:i=>i===activeScenario?'recommended':''})+`<p class="block-note" style="padding-top:12px">Each row shows the resources and extra gems needed for that many daily actions.</p>`);}
  if(s.details.length){
    const headers=cooking?['Ingredient','Available','Used','With bonus','Without bonus','Left over','Points']:['Fish color','Catches','Fish received','Hooks used','Combos','Traded fish','Left over','Points'];
    const rows=s.details.map(d=>cooking?[esc(d.name),num(d.collected),num(d.used),num(d.bonusCooked),num(d.normalCooked),num(d.leftover),num(d.points)]:[esc(d.name),num(d.catches),num(d.received),num(d.hooked),num(d.combos),num(d.traded),num(d.leftover),num(d.points)]);
    html+=`<section class="result-block"><details class="details-toggle"><summary><div>${cooking?'Ingredient':'Fish & combo'} breakdown<small>Expected counts over the ${num(c.days)}-day planning period</small></div></summary>${table(headers,rows)}<p class="block-note" style="padding-top:14px">${cooking?'Available includes current inventory and future bags. All meat, fish, and parsnip are cooked.':'Each successful catch gives two inventory fish by default. Combo counters advance once per successful catch.'} Decimals represent model estimates.</p></details></section>`;
    const extraHeaders=cooking?['Ingredient','Starting','From basic','From fancy','Free bonus','Instant bonus','Cooked at 1.5×','Base pts','Bonus pts','Multiplier pts']:['Fish color','Spawned','Starting fish','Ending combo','Reserve shortfall','Point value'];
    const extraRows=s.details.map(d=>cooking?[esc(d.name),num(d.starting),num(d.fromBasic),num(d.fromFancy),num(d.freeBonus),num(d.instantBonus),num(d.boostedUsed),num(d.baseEarned),num(d.bonusEarned),num(d.multiplierExtra)]:[esc(d.name),num(d.spawned),num(d.starting),num(d.comboProgress),num(d.shortfall),num(d.pointsPerFish)]);
    html+=`<section class="result-block"><details class="details-toggle"><summary>Detailed accounting</summary>${table(extraHeaders,extraRows)}</details></section>`;
  }
  if(cooking&&s.bagAverages){html+=`<section class="result-block"><details class="details-toggle"><summary><div>Average bag points<small>Base points at 1×, excluding limited bonuses</small></div></summary>${table(['Bag','Per ingredient',`${c.ingredientsPerBag} items`,`One batch`],s.bagAverages.map(b=>[b.name,num(b.one),num(b.six),num(b.five)]))}</details></section>`;}
  if(!cooking&&s.policySummary?.length){html+=`<section class="result-block"><details class="details-toggle"><summary>Compare golden hook policies</summary>${table(['Allowed hook colors','Hurries','Hooks used','Hooks to buy','Extra gems'],s.policySummary.map(t=>[esc(t.policy),num(t.a),num(t.b),num(t.buyB),num(t.totalGems)]))}<p class="block-note" style="padding-top:13px">Best tested plan per policy, within the no-hook spending ceiling.</p></details></section>`;}
  html+=`<section class="result-block"><details class="details-toggle"><summary>What this assumes</summary><div class="advanced-body">${assumptions(eventType)}</div></details></section>`;
  $('#results').innerHTML=html;
  $('#scenario-select')?.addEventListener('change',e=>{activeScenario=Number(e.target.value);renderResults();if(signatures[eventType]!==JSON.stringify(states[eventType]))markStale();});
  attachTooltips();
}
function assumptions(type){return type==='cooking'?`<p class="helper">All six ingredients from each bag are kept. The calculator uses higher-point ingredients first and saves some for bonuses. If the multiplier is enabled, fancy bags and instant cooks are used before it expires.</p>`:`<p class="helper">Each catch gives two fish. The calculator includes combo rewards and uses golden hooks on higher-value fish first. Fish entered as leftovers don’t count toward your points.</p>`;}
function attachTooltips(){document.querySelectorAll('.chart-point').forEach(point=>{
  const wrap=point.closest('.chart-wrap'),tip=wrap.querySelector('.chart-tooltip');
  const show=()=>{tip.textContent=point.dataset.tip;tip.hidden=false;const a=point.getBoundingClientRect(),b=wrap.getBoundingClientRect();tip.style.left=`${Math.min(Math.max(0,a.left-b.left-90),Math.max(0,b.width-230))}px`;tip.style.top=`${Math.max(0,a.top-b.top-44)}px`;};
  point.addEventListener('pointerenter',show);point.addEventListener('focus',show);
  point.addEventListener('pointerleave',()=>tip.hidden=true);point.addEventListener('blur',()=>tip.hidden=true);
});}
$('#share-button').addEventListener('click',async()=>{
  const payload=JSON.stringify({version:1,type:eventType,settings:states[eventType]});
  const encoded=btoa(String.fromCharCode(...new TextEncoder().encode(payload))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const url=new URL(location.href);url.hash=new URLSearchParams({plan:encoded}).toString();
  try{await navigator.clipboard.writeText(url.href);showToast('Settings link copied. It recreates your inputs, not your game account.');}
  catch{const text=prompt('Copy this settings link:',url.href);if(text)showToast('Your settings link is ready to share.');}
});
$('#export-button').addEventListener('click',async()=>{
  const all=cache[eventType];if(!all)return;
  const selected=activeScenario,type=eventType,button=$('#export-button');
  button.disabled=true;button.textContent='Preparing spreadsheet…';
  try{
    const {createSpreadsheet}=await import('./spreadsheet.mjs');
    const bytes=createSpreadsheet(all,selected);
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const link=document.createElement('a');link.href=url;link.download=`hatchdragons-${type}-plan.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    showToast('Spreadsheet downloaded.');
  }catch(error){showError('Could not create the spreadsheet. '+error.message);}
  finally{button.disabled=!cache[eventType];button.textContent='Download Spreadsheet';}
});
$('#help-content').innerHTML=`<p>Choose your event, enter your goal and the resources you have, then click <strong>Calculate my plan</strong>. The calculator looks for the cheapest way to reach your goal.</p><h3>Already started?</h3><p>Choose <strong>From now</strong> and enter your time left and current progress. Your completion goal includes rounds you’ve already finished.</p><h3>Cooking</h3>${assumptions('cooking')}<h3>Fishing</h3>${assumptions('fishing')}<h3>Saving and sharing</h3><p>Your settings are saved on this device. Use <strong>Share settings</strong> to send someone your inputs, or <strong>Reset</strong> to start over.</p><p style="margin-top:18px">Results are estimates. Your actual rewards and progress may vary.</p>`;
$('#help-button').addEventListener('click',()=>$('#help-dialog').showModal());
$('#close-help').addEventListener('click',()=>$('#help-dialog').close());
$('#help-dialog').addEventListener('click',e=>{if(e.target===$('#help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
// Force first render even when the shared link selects cooking.
const initial=eventType;eventType='';switchEvent(initial);
