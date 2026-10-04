import { TASKS, OverloadRun, resolveOverloadSettings } from './overload-core.mjs?v=20261003-accounts';
const names=Object.fromEntries(TASKS.map(t=>[t.id,t.name]));
const fmt=v=>v===null?'—':String(Number(Number(v).toFixed(2)));
const el=(tag,text,cls)=> {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,action)=> {const b=el('button',text);b.type='button';b.addEventListener('click',action);return b;};
const taskHints={math:['＋','Solve quick calculations'],shapes:['◆','Find the matching shapes'],ball:['●','Catch the falling ball'],color:['◉','Name the ink color'],arrows:['↔','Choose the opposite direction'],wires:['⌁','Connect matching wires'],pattern:['▦','Repeat the sequence'],cards:['▣','Remember matching cards'],mole:['◎','Find the mole']};

export function createOverloadUI({onSave,onHistory,showScreen}) {
  const setup=document.getElementById('overload-setup-options'),screen=document.getElementById('overload-screen');
  const fields={};let run=null,timer=null,pausedAt=null,pauseOffset=0,lastSaved=0,active=null,finished=false,audio=null;
  const clock=()=>(pausedAt ?? performance.now())-pauseOffset;
  function setting(id,label,kind,options,value,min,max) {
    const wrap=el('label',label),input=el(kind==='select'?'select':'input');input.id=`overload-${id}`;
    if(kind==='select') Object.entries(options).forEach(([v,t])=>input.append(new Option(t,v)));
    else {input.type=kind;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;if(kind==='checkbox')input.checked=value;}
    if(kind!=='checkbox')input.value=value;wrap.append(input);fields[id]=input;return wrap;
  }
  setup.append(el('p','Keep each task accurate while other deadlines continue. Alt+1–9 focuses a panel.','setup-note'));
  const modeSection=el('section',undefined,'multitasker-setup-section');modeSection.append(el('h3','1 · Choose a mode'),el('p','Standard ends after one mistake. Practice has unlimited mistakes. Endurance and Custom use the mistake limit below.','setup-note'));
  const modeRow=el('div',undefined,'multitasker-mode-row');modeRow.append(setting('mode','Mode','select',{standard:'Standard · one mistake',practice:'Practice · unlimited mistakes',endurance:'Endurance · survival',custom:'Custom'},'standard'));modeSection.append(modeRow);setup.append(modeSection);
  const paceSection=el('section',undefined,'multitasker-setup-section');paceSection.append(el('h3','2 · Set the pace'));
  const form=el('div',undefined,'form-grid');paceSection.append(form);setup.append(paceSection);
  form.append(setting('startingTasks','Tasks at start','number',null,2,1,9),setting('maxTasks','Maximum active tasks','number',null,9,1,9),
    setting('startingDifficulty','Starting difficulty','number',null,1,1,12),setting('timerSeconds','Base deadline · seconds','number',null,12,3,60),
    setting('speed','Movement / timer speed','number',null,1,.5,3),setting('increaseEvery','Raise difficulty every N points','number',null,5,1,100),
    setting('allowedMistakes','Mistakes allowed · Endurance / Custom','number',null,2,0,100),setting('durationSeconds','Session duration · seconds (0 = no limit)','number',null,0,0,3600));fields.speed.step='.1';
  const optionsSection=el('section',undefined,'multitasker-setup-section');optionsSection.append(el('h3','3 · Choose game effects'));
  const toggles=el('div',undefined,'overload-toggles');optionsSection.append(toggles);setup.append(optionsSection);
  toggles.append(setting('autoAdd','Add tasks as difficulty rises','checkbox',null,true),setting('unlockAll','Unlock selected games immediately','checkbox',null,false),setting('visualDistractions','Visual warnings and distractions','checkbox',null,false),setting('sound','Sound cues and distractions','checkbox',null,false));
  optionsSection.append(el('p','When immediate unlock is on, the scores below are saved but do not delay games in this run.','setup-note'));
  const choices=el('section',undefined,'multitasker-setup-section');choices.append(el('h3','4 · Select mini-games'),el('p','Turn games on or off. Unlock score is the score needed before a game can appear.','setup-note'));setup.append(choices);
  const selection=el('div',undefined,'overload-task-selection'),included={},unlocks={};choices.append(selection);
  for(const task of TASKS) {
    const row=el('article',undefined,'multitasker-task-card'),label=el('label',undefined,'multitasker-task-toggle'),check=el('input');check.type='checkbox';check.checked=true;check.value=task.id;check.id=`overload-include-${task.id}`;included[task.id]=check;
    const icon=el('span',taskHints[task.id][0],'multitasker-task-icon'),copy=el('span',undefined,'multitasker-task-copy');copy.append(el('strong',task.name),el('small',taskHints[task.id][1]));const state=el('span','Enabled','multitasker-task-state');label.append(check,icon,copy,state);
    const unlockLabel=el('label',undefined,'multitasker-unlock');unlockLabel.append(document.createTextNode('Unlock score'));
    const limit=el('input');limit.type='number';limit.min=0;limit.max=1000;limit.value=task.unlock;limit.id=`overload-unlock-${task.id}`;unlocks[task.id]=limit;unlockLabel.append(limit);
    const hint=el('span',task.unlock===0?'Starts immediately':`Unlock at ${task.unlock}`,'multitasker-unlock-hint');limit.addEventListener('input',()=>{hint.textContent=Number(limit.value)===0?'Starts immediately':`Unlock at ${limit.value||'—'}`;});
    check.addEventListener('change',()=>{row.classList.toggle('is-disabled',!check.checked);state.textContent=check.checked?'Enabled':'Disabled';});row.append(label,unlockLabel,hint);selection.append(row);
  }
  fields.mode.addEventListener('change',()=> {fields.unlockAll.checked=['practice','custom'].includes(fields.mode.value);fields.durationSeconds.value=fields.mode.value==='practice'?'120':'0';});
  const summary=el('p','','multitasker-setup-summary');choices.prepend(summary);
  function describeSetup(){
    const count=TASKS.filter(task=>included[task.id].checked).length;
    const mistakes=fields.mode.value==='practice'?'Unlimited mistakes':fields.mode.value==='standard'?'Ends on the first mistake':`${fields.allowedMistakes.value} mistakes allowed`;
    fields.allowedMistakes.disabled=['practice','standard'].includes(fields.mode.value);
    summary.textContent=`${count} mini-games enabled · ${mistakes} · ${Number(fields.durationSeconds.value)?fields.durationSeconds.value+' second session':'No session time limit'}`;
  }
  setup.addEventListener('input',describeSetup);setup.addEventListener('change',describeSetup);describeSetup();
  const scoreboard=el('div',undefined,'overload-scoreboard'),status=el('p','Ready','overload-status'),controls=el('div',undefined,'overload-controls'),grid=el('div',undefined,'overload-grid'),result=el('section',undefined,'overload-result');result.hidden=true;
  status.setAttribute('role','status');const pause=button('Pause',()=>togglePause()),stop=button('End run',()=>end('stopped')),again=button('Another run',()=>start()),history=button('History / Progress',()=>{end('stopped');onHistory();});
  controls.append(pause,stop,again,history);again.hidden=true;
  screen.append(el('h2','Multitasker'),scoreboard,status,controls,grid,result);
  const cards=new Map();
  function readSettings() {
    const values=Object.fromEntries(Object.entries(fields).map(([k,n])=>[k,n.type==='checkbox'?n.checked:n.tagName==='SELECT'?n.value:Number(n.value)]));
    return resolveOverloadSettings({...values,included:TASKS.filter(t=>included[t.id].checked).map(t=>t.id),unlocks:Object.fromEntries(TASKS.map(t=>[t.id,Number(unlocks[t.id].value)]))});
  }
  function applySettings(settings) {
    for(const [key,value] of Object.entries(settings)) {
      const input=fields[key];
      if(input) {if(input.type==='checkbox')input.checked=Boolean(value);else input.value=value;}
    }
    for(const task of TASKS) {
      if(settings.included)included[task.id].checked=settings.included.includes(task.id);
      if(settings.unlocks?.[task.id]!==undefined)unlocks[task.id].value=settings.unlocks[task.id];
      included[task.id].dispatchEvent(new Event('change'));unlocks[task.id].dispatchEvent(new Event('input'));
    }
    describeSetup();
  }
  function save() {if(run){onSave(run.record(clock()));lastSaved=clock();}}
  function beep(error=false) {if(!run?.settings.sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();void audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=error?180:560;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.13);}catch{}}
  function respond(p,answer,trialId) {if(pausedAt!==null)return;const event=run.respond(p.id,answer,clock(),trialId);if(event){beep(!event.correct);save();draw();}if(run.ended)finish();}
  function focus(p) {active=p.id;run.switchTo(p.task);for(const [id,card]of cards)card.classList.toggle('overload-focused',id===active);}
  function renderPanel(p,now) {
    let card=cards.get(p.id);if(!card){card=el('article',undefined,'overload-panel');card.dataset.panelId=p.id;card.dataset.task=p.task;card.tabIndex=0;card.addEventListener('focusin',()=>focus(p));card.addEventListener('pointerdown',()=>focus(p));cards.set(p.id,card);grid.append(card);}
    const t=p.trial,study=now<t.answerAt;
    if(card.dataset.trialId===t.id&&card.dataset.study===String(study))return;
    const wasFocused=card.contains(document.activeElement);card.replaceChildren();card.dataset.trialId=t.id;card.dataset.study=String(study);card.selection=[];card.connections=[];
    const header=el('div',undefined,'overload-panel-header'),identity=el('div',undefined,'overload-panel-identity');
    identity.append(el('span',taskHints[p.task][0],'overload-panel-icon'),el('h3',`${run.panels.indexOf(p)+1}. ${names[p.task]}`));
    const remaining=el('span','', 'overload-remaining'),bar=el('progress');bar.max=1;bar.value=1;bar.setAttribute('aria-label',`${names[p.task]} remaining time`);
    header.append(identity,remaining);card.append(header,bar);const prompt=el('p',t.prompt,'overload-prompt');card.append(prompt);
    const content=el('div',undefined,'overload-task-content');card.append(content);
    if(p.task==='math') {
      const form=el('form'),input=el('input'),submit=el('button','Answer');input.type='text';input.inputMode='numeric';input.setAttribute('aria-label','Math answer');submit.type='submit';form.append(input,submit);form.addEventListener('submit',e=>{e.preventDefault();respond(p,input.value,t.id);});content.append(form);
    } else if(p.task==='color'||p.task==='arrows') {
      if(p.task==='color') {prompt.style.color={red:'#c33131',blue:'#2467c0',green:'#227044',gold:'#8d6900'}[t.raw.displayColor];prompt.classList.add('overload-color-word');card.append(el('p','Choose the INK color, regardless of the word.','setup-note'));}
      else prompt.textContent={up:'↑',down:'↓',left:'←',right:'→'}[t.prompt];
      t.choices.forEach(v=>content.append(button(v,()=>respond(p,v,t.id))));
    } else if(p.task==='ball') {
      const field=el('div',undefined,'overload-ball-field'),ball=el('span','●','overload-ball'),catcher=el('span','▰','overload-catcher');field.append(ball,catcher);content.append(field);
      for(let lane=0;lane<5;lane++)content.append(button(String(lane+1),()=> {run.move(p.id,lane,clock());focus(p);updateClocks();}));
      card.append(el('p','Left / Right move one lane. The ball is judged automatically when it lands.','setup-note'));
    } else if(p.task==='shapes'||p.task==='cards') {
      if(p.task==='cards') prompt.textContent=study?'Study the card locations.':'Reveal any matching pair.';
      t.choices.forEach((value,i)=>{const b=button(p.task==='cards'?(study?value:'?'):value,()=> {
        if(clock()<t.answerAt||card.selection.includes(i))return;
        card.selection.push(i);b.setAttribute('aria-pressed','true');if(p.task==='cards')b.textContent=value;
        if(card.selection.length===2)respond(p,[...card.selection],t.id);
      });b.setAttribute('aria-label',p.task==='cards'?`Card ${i+1}`:`Shape ${i+1}: ${value}`);b.dataset.choice=i;b.disabled=study&&p.task==='cards';content.append(b);});
    } else if(p.task==='wires') {
      const columns=el('div',undefined,'overload-wires'),left=el('div'),right=el('div');columns.append(left,right);content.append(columns);let selected=null;
      t.raw.left.forEach((v,i)=>left.append(button(`Left ${v}`,e=> {selected=i;status.textContent=`${names[p.task]}: connect ${v} to the matching right label.`;})));
      t.raw.right.forEach((v,i)=>right.append(button(`Right ${v}`,()=> {
        if(selected===null)return;
        if(t.raw.left[selected]!==v){const incorrect=[...t.expected];incorrect[selected]=i;respond(p,incorrect,t.id);return;}
        card.connections[selected]=i;left.children[selected].disabled=true;right.children[i].disabled=true;selected=null;
        if(card.connections.filter(v=>v!==undefined).length===t.raw.wireCount)respond(p,[...card.connections],t.id);
      })));
    } else if(p.task==='pattern') {
      prompt.textContent=study?`Study: ${t.expected.map(v=>v+1).join(' → ')}`:'Repeat the memorized sequence.';
      const entered=el('p','Entered: —');content.append(entered);
      t.choices.forEach((value,i)=> {const b=button(value,()=> {card.selection.push(i);entered.textContent='Entered: '+card.selection.map(v=>v+1).join(' → ');if(card.selection.length===t.expected.length)respond(p,[...card.selection],t.id);});b.disabled=study;content.append(b);});
    } else {
      content.classList.add('overload-moles');t.choices.forEach(i=> {const b=button(!study&&i===t.expected?'●':'·',()=>respond(p,i,t.id));b.setAttribute('aria-label',`Mole position ${i+1}`);b.dataset.choice=i;b.classList.toggle('mole-target',!study&&i===t.expected);b.disabled=study;content.append(b);});
    }
    if(wasFocused){const target=card.querySelector('input,button:not(:disabled)')??card;target.focus({preventScroll:true});}
  }
  function updateClocks() {
    if(!run)return;const now=clock();
    for(const p of run.panels){renderPanel(p,now);const card=cards.get(p.id),t=p.trial,study=now<t.answerAt,remaining=Math.max(0,(t.deadline-now)/1000);
      card.querySelector('.overload-remaining').textContent=study?`Study / wait: ${fmt((t.answerAt-now)/1000)}s`:`${fmt(remaining)}s remaining`;
      card.querySelector('progress').value=Math.max(0,(t.deadline-now)/(t.deadline-t.startedAt));card.classList.toggle('overload-urgent',!study&&remaining<3);
      if(p.task==='ball'){const y=Math.min(1,(now-t.startedAt)/(t.deadline-t.startedAt));card.querySelector('.overload-ball').style.cssText=`left:${t.expected*20+10}%;top:${y*76}%;`;card.querySelector('.overload-catcher').style.left=`${t.raw.catchPosition*20+10}%`;}
    }
    scoreboard.textContent=`Score ${run.score} · Difficulty ${run.difficulty} · Active ${run.panels.length}/${run.settings.maxTasks} · ${run.settings.allowedMistakes===null?'Unlimited practice lives':Math.max(0,run.settings.allowedMistakes+1-run.errors)+' lives'} · ${fmt((now-run.startedAt)/1000)}s`;
    const urgent=run.urgent(now);if(urgent.length>1)status.textContent=`Overlapping pressure: ${urgent.map(p=>names[p.task]).join(' + ')}`;
  }
  function draw(){grid.dataset.count=run.panels.length;grid.classList.toggle('overload-distractions',run.settings.visualDistractions);updateClocks();}
  function tick(){if(pausedAt!==null||!run||run.ended)return;const count=run.events.length,pressure=run.pressureEvents.length;run.advance(clock());draw();if(run.pressureEvents.length>pressure)beep(true);if(run.events.length!==count||clock()-lastSaved>5000)save();if(run.ended)finish();}
  function togglePause(){if(!run||run.ended)return;if(pausedAt===null){pausedAt=performance.now();pause.textContent='Resume';grid.inert=true;status.textContent='Paused · all task clocks stopped';save();}else{pauseOffset+=performance.now()-pausedAt;pausedAt=null;pause.textContent='Pause';grid.inert=false;draw();}}
  function end(reason){if(!run||run.ended)return;if(pausedAt!==null)togglePause();run.advance(clock());run.finish(reason,null,clock());finish();}
  function finish(){if(finished)return;finished=true;clearInterval(timer);save();grid.inert=true;pause.hidden=true;stop.hidden=true;again.hidden=false;audio?.close().catch(()=>{});audio=null;
    const r=run.record(clock());result.hidden=false;result.replaceChildren(el('h3',run.endingReason==='mistake'?'Run ended on a mistake':'Run complete'),el('p',`Score ${r.overloadScore} · Accuracy ${fmt(r.overloadAccuracy)}% · ${fmt(r.overloadDuration)}s survival · ${r.overloadErrors} errors · Peak ${r.overloadPeakTasks} tasks`));
    if(run.events.length){const last=run.events.at(-1);result.append(el('p',`${names[last.task]}: expected ${JSON.stringify(last.expected)}; entered ${JSON.stringify(last.answer)}. ${last.errorCause??'Correct action'}.`));}
    status.textContent=`${run.endingReason} · activity saved to History / Progress`;result.scrollIntoView({block:'nearest'});
  }
  function start(){let settings;try{settings=readSettings();}catch(error){status.textContent=error.message;setup.append(el('p',error.message,'setup-note'));return;}clearInterval(timer);pauseOffset=0;pausedAt=null;finished=false;run=new OverloadRun(settings,Math.random,clock());cards.clear();grid.replaceChildren();grid.inert=false;pause.hidden=false;pause.textContent='Pause';stop.hidden=false;again.hidden=true;result.hidden=true;showScreen('overload');save();draw();timer=setInterval(tick,100);grid.firstElementChild?.focus();}
  screen.addEventListener('keydown',e=> {
    if(!run||run.ended||pausedAt!==null)return;
    if(e.altKey&&/^[1-9]$/.test(e.key)){e.preventDefault();grid.children[Number(e.key)-1]?.focus();return;}
    const p=run.panels.find(p=>p.id===active);if(!p)return;
    if(p.task==='ball'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();run.move(p.id,p.trial.raw.catchPosition+(e.key==='ArrowLeft'?-1:1),clock());updateClocks();}
    else if(p.task==='arrows'&&e.key.startsWith('Arrow')){e.preventDefault();respond(p,e.key.slice(5).toLowerCase(),p.trial.id);}
    else if(['shapes','cards','pattern','mole'].includes(p.task)&&/^[1-9]$/.test(e.key)){e.preventDefault();const card=cards.get(p.id),choices=[...card.querySelectorAll('.overload-task-content button')];choices[Number(e.key)-1]?.click();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&run&&!run.ended&&pausedAt===null)togglePause();});
  window.addEventListener('pagehide',()=>{if(run&&!run.ended)save();});
  return {start,readSettings,applySettings,get settings(){return run?.settings??readSettings();},stop:()=>end('stopped')};
}
