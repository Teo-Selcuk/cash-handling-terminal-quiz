import { ITEM_TYPES, HOLD_TYPES, ACTIONS, WORKFLOW_LABELS, availabilityChoices } from './check-holds.mjs?v=20261003-accounts';

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
  const allowanceNote=document.createElement('p');allowanceNote.className='setup-note';allowanceNote.textContent='Identify the item, classification, processing decision, hold, release days and notice. Use this case’s conditions, including earlier checks that used today’s allowance.';container.append(allowanceNote);
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
  select('classification','2 · Availability classification',{'next-day':'Next-Day Item','non-next-day':'Non-Next-Day Item',special:'Special / outside normal check classification'});
  select('action','3 · Processing decision',ACTIONS);
  select('holdType','4 · Hold Type',HOLD_TYPES);
  select('availability','5 · Availability / business days',availabilityChoices());
  select('notice','6 · Hold Notice',{given:'Required · give notice','not-required':'Not Required'});
  const timingHelp=document.createElement('p');timingHelp.className='setup-note';timingHelp.textContent='Select the release days in order, from the first available portion to the final portion. Day 0 means same day. Use no schedule when processing is stopped or routed for review. Cash, ACH and wire use their separate training availability, never a Reg CC check hold.';container.append(timingHelp);
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
  return answer;
}
