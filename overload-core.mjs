export const TASKS = Object.freeze([
  {id:'math',name:'Math Challenge',unlock:0,error:'Math mistake'},
  {id:'shapes',name:'Shape Duplicate',unlock:0,error:'Wrong duplicate'},
  {id:'ball',name:'Falling Ball',unlock:0,error:'Missed ball'},
  {id:'color',name:'Color Match',unlock:0,error:'Color interference error'},
  {id:'arrows',name:'Opposite Arrows',unlock:20,error:'Wrong arrow direction'},
  {id:'wires',name:'Connect Wires',unlock:40,error:'Wire mismatch'},
  {id:'pattern',name:'Pattern Memory',unlock:60,error:'Pattern-memory error'},
  {id:'cards',name:'Memory Cards',unlock:80,error:'Card-memory error'},
  {id:'mole',name:'Whack-a-Mole',unlock:100,error:'Missed mole'},
]);
const byId = Object.fromEntries(TASKS.map(task=>[task.id,task]));
const bounded=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const integer=(v,f,min,max)=>Math.round(bounded(v,f,min,max));
const pick=(random,values)=>values[Math.min(values.length-1,Math.floor(random()*values.length))];
const shuffle=(values,random)=> {const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
let trialId=0,runId=0;
export function resolveOverloadSettings(input={}) {
  const mode=['standard','practice','endurance','custom'].includes(input.mode)?input.mode:'standard';
  const included=[...new Set((input.included??TASKS.map(t=>t.id)).filter(id=>byId[id]))];
  if(!included.length) throw new Error('Choose at least one mini-game.');
  const maxTasks=integer(input.maxTasks,9,1,Math.min(9,included.length));
  return {mode,included,maxTasks,startingTasks:integer(input.startingTasks,Math.min(2,maxTasks),1,maxTasks),
    startingDifficulty:integer(input.startingDifficulty,1,1,12),increaseEvery:integer(input.increaseEvery,5,1,100),
    timerSeconds:bounded(input.timerSeconds,12,3,60),speed:bounded(input.speed,1,.5,3),
    allowedMistakes:mode==='standard'?0:mode==='practice'?null:integer(input.allowedMistakes,mode==='endurance'?2:3,0,100),
    autoAdd:input.autoAdd!==false,unlockAll:input.unlockAll ?? (mode==='practice'||mode==='custom'),
    visualDistractions:input.visualDistractions===true,sound:input.sound===true,
    durationSeconds:integer(input.durationSeconds,mode==='practice'?120:0,0,3600),
    unlocks:Object.fromEntries(TASKS.map(t=>[t.id,integer(input.unlocks?.[t.id],t.unlock,0,1000)])),
  };
}

export function createTrial(task,difficulty,settings,random=Math.random,now=0) {
  if(!byId[task]) throw new Error('Unknown mini-game.');
  const level=Math.max(1,difficulty),pressure=Math.max(.32,1/(1+(level-1)*.09));
  const duration=Math.max(1800,settings.timerSeconds*1000*pressure/settings.speed);
  const trial={id:`trial-${++trialId}`,task,startedAt:now,answerAt:now,deadline:now+duration,expected:null,raw:{},prompt:'',choices:[]};
  if(task==='math') {
    const max=Math.min(99,8+level*4),a=integer(random()*max,1,1,max),b=integer(random()*max,1,1,max),op=level>=3?pick(random,['+','−','×']):pick(random,['+','−']);
    trial.expected=op==='+'?a+b:op==='−'?a-b:a*b;trial.prompt=`${a} ${op} ${b}`;trial.raw={problemType:op,operands:[a,b]};
  } else if(task==='shapes') {
    const count=Math.min(9,4+Math.floor(level/2)),pool=shuffle(['●','▲','■','◆','★','⬟','✚','☾'],random).slice(0,count-1);
    const shapes=shuffle([...pool,pool[0]],random);trial.expected=shapes.map((s,i)=>s===pool[0]?i:null).filter(i=>i!==null);
    trial.prompt='Select the two identical shapes.';trial.choices=shapes;trial.raw={shapeCount:count,shapes,correctPair:trial.expected};
  } else if(task==='ball') {
    trial.expected=Math.floor(random()*5);trial.prompt='Move the catcher into the landing lane.';
    trial.answerAt=now+duration*.9;trial.raw={ballSpeed:1/(duration/1000),landingLane:trial.expected,lanes:5,catchPosition:2,movements:[]};
  } else if(task==='color') {
    const colors=['red','blue','green','gold'];const word=pick(random,colors),ink=pick(random,colors);
    trial.expected=ink;trial.prompt=word;trial.choices=colors;trial.raw={word,displayColor:ink,congruent:word===ink};
  } else if(task==='arrows') {
    const opposite={up:'down',down:'up',left:'right',right:'left'},shown=pick(random,Object.keys(opposite));
    trial.expected=opposite[shown];trial.prompt=shown;trial.choices=Object.keys(opposite);trial.raw={shownDirection:shown};
  } else if(task==='wires') {
    const count=Math.min(5,2+Math.floor(level/3)),left=shuffle(['A','B','C','D','E'].slice(0,count),random),right=shuffle(left,random);
    trial.expected=left.map(name=>right.indexOf(name));trial.prompt='Connect matching labels, left to right.';
    trial.choices=left;trial.raw={wireCount:count,left,right,correctConnections:trial.expected};
  } else if(task==='pattern') {
    const length=Math.min(9,2+Math.floor(level/2)),pattern=Array.from({length},()=>Math.floor(random()*4));
    trial.expected=pattern;trial.prompt='Study the sequence, then repeat it.';trial.choices=['1','2','3','4'];
    trial.answerAt=now+Math.max(1800,length*650);trial.deadline=trial.answerAt+duration;trial.raw={patternLength:length,expectedSequence:pattern};
  } else if(task==='cards') {
    const pairs=Math.min(6,2+Math.floor(level/3)),deck=shuffle(Array.from({length:pairs},(_,i)=>[String.fromCharCode(65+i),String.fromCharCode(65+i)]).flat(),random);
    const locations=Array.from({length:pairs},(_,i)=>deck.map((v,j)=>v===String.fromCharCode(65+i)?j:null).filter(v=>v!==null));
    trial.expected=locations[0];trial.prompt='Study the cards, then reveal a matching pair.';trial.choices=deck;
    trial.answerAt=now+Math.max(1800,deck.length*350);trial.deadline=trial.answerAt+duration;trial.raw={cardCount:deck.length,pairLocations:locations,deck};
  } else {
    trial.expected=Math.floor(random()*9);trial.prompt='Hit the highlighted mole.';trial.choices=Array.from({length:9},(_,i)=>i);
    trial.answerAt=now+300+random()*400;trial.deadline=trial.answerAt+Math.max(1400,duration*.45);trial.raw={spawnPosition:trial.expected,visibilityDuration:(trial.deadline-trial.answerAt)/1000};
  }
  return trial;
}

export class OverloadRun {
  constructor(settings={},random=Math.random,now=0) {
    this.settings=resolveOverloadSettings(settings);this.random=random;this.startedAt=now;this.lastAt=now;this.ended=false;this.endingReason=null;this.endingTask=null;
    this.sessionId=`overload-${Date.now()}-${++runId}`;this.timestamp=new Date().toISOString();this.score=0;this.errors=0;this.difficulty=this.settings.startingDifficulty;
    this.panels=[];this.events=[];this.difficultyChanges=[];this.unlockEvents=[];this.pressureEvents=[];this.switches=0;this.lastTask=null;this.lastPressureKey='';this.peakTasks=0;this.taskTimeArea=0;
    this.unlocked=new Set();this.updateUnlocks(now);this.ensurePanels(this.settings.startingTasks,now);
  }
  updateUnlocks(now) {
    for(const task of this.settings.included) if(!this.unlocked.has(task)&&(this.settings.unlockAll||this.score>=this.settings.unlocks[task])) {this.unlocked.add(task);this.unlockEvents.push({task,score:this.score,at:(now-this.startedAt)/1000});}
    // An excluded early task must not leave a selected late-task practice run empty.
    if(!this.unlocked.size) {const task=this.settings.included[0];this.unlocked.add(task);this.unlockEvents.push({task,score:this.score,at:0,selectedStarter:true});}
  }
  ensurePanels(count,now) {
    for(const task of this.settings.included.filter(t=>this.unlocked.has(t))) {
      if(this.panels.length>=Math.min(count,this.settings.maxTasks)) break;
      if(!this.panels.some(p=>p.task===task)) this.panels.push({id:`panel-${task}`,task,trial:createTrial(task,this.difficulty,this.settings,this.random,now)});
    }
    this.peakTasks=Math.max(this.peakTasks,this.panels.length);
  }
  urgent(now) {return this.panels.filter(p=>now>=p.trial.answerAt&&p.trial.deadline-now<=Math.min(3000,(p.trial.deadline-p.trial.answerAt)*.3));}
  advance(now) {
    if(this.ended) return;
    now=Math.max(this.lastAt,now);const durationEnd=this.settings.durationSeconds?this.startedAt+this.settings.durationSeconds*1000:Infinity;
    const effective=Math.min(now,durationEnd);this.taskTimeArea+=(effective-this.lastAt)*this.panels.length;this.lastAt=effective;
    const urgent=this.urgent(effective),key=urgent.map(p=>p.id+':'+p.trial.id).sort().join('|');
    if(urgent.length>1&&key!==this.lastPressureKey) this.pressureEvents.push({at:(effective-this.startedAt)/1000,tasks:urgent.map(p=>p.task)});
    this.lastPressureKey=key;
    // Process expiration order, rather than panel-array order, during delayed frames.
    for(const panel of [...this.panels].sort((a,b)=>a.trial.deadline-b.trial.deadline)) {
      if(this.ended) break;
      if(panel.trial.deadline<=effective) {
        const t=panel.trial,catchBall=panel.task==='ball'&&t.raw.catchPosition===t.expected;
        this.complete(panel,panel.task==='ball'?t.raw.catchPosition:null,catchBall,t.deadline,!catchBall,true,urgent.map(p=>p.task));
      }
    }
    if(!this.ended&&now>=durationEnd) this.finish('duration',null,durationEnd);
  }
  move(panelId,lane,now) {
    this.advance(now);
    const p=this.panels.find(p=>p.id===panelId);if(this.ended||p?.task!=='ball') return;
    p.trial.raw.catchPosition=Math.max(0,Math.min(4,Number(lane)));p.trial.raw.movements.push({lane:p.trial.raw.catchPosition,at:(now-p.trial.startedAt)/1000});
    this.switchTo(p.task);
  }
  switchTo(task) {if(this.lastTask&&this.lastTask!==task) this.switches++;this.lastTask=task;}
  respond(panelId,answer,now,expectedTrialId=null) {
    if(this.ended) return null;
    const p=this.panels.find(p=>p.id===panelId);if(!p||expectedTrialId&&p.trial.id!==expectedTrialId||now<p.trial.answerAt) return null;
    const trial=p.trial;this.advance(now);if(this.ended||p.trial!==trial) return null;
    let correct;
    if(p.task==='math') correct=String(answer).trim()!==''&&Number(answer)===trial.expected;
    else if(['shapes','cards'].includes(p.task)) {
      correct=Array.isArray(answer)&&answer.length===2&&answer[0]!==answer[1]&&answer.every(i=>Number.isInteger(i)&&i>=0&&i<trial.choices.length);
      correct=correct&&(p.task==='cards'?trial.choices[answer[0]]===trial.choices[answer[1]]:JSON.stringify([...answer].sort((a,b)=>a-b))===JSON.stringify(trial.expected));
    } else correct=JSON.stringify(answer)===JSON.stringify(trial.expected);
    this.switchTo(p.task);
    return this.complete(p,answer,correct,now,false,false,this.urgent(now).map(p=>p.task));
  }
  complete(p,answer,correct,now,expired,automatic,urgentTasks) {
    const t=p.trial,responseTime=(now-t.answerAt)/1000,overlap=urgentTasks.length>1;
    const event={task:p.task,trialId:t.id,at:(now-this.startedAt)/1000,correct,expired,automatic,expected:p.task==='cards'&&correct?answer:t.expected,answer,responseTimeSeconds:Math.max(0,responseTime),
      difficulty:this.difficulty,deadlineSeconds:(t.deadline-t.answerAt)/1000,activeTasks:this.panels.map(p=>p.task),taskCount:this.panels.length,overlap,urgentTasks,ignored:expired&&this.lastTask!==p.task,rushed:!correct&&!expired&&responseTime<.75,
      errorCause:correct?null:expired&&p.task!=='ball'?'Timeout':byId[p.task].error,raw:JSON.parse(JSON.stringify(t.raw))};
    if(p.task==='pattern') event.positionErrors=t.expected.map((v,i)=>answer?.[i]===v?null:i).filter(i=>i!==null);
    if(p.task==='cards') event.raw.wrongFlips=correct?0:Array.isArray(answer)?answer.length:0;
    this.events.push(event);if(correct) this.score++;else this.errors++;
    if(!correct&&this.settings.allowedMistakes!==null&&this.errors>this.settings.allowedMistakes) {this.finish('mistake',p.task,now);return event;}
    const next=this.settings.startingDifficulty+Math.floor(this.score/this.settings.increaseEvery);
    if(next!==this.difficulty) {this.difficulty=next;this.difficultyChanges.push({score:this.score,difficulty:next,at:event.at});}
    this.updateUnlocks(now);p.trial=createTrial(p.task,this.difficulty,this.settings,this.random,Math.max(now,this.lastAt));
    const count=this.settings.autoAdd?Math.min(this.settings.maxTasks,this.settings.startingTasks+Math.floor(this.score/this.settings.increaseEvery)):this.settings.startingTasks;
    this.ensurePanels(count,now);return event;
  }
  finish(reason='stopped',task=null,now=this.lastAt) {if(this.ended)return;if(now<this.lastAt)this.taskTimeArea=Math.max(0,this.taskTimeArea-(this.lastAt-now)*this.panels.length);this.lastAt=now;this.ended=true;this.endedAt=now;this.endingReason=reason;this.endingTask=task;}
  record(now=this.lastAt) {
    const duration=Math.max(0,((this.endedAt??now)-this.startedAt)/1000),responses=this.events.filter(e=>!e.expired).map(e=>e.responseTimeSeconds),correct=this.events.filter(e=>e.correct).length;
    return {timestamp:this.timestamp,sessionId:this.sessionId,attemptId:this.sessionId+':1',questionNumber:1,game:'overload',gameType:'Multitasker / OVERLOAD',difficulty:this.difficulty<=3?'Easy':this.difficulty<=6?'Medium':'Hard',sessionMode:this.settings.mode,
      outcome:!this.ended?'Not answered':this.endingReason==='mistake'?'Incorrect':'Correct',timeUsedSeconds:duration,timeLimitSeconds:this.settings.durationSeconds||null,
      expectedAnswer:'Stay accurate across simultaneous tasks',userAnswer:`${this.score} correct actions; ${this.errors} errors; ${this.endingReason??'in progress'}`,
      overloadSettings:this.settings,overloadScore:this.score,overloadDuration:duration,overloadDifficulty:this.difficulty,overloadPeakTasks:this.peakTasks,
      overloadAverageTasks:duration?this.taskTimeArea/(duration*1000):this.panels.length,overloadTasks:this.panels.map(p=>p.task),overloadCorrectActions:correct,overloadErrors:this.errors,
      overloadAccuracy:this.events.length?correct/this.events.length*100:null,overloadAverageResponse:responses.length?responses.reduce((a,b)=>a+b,0)/responses.length:null,
      overloadFastestResponse:responses.length?Math.min(...responses):null,overloadSlowestResponse:responses.length?Math.max(...responses):null,
      overloadExpired:this.events.filter(e=>e.expired).length,overloadDifficultyChanges:this.difficultyChanges,overloadUnlocks:this.unlockEvents,overloadSwitches:this.switches,
      overloadPressureEvents:this.pressureEvents,overloadEndingTask:this.endingTask,overloadEndingReason:this.endingReason,overloadActivity:this.events,
    };
  }
}
