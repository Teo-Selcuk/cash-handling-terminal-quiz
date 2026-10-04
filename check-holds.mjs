// Training specification: user-supplied Burke & Herbert rules. Amounts stay in cents.
export const ITEM_TYPES = {
  'on-us':'Burke & Herbert Bank · On-Us check', cashier:"Cashier’s / Official check",
  treasury:'United States Treasury', fhlb:'Federal Home Loan Bank', postal:'U.S. Postal Service money order',
  reserve:'Federal Reserve Bank', government:'State / local government', personal:'Personal check',
  business:'Business check', foreign:'Foreign check · collection', cash:'Cash deposit', ach:'ACH credit', wire:'Wire transfer',
};
export const HOLD_TYPES = { none:'No Hold', large:'Large Deposit', new:'New Account', reasonable:'Reasonable Cause', redeposited:'Redeposited Item', overdraft:'Repeated / Currently Overdrawn', emergency:'Emergency Situation' };
export const ACTIONS = { accept:'Accept', hold:'Place Hold', correction:'Return for Correction', 'deposit-only':'Restrict to Deposit', manager:'Escalate to Manager', reject:'Reject / Do Not Process' };
const electronic = new Set(['cash','ach','wire']);
const nextDay = new Set(['on-us','cashier','treasury','fhlb','postal','reserve','government','cash','ach','wire']);
export const classifyItem = type => type === 'foreign' ? 'foreign' : nextDay.has(type) ? 'next-day' : 'non-next-day';
export function qualifyingPriorAccount(customers) {
  return Array.isArray(customers) && customers.length > 0 && customers.every(c => c.transactional === true && c.atBurkeHerbert === true && c.ageDays >= 30 && c.daysBeforeOpening >= 0 && c.daysBeforeOpening <= 30);
}
export function availabilityKey(tiers) { return tiers.map(t => t.day).join('/'); }
export function availabilityText(tiers) { return tiers.map(t => `$${(t.amountCents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}: ${t.day === 0 ? 'same day' : 'business day '+t.day}`).join(' · '); }

export function decideCheck(c) {
  const classification=classifyItem(c.itemType), isCheck=!electronic.has(c.itemType) && c.itemType !== 'foreign';
  const amount=Math.max(0,c.amountCents), tiers=[], onUs=c.itemType==='on-us'||c.onUs===true;
  const result={itemType:c.itemType,classification,action:'accept',holdType:'none',availability:[],notice:false,receipt:c.itemType!=='foreign',workflow:[],transaction:c.transaction==='cash-back'?'deposit-with-cash-back':c.transaction,explanation:[]};
  const action=(value,reason)=> {result.action=value;result.explanation.push(reason);return result;};
  if(c.physicalSplit) return action('reject','The physical check cannot be split. Use a deposit-with-cash-back transaction.');
  if(c.itemType==='foreign') {result.workflow.push('foreign-no-receipt');return action('manager','Use the separate foreign collection workflow; do not issue a receipt.');}
  if(!isCheck) {result.availability=[{amountCents:amount,day:0}];return action('accept','Cash, ACH and wire items cannot receive Reg CC check holds.');}
  const issues = new Set(c.inspectionIssues ?? []);
  if (['check-alteration','routing-issue','account-information-issue','check-number-mismatch','id-altered','id-expired'].some(id=>issues.has(id))) return action('reject','Do not process the item with invalid identification or unresolved check/account discrepancies.');
  if (['endorsement-signature-mismatch','maker-signature-suspicious','handwriting-issue','id-information-inconsistent'].some(id=>issues.has(id))) return action('manager','Unresolved signature, handwriting or ID discrepancies require manager review.');
  if (['amount-mismatch','payee-mismatch','date-issue','missing-required-field','endorsement-missing'].some(id=>issues.has(id))) return action('correction','Resolve missing endorsements or return incorrect check fields to the payer for correction.');
  if(c.nonCustomer) {
    if(!c.twoValidIds) return action('reject','A non-customer On-Us check requires two valid IDs.');
    result.workflow.push('two-ids','payer-history','payer-signature');
    if(c.presenterHistoryApplicable) result.workflow.push('presenter-history');
    if(c.largeNonCustomer) {
      result.workflow.push('contact-payer');
      if(!c.payerApproved) return action('manager','Contact the payer/customer for verification before processing this large non-customer check.');
      result.workflow.push('verification-note');
    }
  }
  if(c.amountCents>50000 && c.transaction!=='cash') result.workflow.push('truechecks');
  if(c.businessNameReview) result.workflow.push('business-history');
  if(c.transaction==='cash-back') result.workflow.push('cash-back');
  if(c.incorrectInformation) return action('correction','Return to the payer for correction; do not alter check information yourself.');
  if(c.endorsement==='missing') return action('correction','Obtain the required payee endorsement. Correcting it alone is not a redeposited item.');
  if(['conditional','third-party','mark'].includes(c.endorsement)) return action('manager','This endorsement or signature requires manager review; no automatic acceptance or witness procedure is supplied.');
  if(c.frontSignatureMark) return action('manager','A drawer signature by mark requires manager review; no witness procedure is supplied.');
  if(c.unusedCashier && c.endorsement!=='NOT USED FOR INTENDED PURPOSE') return action('correction','Before depositing an unused Burke & Herbert cashier’s check back to the customer, obtain NOT USED FOR INTENDED PURPOSE.');
  if(c.governmentJoin==='AND' && !c.allPayeesPresent) return action('manager','Government AND payees require all applicable parties or manager handling. OR permits either applicable named party.');
  if((c.llc||c.endorsement==='deposit-only') && c.transaction!=='deposit') return action('deposit-only',c.llc?'Deposit to the LLC account; do not cash it.':'Follow For Deposit Only; restrict this item to deposit.');
  if(c.llc && !c.llcAccount) return action('deposit-only','Use the LLC account for this LLC payee.');
  if(c.transaction==='cash') return action('accept','Complete the cashing verification workflow; deposit availability holds do not apply to cashing.');
  // Priority is deterministic for scenarios with more than one condition; acceptance comes first.
  const priorQualified=c.priorAccounts?qualifyingPriorAccount(c.priorAccounts):c.qualifyingPriorAccount;
  const reason=c.emergency?'emergency':c.reasonableCause?'reasonable':c.returnedUnpaid?'redeposited':c.accountAgeDays<30&&!priorQualified?'new':c.repeatedOverdraft||c.currentlyOverdrawn?'overdraft':c.dailyCheckDepositsCents>680000?'large':'none';
  result.holdType=reason;result.notice=reason!=='none';result.action=result.notice?'hold':'accept';
  const add=(cents,day)=> {if(cents>0) tiers.push({amountCents:cents,day});};
  const tiered=(middleDay,lastDay)=> {
    // Previous checks deposited today consume the daily allowance before this item.
    const previous=reason==='large'?Math.max(0,c.dailyCheckDepositsCents-amount):0;
    const same=Math.min(amount,Math.max(0,30000-previous));
    const middle=Math.min(amount-same,Math.max(0,680000-Math.max(previous,30000)));
    add(same,0);add(middle,middleDay);add(amount-same-middle,lastDay);
  };
  if(reason==='large') tiered(classification==='next-day'?1:2,onUs?2:7);
  else if(reason==='new') {if(classification==='next-day'&&!onUs) tiered(1,9);else add(amount,9);}
  else if(['reasonable','redeposited','emergency'].includes(reason)) add(amount,onUs?2:7);
  else if(reason==='overdraft') add(amount,classification==='next-day'?1:2);
  else {add(Math.min(amount,30000),0);add(Math.max(0,amount-30000),classification==='next-day'?1:2);}
  result.availability=tiers;
  const triggers = {
    large:'Aggregate banking-day check deposits exceed $6,800; earlier checks consume the daily allowances.',
    new:'The account is in its first 30 days and every customer has not satisfied the qualifying prior-account exception. On-Us checks are excluded from next-day treatment for this rule.',
    reasonable:'Confidential information indicates possible nonpayment. This case specifically supports Reasonable Cause; a review recommendation alone would not do so.',
    redeposited:'This item was returned unpaid. Correcting a missing endorsement or a formerly postdated check alone would not trigger this hold.',
    overdraft:c.currentlyOverdrawn?'The account is currently overdrawn; this rule applies to checks.':'The bank confirms repeated overdrafts during the six-month lookback; this rule applies to checks.',
    emergency:'A qualifying emergency outside bank control affects processing or payment.',
    none:priorQualified?'The qualifying prior account prevents new-account treatment; no other hold exception applies.':'No supplied hold exception applies. TrueChecks review by itself does not impose a hold.',
  };
  result.explanation.push(triggers[reason]);
  result.explanation.push(`${ITEM_TYPES[c.itemType]} is ${classification}. ${HOLD_TYPES[reason]}. ${availabilityText(tiers)}. ${result.notice?'Give a Hold Notice.':'No Hold Notice required.'}`);
  return result;
}

const variants=['clean','large','new','reasonable','redeposited','overdraft','emergency','missing','conditional','third-party','mark','restrictive','llc','and','or','unused','split','cash-back','noncustomer','corrected','postdate','truechecks','business','incorrect','cash','ach','wire','foreign','current-overdraft'];
export function createHoldScenario(random=Math.random,index=null) {
  const pick=values=>values[Math.min(values.length-1,Math.floor(random()*values.length))];
  const variant=index===null?pick(variants):variants[index%variants.length];
  let itemType=pick(Object.keys(ITEM_TYPES));
  // Exercise every exception rather than drowning them in incompatible electronic items.
  if(['large','new','reasonable','redeposited','overdraft','emergency'].includes(variant)) itemType=pick(['on-us','treasury','cashier','personal','business']);
  const c={variant,itemType,amountCents:pick([28000,50000,50100,250000,680000,900000,1240000]),accountAgeDays:pick([45,90,240]),dailyCheckDepositsCents:0,transaction:'deposit',endorsement:'normal',qualifyingPriorAccount:false,trueChecks:pick(['clear','review']),twoValidIds:true,payerApproved:true,llcAccount:true};
  if(!['large','new'].includes(variant)) c.amountCents=Math.min(c.amountCents,650000);
  c.dailyCheckDepositsCents=c.amountCents;
  if(variant==='large') {c.amountCents=900000;c.dailyCheckDepositsCents=900000+pick([0,10000,70000]);}
  if(variant==='new') {c.accountAgeDays=pick([1,15,29]);c.priorAccounts=[{transactional:true,atBurkeHerbert:true,ageDays:pick([20,30,90]),daysBeforeOpening:pick([0,15,30,45])}];c.qualifyingPriorAccount=qualifyingPriorAccount(c.priorAccounts);}
  if(variant==='reasonable') {c.reasonableCause=true;c.trueChecks='confidential-risk';c.amountCents=Math.max(50100,c.amountCents);}
  if(variant==='redeposited') c.returnedUnpaid=true;
  if(variant==='overdraft') {c.repeatedOverdraft=true;c.overdraftHistory='Bank review confirms repeated overdrafts under the supplied six-month rule.';}
  if(variant==='emergency') {c.emergency=true;c.emergencyDetails=pick(['Communication failure outside bank control','Computer failure outside bank control','Paying bank suspends payments','War / qualifying emergency outside bank control']);}
  if(['missing','conditional','third-party','mark','restrictive'].includes(variant)) {c.itemType='personal';c.endorsement=variant==='restrictive'?'deposit-only':variant;if(variant==='restrictive') c.transaction='cash';}
  if(variant==='mark'&&random()<0.5) {c.endorsement='normal';c.frontSignatureMark=true;}
  if(variant==='llc') {c.itemType='business';c.llc=true;c.businessNameReview=true;c.transaction=pick(['cash','deposit']);c.llcAccount=c.transaction==='deposit';}
  if(['and','or'].includes(variant)) {c.itemType='treasury';c.governmentJoin=variant.toUpperCase();c.allPayeesPresent=random()<0.35;}
  if(variant==='unused') {c.itemType='cashier';c.onUs=true;c.unusedCashier=true;c.endorsement=random()<0.5?'normal':'NOT USED FOR INTENDED PURPOSE';}
  if(variant==='split') {c.itemType='personal';c.physicalSplit=true;}
  if(variant==='cash-back') {c.itemType='personal';c.transaction='cash-back';}
  if(variant==='noncustomer') {c.itemType='on-us';c.nonCustomer=true;c.largeNonCustomer=true;c.presenterHistoryApplicable=true;c.transaction='cash';c.payerApproved=random()<0.65;c.twoValidIds=random()<0.85;}
  if(variant==='corrected') {c.itemType='personal';c.correctedEndorsement=true;}
  if(variant==='postdate') {c.itemType='personal';c.correctedPostdate=true;}
  if(variant==='truechecks') {c.itemType='personal';c.amountCents=125000;c.trueChecks='review';c.dailyCheckDepositsCents=c.amountCents;}
  if(variant==='business') {c.itemType='business';c.businessNameReview=true;}
  if(variant==='incorrect') {c.itemType='personal';c.incorrectInformation=true;}
  if(['cash','ach','wire','foreign'].includes(variant)) c.itemType=variant;
  if(variant==='current-overdraft') {c.itemType=pick(['on-us','personal']);c.currentlyOverdrawn=true;c.overdraftHistory='Account is currently overdrawn.';}
  if(variant!=='large') c.dailyCheckDepositsCents=c.amountCents;
  return c;
}

export function scoreHoldDecision(c,a={}) {
  const expected=decideCheck(c), errors=[], checks={};
  const check=(key,ok,label)=> {checks[key]={correct:ok,label};if(!ok) errors.push(label);};
  check('itemType',a.itemType===c.itemType,'Wrong Check Classification');
  check('classification',a.classification===expected.classification,'Wrong Availability Classification');
  check('action',a.action===expected.action,expected.action==='manager'?'Missed Manager Escalation':'Incorrect Acceptance');
  const process=['accept','hold'].includes(expected.action);
  if(process) {
    check('holdType',a.holdType===expected.holdType,expected.holdType==='none'?'Unnecessary Hold':a.holdType==='none'?'Missed Hold':'Hold Selection Error');
    if(expected.availability.length) check('availability',a.availability===availabilityKey(expected.availability),'Wrong Availability Period');
    check('notice',a.notice===(expected.notice?'given':'not-required'),expected.notice?'Missing Hold Notice':'Unnecessary Hold Notice');
  }
  for(const step of expected.workflow) check(step,a.workflow?.includes(step),`Missed ${WORKFLOW_LABELS[step]}`);
  if(expected.workflow.includes('verification-note') && c.payerApproved) check('note',/^Customer verified\s*\+\s*\d{4}-\d{2}-\d{2}\s*\+\s*\d{2}:\d{2}$/.test(a.note??''),'Missing Customer Verification Note');
  return {correct:errors.length===0,expected,errors,checks};
}
export const WORKFLOW_LABELS={'two-ids':'two valid IDs','payer-history':'payer account/history review','payer-signature':'payer signature/prior checks comparison','presenter-history':'presenter history review','contact-payer':'payer verification','verification-note':'customer verification note',truechecks:'TrueChecks / Alert Center Details review','business-history':'business name/history review','foreign-no-receipt':'foreign workflow without receipt','cash-back':'deposit-with-cash-back transaction'};
