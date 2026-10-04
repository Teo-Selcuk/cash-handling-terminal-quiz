import test from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, resolveOverloadSettings, createTrial, OverloadRun } from '../overload-core.mjs';
import { generateSampleHistory } from '../sample-history.mjs';
import { summarizeOverload, overloadRecommendation, overloadChartSpecs } from '../overload-analytics.mjs';
import { buildErrorAnalytics, filterHistory, normalizeHistoryRecord, buildGameFilters } from '../progress-analytics.mjs';
import { rankPracticeCandidates } from '../adaptive-practice.mjs';

const settings = patch => resolveOverloadSettings({mode:'custom',included:TASKS.map(t=>t.id),startingTasks:9,maxTasks:9,unlockAll:true,allowedMistakes:50,...patch});
test('settings preserve configurable unlocks, bounded task counts and normal/practice lives',()=> {
  assert.equal(resolveOverloadSettings({mode:'standard'}).allowedMistakes,0);
  assert.equal(resolveOverloadSettings({mode:'practice'}).allowedMistakes,null);
  assert.equal(settings({startingTasks:20,maxTasks:20}).maxTasks,9);
  assert.equal(settings({unlocks:{arrows:12}}).unlocks.arrows,12);
  assert.throws(()=>settings({included:[]}));
});
test('all nine tasks accept their correct response and preserve raw trial data',()=> {
  for(const task of TASKS) {
    const run=new OverloadRun(settings({included:[task.id],startingTasks:1,maxTasks:1}),()=>.4,0);
    const panel=run.panels[0];assert.ok(panel.trial.raw);assert.equal(panel.task,task.id);
    run.advance(panel.trial.answerAt);
    if(task.id==='ball') run.move(panel.id,panel.trial.expected, panel.trial.answerAt);
    run.respond(panel.id,panel.trial.expected,panel.trial.answerAt+10);
    assert.equal(run.events.at(-1).correct,true,task.id);assert.equal(run.score,1);
    assert.equal(run.events.at(-1).task,task.id);
  }
});
test('one mistake ends standard; practice continues; deadlines expire independently once',()=> {
  const standard=new OverloadRun(resolveOverloadSettings({included:['math'],startingTasks:1,maxTasks:1}),()=>.2,0);
  standard.respond(standard.panels[0].id,'wrong',100);assert.equal(standard.ended,true);
  const run=new OverloadRun(settings({mode:'practice',startingTasks:3,maxTasks:3,included:['math','color','ball']}),()=>.5,0);
  run.panels.find(p=>p.task==='ball').trial.raw.catchPosition=0;
  const deadline=Math.max(...run.panels.map(p=>p.trial.deadline));run.advance(deadline+1);
  assert.equal(run.events.length,3);assert.ok(run.events.every(e=>e.expired));assert.equal(run.ended,false);
  run.advance(deadline+1);assert.equal(run.events.length,3);
});
test('scaling, auto-add and unlocks use shared score; overlapping pressure and switches are recorded',()=> {
  const run=new OverloadRun(settings({startingTasks:2,maxTasks:9,increaseEvery:1,autoAdd:true,unlockAll:false,included:['math','color','arrows'],unlocks:{arrows:2}}),()=>.3,0);
  for(let i=0;i<3;i++) {const p=run.panels[i%2];run.respond(p.id,p.trial.expected,100+i*100);}
  assert.equal(run.difficulty,4);assert.equal(run.panels.length,3);assert.ok(run.unlockEvents.some(e=>e.task==='arrows'));assert.ok(run.switches>=1);
  const p=run.panels[0];run.advance(p.trial.deadline-100);assert.ok(run.pressureEvents.length>0);
});
test('memory study phase rejects early input; stale task responses cannot score twice',()=> {
  const run=new OverloadRun(settings({included:['pattern'],startingTasks:1,maxTasks:1}),()=>.1,0),p=run.panels[0];
  const trial=p.trial;assert.equal(run.respond(p.id,trial.expected,10),null);
  run.advance(trial.answerAt);run.respond(p.id,trial.expected,trial.answerAt+10,trial.id);
  assert.equal(run.respond(p.id,trial.expected,trial.answerAt+20,trial.id),null);assert.equal(run.score,1);
});
test('duration ends endurance and snapshot preserves completed and interrupted run evidence',()=> {
  const run=new OverloadRun(settings({mode:'endurance',durationSeconds:10,startingTasks:1,included:['math'],timerSeconds:30}),()=>.1,0);
  assert.equal(run.record(1000).outcome,'Not answered');run.advance(10000);assert.equal(run.ended,true);
  const record=run.record(10000);assert.equal(record.game,'overload');assert.equal(record.overloadDuration,10);assert.ok(record.overloadActivity);
});
test('one to nine concurrent tasks preserve independently submitted actions and clocks',()=> {
  for(let count=1;count<=9;count++) {
    const run=new OverloadRun(settings({startingTasks:count,maxTasks:count,included:TASKS.slice(0,count).map(t=>t.id),timerSeconds:60}),()=>.3,0);
    assert.equal(run.panels.length,count);
    const deadline=run.panels[0].trial.deadline;
    const color=run.panels.find(p=>p.task==='color');
    if(color){run.respond(color.id,color.trial.expected,100);assert.equal(run.panels[0].trial.deadline,deadline);}
    for(const panel of [...run.panels].sort((a,b)=>a.trial.answerAt-b.trial.answerAt)) {
      const trial=panel.trial,now=Math.max(run.lastAt,trial.answerAt)+1;
      if(panel.task==='ball')run.move(panel.id,trial.expected,now);
      run.respond(panel.id,trial.expected,now,trial.id);
    }
    for (const task of run.settings.included) assert.ok(run.events.some(event=>event.task===task&&event.correct), `${count} panels: ${task} correct response`);
    assert.ok(run.score>=count);
  }
});
test('endurance and custom mistake budgets expire exactly after the allowed mistakes',()=> {
  for(const mode of ['endurance','custom']) {
    const run=new OverloadRun(settings({mode,included:['math'],startingTasks:1,maxTasks:1,allowedMistakes:2}),()=>.2,0);
    for(let i=0;i<3;i++) {run.respond(run.panels[0].id,'wrong',100+i*100);assert.equal(run.ended,i===2);}
  }
});
test('stable isolated sample runs cover all tasks, counts, modes, filters and analytical evidence',()=> {
  const sample=generateSampleHistory({now:new Date('2026-10-03'),seed:42});
  assert.deepEqual(sample,generateSampleHistory({now:new Date('2026-10-03'),seed:42}));
  const runs=sample.map(normalizeHistoryRecord).filter(r=>r.game==='overload');
  assert.ok(runs.length>=200);assert.equal(new Set(runs.map(r=>r.overloadPeakTasks)).size,9);assert.equal(new Set(runs.map(r=>r.sessionMode)).size,4);
  const stats=summarizeOverload(runs);assert.equal(stats.tasks.length,9);assert.ok(stats.mostReliable);assert.ok(stats.leastReliable);
  assert.ok(stats.combinations.some(group=>group.label==='5+ simultaneous tasks'));assert.ok(stats.combinations.some(group=>group.label==='Hard difficulty + short timers'));
  const charts=overloadChartSpecs(runs);assert.equal(charts.length,11);assert.equal(charts.filter(c=>c.kind==='line').length,5);
  const filtered=filterHistory(sample,{game:'overload',overload:{modes:['practice'],tasks:{min:4,max:4},miniGames:['color']}});
  assert.ok(filtered.length);assert.ok(filtered.every(r=>r.overloadPeakTasks===4&&r.sessionMode==='practice'));
  assert.ok(buildGameFilters(runs,'overload').fields.some(field=>field.id==='overload.miniGames'));
  const analytics=buildErrorAnalytics(runs);assert.ok(analytics.byCategory.some(group=>group.label==='Color interference error'));assert.ok(analytics.byRawInput.some(group=>group.label.includes(' + ')));
  const recommendation=overloadRecommendation(runs);assert.ok(recommendation.challenge);assert.equal(recommendation.preset.mode,'practice');assert.ok(recommendation.preset.included.includes(stats.leastReliable.task));
  assert.ok(rankPracticeCandidates(runs).some(plan=>plan.game==='overload'));assert.equal(overloadRecommendation(runs.slice(0,2)).challenge,null);
});
