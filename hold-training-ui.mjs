import { ITEM_TYPES, HOLD_TYPES, ACTIONS, WORKFLOW_LABELS } from './check-holds.mjs';

export function renderHoldTraining(container, c, referenceSignature = '') {
  container.replaceChildren();container.hidden=!c;
  if(!c) return;
  const legend=document.createElement('legend');legend.textContent='Acceptance & funds availability';container.append(legend);
  const facts=document.createElement('p');facts.className='setup-note';
  const prior=c.priorAccounts?.map(a=>`${a.transactional?'Transactional':'Other'} B&H account held ${a.ageDays} calendar days, existed ${a.daysBeforeOpening} calendar days before opening`).join('; ');
  facts.textContent=[`Requested transaction: ${c.transaction}`,`Account age: ${c.accountAgeDays} days`,`Aggregate checks today: $${(c.dailyCheckDepositsCents/100).toFixed(2)}`,
    prior, c.returnedUnpaid?'Previously returned unpaid':c.correctedEndorsement?'Previously returned for missing endorsement; now corrected':c.correctedPostdate?'Previously postdated; now within date':'No previous unpaid return',
    c.overdraftHistory??'No repeated overdrafts or current overdraft',c.reasonableCause?'Confidential information indicates possible nonpayment':null,
    c.emergencyDetails??'No emergency',`TrueChecks / Alert Center Details: ${c.trueChecks}`,c.unusedCashier?'Unused B&H cashier’s check; customer requests redeposit':null,
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
  const allowanceNote=document.createElement('p');allowanceNote.className='setup-note';allowanceNote.textContent='Availability is measured in business days. For aggregate large deposits, earlier checks today consume the first $300 / $6,800 allowances; use the remaining daily allowance for this item.';container.append(allowanceNote);
  const grid=document.createElement('div');grid.className='form-grid';container.append(grid);
  const select=(name,label,values)=> {
    const wrapper=document.createElement('label');wrapper.textContent=label;
    const input=document.createElement('select');input.name=name;input.id='hold-'+name;
    input.append(new Option('Choose…',''));
    Object.entries(values).forEach(([value,title])=>input.append(new Option(title,value)));
    wrapper.append(input);grid.append(wrapper);return wrapper;
  };
  select('itemType','Item type',ITEM_TYPES);
  select('classification','Availability classification',{'next-day':'Next-Day','non-next-day':'Non-Next-Day',foreign:'Foreign / separate workflow'});
  const action=select('action','Processing decision',ACTIONS);
  const reason=select('holdType','Hold type',HOLD_TYPES);
  const timing=select('availability','Availability business days',{'0':'All same day','1':'All next business day','2':'All 2nd business day','7':'All 7th business day','9':'All 9th business day','0/1':'First $300 same day; rest next day','0/2':'First $300 same day; rest day 2','0/1/2':'First $300 same day; next $6,500 day 1; rest day 2','0/1/7':'First $300 same day; next $6,500 day 1; rest day 7','0/2/7':'First $300 same day; next $6,500 day 2; rest day 7','0/1/9':'First $300 same day; next $6,500 day 1; rest day 9','1/2':'Remaining daily next-day allowance day 1; rest day 2','1/7':'Remaining daily next-day allowance day 1; rest day 7','2/7':'Remaining daily non-next-day allowance day 2; rest day 7'});
  const notice=select('notice','Hold Notice',{given:'Given','not-required':'Not Required'});
  action.querySelector('select').addEventListener('change',e=> {
    const process=['accept','hold'].includes(e.target.value);
    for(const el of [reason,timing,notice]) {el.hidden=!process;el.querySelector('select').disabled=!process;}
  });
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
  container.querySelectorAll('select,input').forEach(el=> {if(el.type==='checkbox') {if(el.checked) answer.workflow.push(el.value);}else answer[el.name]=el.value;});
  return answer;
}
