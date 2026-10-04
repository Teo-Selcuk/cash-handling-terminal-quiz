import { TASKS, createTrial, resolveOverloadSettings } from './overload-core.mjs?v=20261003-ui-polish';
const names=Object.fromEntries(TASKS.map(t=>[t.id,t.name]));
const avg=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const group=(events,label,extra={})=>({label,actions:events.length,errors:events.filter(e=>!e.correct).length,accuracy:events.length?events.filter(e=>e.correct).length/events.length*100:null,response:avg(events.filter(e=>!e.expired).map(e=>e.responseTimeSeconds)),...extra});
export function summarizeOverload(records) {
  const runs=records.filter(r=>r.game==='overload'&&r.outcome!=='Not answered'),events=runs.flatMap(r=>(r.overloadActivity??[]).map(e=>({...e,attemptId:r.attemptId??r.sessionId})));
  const tasks=TASKS.map(task=> {const rows=events.filter(e=>e.task===task.id);return group(rows,task.name,{task:task.id,runs:new Set(rows.map(e=>e.attemptId)).size});}).filter(t=>t.actions);
  const supported=tasks.filter(t=>t.runs>=3&&t.actions>=15),stats=group(events,'All tasks');
  const combinations=new Map();
  for(const event of events) {
    const labels=[`${event.taskCount} simultaneous tasks`,...(event.taskCount>=5?['5+ simultaneous tasks']:[]),...(event.overlap?['Overlapping pressure']:[]),...(event.difficulty>=7&&event.deadlineSeconds<6?['Hard difficulty + short timers']:[])];
    for(let i=0;i<event.activeTasks.length;i++)for(let j=i+1;j<event.activeTasks.length;j++)labels.push([names[event.activeTasks[i]],names[event.activeTasks[j]]].sort().join(' + '));
    for(const label of labels){if(!combinations.has(label))combinations.set(label,[]);combinations.get(label).push(event);}
  }
  return {runs:runs.length,bestScore:Math.max(0,...runs.map(r=>r.overloadScore??0)),averageScore:avg(runs.map(r=>r.overloadScore??0)),bestSurvival:Math.max(0,...runs.map(r=>r.overloadDuration??0)),averageTasks:avg(runs.map(r=>r.overloadAverageTasks??r.overloadPeakTasks)),highestDifficulty:Math.max(0,...runs.map(r=>r.overloadDifficulty??0)),...stats,
    tasks,mostReliable:[...supported].sort((a,b)=>b.accuracy-a.accuracy)[0]??null,leastReliable:[...supported].sort((a,b)=>a.accuracy-b.accuracy)[0]??null,
    combinations:[...combinations].map(([label,rows])=>group(rows,label,{runs:new Set(rows.map(e=>e.attemptId)).size,events:rows})),events};
}
export function overloadChartSpecs(records) {
  const runs=records.filter(r=>r.game==='overload'),stats=summarizeOverload(runs);
  const chart=(id,title,points,metric='accuracy',kind='bar')=>({id:'overload-'+id,title,kind,attemptIds:[...new Set(points.flatMap(p=>p.attemptIds))],series:[{metric,points}]});
  const progression=(field)=>runs.map(r=>({key:r.attemptId,label:new Date(r.timestamp).toLocaleString(),value:r.outcome==='Not answered'?null:r[field],attemptIds:[r.attemptId],count:1}));
  const taskPoints=(field)=>stats.tasks.map(t=>({key:t.task,label:t.label,value:field==='error'?100-t.accuracy:t[field],attemptIds:[...new Set(stats.events.filter(e=>e.task===t.task).map(e=>e.attemptId))],count:t.actions}));
  const grouped=(fn,field)=> {const groups=new Map();for(const r of runs.filter(r=>r.outcome!=='Not answered')){const key=String(fn(r));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}return [...groups].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([label,rows])=>({key:label,label,value:avg(rows.map(field)),attemptIds:rows.map(r=>r.attemptId),count:rows.length}));};
  const actionGroups = (field, errors = false) => {
    const groups = new Map();
    for (const event of stats.events) { const key = String(event[field]); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(event); }
    return [...groups].sort(([a], [b]) => Number(a) - Number(b)).map(([label, events]) => ({ key: label, label, value: events.filter(event => errors ? !event.correct : event.correct).length / events.length * 100, count: events.length, attemptIds: [...new Set(events.map(event => event.attemptId))] }));
  };
  return [chart('score','Score over time',progression('overloadScore'),'score','line'),chart('accuracy','Action accuracy over time',progression('overloadAccuracy'),'accuracy','line'),
    chart('response','Action response time over time',progression('overloadAverageResponse'),'time','line'),chart('survival','Survival duration over time',progression('overloadDuration'),'duration','line'),
    chart('peak','Maximum simultaneous tasks over time',progression('overloadPeakTasks'),'tasks','line'),chart('task-errors','Error rate by mini-game',taskPoints('error'),'error-rate'),chart('task-response','Response time by mini-game',taskPoints('response'),'time'),
    chart('difficulty','Action accuracy by difficulty',actionGroups('difficulty')),chart('task-count','Error rate by task count',actionGroups('taskCount',true),'error-rate'),
    chart('overlap','Mistakes under overlapping pressure',stats.combinations.filter(c=>c.label==='Overlapping pressure'||/^\d simultaneous/.test(c.label)).map(c=>({key:c.label,label:c.label,value:100-c.accuracy,count:c.actions,attemptIds:[...new Set(c.events.map(e=>e.attemptId))]})),'error-rate'),
    chart('difficulty-distribution','Difficulty reached distribution',grouped(r=>r.overloadDifficulty,()=>1).map(p=>({...p,value:p.count})),'attempts')];
}
export function overloadRecommendation(records) {
  const stats=summarizeOverload(records),weak=stats.leastReliable,strong=stats.mostReliable;
  if(!weak||weak.accuracy>=90)return {challenge:null,previousChallenges:[],reason:'Complete at least three runs and 15 actions per task before recommending focused practice.'};
  const taskCounts=stats.combinations.filter(c=>/^\d simultaneous/.test(c.label)&&c.runs>=3&&c.actions>=15).sort((a,b)=>parseInt(a.label)-parseInt(b.label));
  const jump=taskCounts.find((c,i)=>i>0&&parseInt(c.label)===parseInt(taskCounts[i-1].label)+1&&taskCounts[i-1].accuracy-c.accuracy>=15);
  const included=[weak.task,...(strong&&strong.task!==weak.task?[strong.task]:[])];
  const count=jump?parseInt(jump.label):included.length;
  for(const task of TASKS)if(included.length<count&&!included.includes(task.id))included.push(task.id);
  const preset=resolveOverloadSettings({mode:'practice',included,startingTasks:count,maxTasks:count,autoAdd:false,startingDifficulty:1,durationSeconds:120});
  return {challenge:true,id:`overload-practice-${weak.task}-${count}`,game:'overload',difficulty:'Easy',target:jump?`Practice ${count} simultaneous tasks`:`${included.map(t=>names[t]).join(' + ')} practice`,title:'Recommended next challenge',
    preset,options:{},reason:jump?`Accuracy drops from ${Number(taskCounts[taskCounts.indexOf(jump)-1].accuracy.toFixed(2))}% to ${Number(jump.accuracy.toFixed(2))}% at ${count} tasks.`:`${weak.label} accuracy is ${Number(weak.accuracy.toFixed(2))}% across ${weak.actions} actions in ${weak.runs} runs. Pair it with your stronger task.`,
    evidenceCount:weak.runs,previousChallenges:[],attemptIds:[...new Set(stats.events.filter(e=>e.task===weak.task).map(e=>e.attemptId))],progressionRule:'Practice with fixed task count and generous timers; recommendations require at least three runs and 15 task actions.'};
}

export function sampleOverloadRecord(record,random,index=0) {
  const count=1+index%9,mode=['standard','practice','endurance','custom'][index%4],included=TASKS.slice(0,count).map(t=>t.id),difficulty=1+index%12;
  const settings=resolveOverloadSettings({mode,included,startingTasks:count,maxTasks:count,unlockAll:true,startingDifficulty:difficulty,durationSeconds:180,autoAdd:false});
  const n=10+index%26,activity=[];let at=0,score=0;
  for(let i=0;i<n;i++) {
    const task=included[i%count],t=createTrial(task,difficulty,settings,random,0),trend=.08*Math.sin(index/13),response=.5+random()*4+(count>4?1:0)-trend*3,correct=random()<Math.min(.99,(task==='color'?.65:task==='math'?.95:.88)+trend),expired=!correct&&random()<.35;
    if(at+response>180)break;
    at+=response;score+=correct?1:0;activity.push({task,trialId:`sample-overload-${index}-${i}`,at,expected:t.expected,answer:correct?t.expected:task==='math'?Number(t.expected)+1:null,correct,expired,automatic:false,responseTimeSeconds:response,difficulty,taskCount:count,activeTasks:included,overlap:count>=3&&random()<.45,ignored:expired,rushed:!correct&&response<1,errorCause:correct?null:expired?'Timeout':TASKS.find(t=>t.id===task).error,raw:t.raw});
    activity.at(-1).deadlineSeconds=(t.deadline-t.answerAt)/1000;
    if(settings.allowedMistakes!==null&&activity.filter(e=>!e.correct).length>settings.allowedMistakes)break;
  }
  const errors=activity.filter(e=>!e.correct).length;
  const failed=settings.allowedMistakes!==null&&errors>settings.allowedMistakes;
  return {...record,game:'overload',gameType:'Multitasker',sessionMode:mode,outcome:failed?'Incorrect':'Correct',sessionId:`${record.sessionId}-run-${index}`,questionNumber:1,
    timeUsedSeconds:at,timeLimitSeconds:180,overloadSettings:settings,overloadScore:score,overloadDuration:at,overloadDifficulty:difficulty,overloadPeakTasks:count,overloadAverageTasks:count,
    overloadTasks:included,overloadCorrectActions:score,overloadErrors:errors,overloadAccuracy:score/activity.length*100,overloadAverageResponse:avg(activity.filter(e=>!e.expired).map(e=>e.responseTimeSeconds)),
    overloadExpired:activity.filter(e=>e.expired).length,overloadFastestResponse:Math.min(...activity.map(e=>e.responseTimeSeconds)),overloadSlowestResponse:Math.max(...activity.map(e=>e.responseTimeSeconds)),
    overloadDifficultyChanges:[{difficulty,score:Math.min(score,5),at:at*.4}],overloadUnlocks:included.map(task=>({task,score:0,at:0})),overloadSwitches:activity.length-1,
    overloadPressureEvents:activity.filter(e=>e.overlap).map(e=>({at:e.at,tasks:included})),overloadEndingTask:failed?activity.at(-1).task:null,overloadEndingReason:failed?'mistake':'stopped',overloadActivity:activity,
    expectedAnswer:'Stay accurate across simultaneous tasks',userAnswer:`${score} correct actions; ${errors} errors`};
}
