import { ITEM_TYPES, HOLD_TYPES, ACTIONS, WORKFLOW_LABELS, classifyItem, decideCheck, availabilityKey, availabilityText } from './check-holds.mjs?v=20261003-ui-polish';

export function renderHoldTraining(container, c, referenceSignature = '') {
  container.replaceChildren();container.hidden=!c;
  if(!c) return;
  const legend=document.createElement('legend');legend.textContent='Hold & processing';container.append(legend);
  const facts=document.createElement('p');facts.className='setup-note';
  const prior=c.priorAccounts?.map(a=>`${a.transactional?'Transactional':'Other'} prior account held ${a.ageDays} calendar days, existed ${a.daysBeforeOpening} calendar days before opening`).join('; ');
  facts.textContent=[`Requested transaction: ${c.transaction}`,`Account age: ${c.accountAgeDays} days`,`Aggregate checks today: $${(c.dailyCheckDepositsCents/100).toFixed(2)}`,
    prior, c.returnedUnpaid?'Previously returned unpaid':c.correctedEndorsement?'Previously returned for missing endorsement; now corrected':c.correctedPostdate?'Previously postdated; now within date':'No previous unpaid return',
    c.overdraftHistory??'No repeated overdrafts or current overdraft',c.reasonableCause?'Confidential information indicates possible nonpayment':null,
    c.emergencyDetails??'No emergency',`TrueChecks / Alert Center Details: ${c.trueChecks}`,c.unusedCashier?'Unused cashier’s check; customer requests redeposit':null,
    c.governmentJoin?c.allPayeesPresent?'All named payees are present':'Only one named payee is present':null,c.llc?`Destination: ${c.llcAccount?'LLC account':'cash requested'}`:null,
    c.physicalSplit?'Customer asks to divide the physical check into two checks':null,
    c.nonCustomer?`Non-customer; bank classifies this check as large. ${c.twoValidIds?'Two valid IDs available':'Only one valid ID available'}. Payer account and prior signature file available. ${c.payerApproved?'Payer approved after contact':'Payer has not approved'}.`:null,
    c.businessNameReview?'Business records verify the payee’s business name and authorized presenter':null].filter(Boolean).join(' · ');
  container.append(facts);
  if(c.tellerReference) {
    const records=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Teller file / prior checks / Alert Center Details';records.append(summary);
    const file=c.tellerReference,copy=document.createElement('dl');copy.className='fraud-readable-details';
    const entries=[['Payer account holder',file.payerName],['Payer file routing / account',`${file.routingNumber} / ${file.accountNumber}`],['Prior check',file.priorCheckNumber],['Recorded payer signature',file.payerSignature],['Business name on file',file.businessPayee],['Authorized presenter',file.authorizedPresenter],['Second ID',c.twoValidIds?file.secondaryId:'Second valid ID not established'],['Presenter history',file.presenterHistory],['TrueChecks / Alert Center Details',file.trueChecksDetails]];
    for(const [name,value] of entries) {if(!value) continue;const row=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');term.textContent=name;description.textContent=value;row.append(term,description);copy.append(row);}
    records.append(copy);
    if(referenceSignature) {const view=document.createElement('div');view.className='hold-reference-signature';view.innerHTML=referenceSignature;records.append(view);}
    container.append(records);
  }
  const allowanceNote=document.createElement('p');allowanceNote.className='setup-note';allowanceNote.textContent='Identify the item, then choose how to process it. Availability is calculated from this case, including earlier checks that used today’s allowance.';container.append(allowanceNote);
  const grid=document.createElement('div');grid.className='form-grid hold-decision-grid';container.append(grid);
  const select=(name,label,values)=> {
    const wrapper=document.createElement('label');wrapper.textContent=label;
    const input=document.createElement('select');input.name=name;input.id='hold-'+name;
    input.append(new Option('Choose…',''));
    Object.entries(values).forEach(([value,title])=>input.append(new Option(title,value)));
    wrapper.append(input);grid.append(wrapper);return wrapper;
  };
  const item=select('itemType','1 · Item type',{}),itemSelect=item.querySelector('select');
  const groups={'Checks':['on-us','cashier','treasury','fhlb','postal','reserve','government','personal','business'],'Other items':['foreign','cash','ach','wire']};
  for(const [name,ids] of Object.entries(groups)){const group=document.createElement('optgroup');group.label=name;for(const id of ids)group.append(new Option(ITEM_TYPES[id],id));itemSelect.append(group);}
  const action=select('action','2 · Processing decision',ACTIONS),actionSelect=action.querySelector('select');
  const reason=select('holdType','3 · Hold Type',Object.fromEntries(Object.entries(HOLD_TYPES).filter(([key])=>key!=='none'))),reasonSelect=reason.querySelector('select');
  const classification=document.createElement('input');classification.type='hidden';classification.name='classification';classification.id='hold-classification';container.append(classification);
  const timing=document.createElement('input');timing.type='hidden';timing.name='availability';timing.id='hold-availability';container.append(timing);
  const notice=document.createElement('input');notice.type='hidden';notice.name='notice';notice.id='hold-notice';container.append(notice);
  const availability=document.createElement('div');availability.className='hold-availability';availability.hidden=true;availability.append(document.createElement('strong'),document.createElement('p'));availability.querySelector('strong').textContent='Availability';container.append(availability);
  const noticeLabel=document.createElement('label');noticeLabel.className='hold-notice-confirm';noticeLabel.hidden=true;const noticeCheck=document.createElement('input');noticeCheck.type='checkbox';noticeCheck.id='hold-notice-confirm';noticeLabel.append(noticeCheck,document.createTextNode('Hold Notice given to the customer'));container.append(noticeLabel);
  const expected=decideCheck(c);
  function update(){
    classification.value=itemSelect.value?classifyItem(itemSelect.value):'';
    const processing=['accept','hold'].includes(actionSelect.value),placingHold=actionSelect.value==='hold';
    reason.hidden=!placingHold;reasonSelect.disabled=!placingHold;
    if(!placingHold)reasonSelect.value='';
    const ready=processing&&(!placingHold||Boolean(reasonSelect.value));
    availability.hidden=!ready;
    timing.value=ready?availabilityKey(expected.availability):'';
    if(ready)availability.querySelector('p').textContent=expected.availability.length?availabilityText(expected.availability):'No deposit availability schedule applies to this decision.';
    noticeLabel.hidden=!placingHold;noticeCheck.disabled=!placingHold;
    if(!placingHold)noticeCheck.checked=false;
    notice.value=placingHold?(noticeCheck.checked?'given':'not-required'):'not-required';
    const electronic=['cash','ach','wire'].includes(itemSelect.value);
    if(electronic&&placingHold)availability.querySelector('p').textContent='Cash, ACH, and wire items cannot receive Reg CC holds. Reconsider the processing decision.';
  }
  itemSelect.addEventListener('change',update);actionSelect.addEventListener('change',update);reasonSelect.addEventListener('change',update);noticeCheck.addEventListener('change',update);update();
  const workflow=document.createElement('details');workflow.className='hold-step-details';const summary=document.createElement('summary');summary.textContent='Required handling / verification steps';workflow.append(summary);
  const choices=document.createElement('div');choices.className='hold-workflow';
  for(const [value,label] of Object.entries(WORKFLOW_LABELS)) {
    const wrapper=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.name='workflow';box.value=value;wrapper.append(box,document.createTextNode(label));choices.append(wrapper);
  }
  workflow.append(choices);container.append(workflow);
  const label=document.createElement('label');label.textContent='Customer verification note (when approved) · Customer verified + YYYY-MM-DD + HH:MM';
  const note=document.createElement('input');note.name='note';note.id='hold-note';note.type='text';label.append(note);container.append(label);
}
export function readHoldAnswer(container) {
  const answer={workflow:[]};
  container.querySelectorAll('select,input').forEach(el=> {if(el.type==='checkbox') {if(el.name==='workflow'&&el.checked) answer.workflow.push(el.value);}else if(el.name) answer[el.name]=el.value;});
  if(answer.action==='accept') answer.holdType='none';
  return answer;
}
