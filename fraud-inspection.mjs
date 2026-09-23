export const FRAUD_INSPECTION_CATEGORIES = Object.freeze([
  { id: 'payee-mismatch', label: 'Payee name does not match ID', group: 'Name and payee' },
  { id: 'amount-mismatch', label: 'Numeric and written amounts do not match', group: 'Amount' },
  { id: 'date-issue', label: 'Check date is postdated, stale, impossible, or suspicious', group: 'Date' },
  { id: 'check-alteration', label: 'Visible erasure, overwrite, or alteration', group: 'Alteration' },
  { id: 'handwriting-issue', label: 'Different handwriting or ink appears suspicious', group: 'Alteration' },
  { id: 'missing-required-field', label: 'A required check field is missing', group: 'Required fields' },
  { id: 'endorsement-missing', label: 'Payee endorsement is missing', group: 'Endorsement and signatures' },
  { id: 'endorsement-signature-mismatch', label: 'Endorsement signature does not match ID signature', group: 'Endorsement and signatures' },
  { id: 'maker-signature-suspicious', label: 'Maker signature conflicts with the customer ID', group: 'Endorsement and signatures' },
  { id: 'check-number-mismatch', label: 'Printed and MICR check numbers do not match', group: 'Check and account details' },
  { id: 'routing-issue', label: 'Routing control does not match the exercise details', group: 'Check and account details' },
  { id: 'account-information-issue', label: 'Account control does not match the exercise details', group: 'Check and account details' },
  { id: 'id-expired', label: 'Customer ID is expired', group: 'Customer ID' },
  { id: 'id-information-inconsistent', label: 'Printed ID details or dates are inconsistent', group: 'Customer ID' },
  { id: 'id-altered', label: 'Customer ID shows a possible alteration', group: 'Customer ID' },
]);

const CATEGORY_BY_ID = new Map(FRAUD_INSPECTION_CATEGORIES.map((item) => [item.id, item]));
const CATEGORY_IDS = FRAUD_INSPECTION_CATEGORIES.map((item) => item.id);

export const FRAUD_INSPECTION_MODE_CONFIG = Object.freeze({
  Easy: Object.freeze({
    timeLimitSeconds: 60, questionCount: 10, minimumErrors: 0, maximumErrors: 2, allowNoErrorCases: true,
    signatureDifficulty: 'easy', handwritingSimilarity: 'easy', alterationSubtlety: 'easy',
    dateDifficulty: 'easy', nameMatchDifficulty: 'easy', amountMatchDifficulty: 'easy', idDifficulty: 'easy',
    fieldDensity: 'low', zoomAvailable: true, showTimer: true, automaticNext: false, instantFeedback: false,
    enabledCategories: CATEGORY_IDS, staleAfterDays: 180, randomDifficultyMixing: false,
  }),
  Medium: Object.freeze({
    timeLimitSeconds: 40, questionCount: 10, minimumErrors: 0, maximumErrors: 4, allowNoErrorCases: true,
    signatureDifficulty: 'medium', handwritingSimilarity: 'medium', alterationSubtlety: 'medium',
    dateDifficulty: 'medium', nameMatchDifficulty: 'medium', amountMatchDifficulty: 'medium', idDifficulty: 'medium',
    fieldDensity: 'medium', zoomAvailable: true, showTimer: true, automaticNext: false, instantFeedback: true,
    enabledCategories: CATEGORY_IDS, staleAfterDays: 180, randomDifficultyMixing: false,
  }),
  Hard: Object.freeze({
    timeLimitSeconds: 20, questionCount: 10, minimumErrors: 0, maximumErrors: 5, allowNoErrorCases: true,
    signatureDifficulty: 'hard', handwritingSimilarity: 'hard', alterationSubtlety: 'hard',
    dateDifficulty: 'hard', nameMatchDifficulty: 'hard', amountMatchDifficulty: 'hard', idDifficulty: 'hard',
    fieldDensity: 'high', zoomAvailable: true, showTimer: true, automaticNext: false, instantFeedback: true,
    enabledCategories: CATEGORY_IDS, staleAfterDays: 180, randomDifficultyMixing: false,
  }),
});

export const FRAUD_INSPECTION_RUN_MODES = Object.freeze([
  { id: 'standard', label: 'Standard', description: 'Use the selected case count and difficulty timer.' },
  { id: 'rapid-review', label: 'Rapid Review', description: '10 cases at 15 seconds each with quick transitions.' },
  { id: 'sudden-death', label: 'Sudden Death', description: 'A missed issue or false positive ends the run.' },
  { id: 'endurance', label: 'Endurance', description: '30 cases with cumulative results and average time.' },
]);

const FIRST_NAMES = ['Avery', 'Jordan', 'Sofia', 'Marcus', 'Nia', 'Ethan', 'Maya', 'Julian', 'Imani', 'Noah', 'Leila', 'Caleb', 'Rosa', 'Devon', 'Priya', 'Mateo'];
const ID_PORTRAIT_BY_FIRST_NAME = {
  Avery: 'male', Jordan: 'female', Sofia: 'female', Marcus: 'male', Nia: 'female', Ethan: 'male',
  Maya: 'female', Julian: 'male', Imani: 'female', Noah: 'male', Leila: 'female', Caleb: 'male',
  Rosa: 'female', Devon: 'male', Priya: 'female', Mateo: 'male',
};
const LAST_NAMES = ['Bennett', 'Patel', 'Rodriguez', 'Chen', 'Johnson', 'Kim', 'Okafor', 'Rivera', 'Foster', 'Nguyen', 'Miller', 'Brooks', 'Garcia', 'Reed', 'Alvarez', 'Carter'];
const STREETS = ['Maple Row', 'Harbor Lane', 'Juniper Street', 'Cedar Walk', 'Orchard Avenue', 'Lakeview Drive', 'Willow Court', 'Beacon Road'];
const CITIES = ['Fairview', 'Lakehurst', 'Brookdale', 'Northfield', 'Millhaven', 'Cedar Point'];
const STATES = ['OR', 'VT', 'NM', 'ME', 'IA', 'AZ', 'RI', 'CO'];
const MAKERS = ['Harborlight Studio', 'Juniper Supply Co.', 'Westbrook Market', 'Northfield Arts Council', 'Cedar Row Services', 'Maple Street Books'];
const DOCUMENT_PALETTES = [
  { paper: '#fffef8', ink: '#17272a', accent: '#245d64', rule: '#c4d2ce' },
  { paper: '#fffdf5', ink: '#28313f', accent: '#6b536f', rule: '#d4cbc8' },
  { paper: '#fcfff9', ink: '#25352c', accent: '#526d49', rule: '#c8d0c4' },
];
const ORDINALS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};
const choice = (values, random) => values[Math.min(values.length - 1, Math.floor(Math.max(0, Math.min(0.999999999, random())) * values.length))];
const randomInteger = (minimum, maximum, random) => minimum + Math.floor(Math.max(0, Math.min(0.999999999, random())) * (maximum - minimum + 1));
const shuffle = (items, random) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.max(0, Math.min(0.999999999, random())) * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};
const toUtc = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date, days) => new Date(toUtc(date).getTime() + days * 86400000);
const isoDate = (date) => toUtc(date).toISOString().slice(0, 10);
const compactDate = (date) => {
  const value = toUtc(date);
  return String(value.getUTCMonth() + 1).padStart(2, '0') + '/' + String(value.getUTCDate()).padStart(2, '0') + '/' + value.getUTCFullYear();
};
const randomPerson = (random) => {
  const first = choice(FIRST_NAMES, random);
  const last = choice(LAST_NAMES, random);
  const middle = choice(['A.', 'J.', 'M.', 'R.', 'T.', 'L.', ''], random);
  return { first, last, middle, name: [first, middle, last].filter(Boolean).join(' ') };
};
const dollars = (value) => '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const joinWords = (parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

function numberWords(value) {
  if (value < 20) return ORDINALS[value];
  if (value < 100) return joinWords([TENS_WORDS[Math.floor(value / 10)], value % 10 ? ORDINALS[value % 10] : '']);
  if (value < 1000) return joinWords([ORDINALS[Math.floor(value / 100)], 'hundred', value % 100 ? numberWords(value % 100) : '']);
  return joinWords([numberWords(Math.floor(value / 1000)), 'thousand', value % 1000 ? numberWords(value % 1000) : '']);
}

function amountInWords(cents) {
  const whole = Math.floor(cents / 100);
  const remainder = cents % 100;
  return (numberWords(whole).replace(/^./, (letter) => letter.toUpperCase()) + ' dollars and '
    + String(remainder).padStart(2, '0') + '/100');
}

function formatExerciseDate(date, random) {
  const normalized = toUtc(date);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return random() < 0.35
    ? monthNames[normalized.getUTCMonth()] + ' ' + normalized.getUTCDate() + ', ' + normalized.getUTCFullYear()
    : compactDate(normalized);
}

export function resolveFraudInspectionSettings(difficulty = 'Easy', overrides = {}, runMode = 'standard') {
  const preset = FRAUD_INSPECTION_MODE_CONFIG[difficulty] ?? FRAUD_INSPECTION_MODE_CONFIG.Medium;
  const source = { ...preset, ...(overrides ?? {}) };
  const enabledCategories = [...new Set((Array.isArray(source.enabledCategories) ? source.enabledCategories : CATEGORY_IDS)
    .filter((id) => CATEGORY_BY_ID.has(id)))];
  const minimumErrors = clampInteger(source.minimumErrors, preset.minimumErrors, 0, 8);
  const maximumErrors = clampInteger(source.maximumErrors, preset.maximumErrors, 0, 8);
  const normalizedRunMode = FRAUD_INSPECTION_RUN_MODES.some((mode) => mode.id === runMode) ? runMode : 'standard';
  const settings = {
    ...preset, ...source,
    difficulty,
    runMode: normalizedRunMode,
    timeLimitSeconds: clampInteger(source.timeLimitSeconds, preset.timeLimitSeconds, 5, 300),
    questionCount: clampInteger(source.questionCount, preset.questionCount, 1, 100),
    minimumErrors: Math.min(minimumErrors, maximumErrors),
    maximumErrors,
    allowNoErrorCases: Boolean(source.allowNoErrorCases),
    enabledCategories: enabledCategories.length ? enabledCategories : [...CATEGORY_IDS],
    staleAfterDays: clampInteger(source.staleAfterDays, 180, 30, 3650),
    signatureDifficulty: ['easy', 'medium', 'hard'].includes(source.signatureDifficulty) ? source.signatureDifficulty : preset.signatureDifficulty,
    handwritingSimilarity: ['easy', 'medium', 'hard'].includes(source.handwritingSimilarity) ? source.handwritingSimilarity : preset.handwritingSimilarity,
    alterationSubtlety: ['easy', 'medium', 'hard'].includes(source.alterationSubtlety) ? source.alterationSubtlety : preset.alterationSubtlety,
    dateDifficulty: ['easy', 'medium', 'hard'].includes(source.dateDifficulty) ? source.dateDifficulty : preset.dateDifficulty,
    nameMatchDifficulty: ['easy', 'medium', 'hard'].includes(source.nameMatchDifficulty) ? source.nameMatchDifficulty : preset.nameMatchDifficulty,
    amountMatchDifficulty: ['easy', 'medium', 'hard'].includes(source.amountMatchDifficulty) ? source.amountMatchDifficulty : preset.amountMatchDifficulty,
    idDifficulty: ['easy', 'medium', 'hard'].includes(source.idDifficulty) ? source.idDifficulty : preset.idDifficulty,
    fieldDensity: ['low', 'medium', 'high'].includes(source.fieldDensity) ? source.fieldDensity : preset.fieldDensity,
    zoomAvailable: Boolean(source.zoomAvailable),
    showTimer: source.showTimer !== false,
    automaticNext: Boolean(source.automaticNext),
    instantFeedback: Boolean(source.instantFeedback),
    randomDifficultyMixing: Boolean(source.randomDifficultyMixing),
  };
  if (!settings.allowNoErrorCases && settings.maximumErrors > 0) settings.minimumErrors = Math.max(1, settings.minimumErrors);
  if (normalizedRunMode === 'rapid-review') {
    settings.questionCount = 10;
    settings.timeLimitSeconds = 15;
    settings.automaticNext = true;
    settings.instantFeedback = true;
  } else if (normalizedRunMode === 'endurance') {
    settings.questionCount = 30;
    settings.automaticNext = true;
  }
  return settings;
}

function mutateName(name, difficulty, random) {
  const words = name.split(' ');
  const person = randomPerson(random);
  if (difficulty === 'easy') return person.first + ' ' + words.at(-1);
  const source = words.find((word) => word.length > 4) ?? words[0];
  const position = randomInteger(1, Math.max(1, source.length - 2), random);
  const changed = source.slice(0, position) + source.slice(position + 1);
  const index = words.indexOf(source);
  words[index] = changed;
  return words.join(' ');
}

function mutateSignature(name, difficulty, random) {
  const person = name.split(' ');
  const surname = person.at(-1) ?? 'Sample';
  const firstInitial = (person[0] ?? 'X').slice(0, 1);
  if (difficulty === 'easy') return choice(['R. Morgan', 'T. Ellis', 'D. Brooks', 'M. Rowan'], random);
  if (difficulty === 'medium') return firstInitial + '. ' + surname.slice(0, Math.max(2, surname.length - 2)) + 'n';
  return firstInitial + ' ' + surname.slice(0, Math.max(2, surname.length - 1)) + choice(['e', 'a', 'i'], random);
}

function dateBirthFor(exerciseDate, random) {
  const age = randomInteger(23, 69, random);
  const month = randomInteger(0, 11, random);
  const day = randomInteger(1, 27, random);
  return new Date(Date.UTC(exerciseDate.getUTCFullYear() - age, month, day));
}

function signatureVariation(random) {
  return {
    style: randomInteger(0, 4, random),
    size: randomInteger(22, 27, random),
    slant: randomInteger(-8, 8, random),
    spacing: randomInteger(-1, 2, random),
  };
}

function baseCase(difficulty, settings, random, exerciseDate) {
  const palette = choice(DOCUMENT_PALETTES, random);
  const person = randomPerson(random);
  const address = randomInteger(10, 989, random) + ' ' + choice(STREETS, random);
  const city = choice(CITIES, random);
  const state = choice(STATES, random);
  const zip = String(randomInteger(10000, 99999, random));
  const customerIsMaker = settings.enabledCategories.includes('maker-signature-suspicious')
    && (random() < 0.24 || settings.enabledCategories.length === 1);
  const makerName = customerIsMaker ? person.name : choice(MAKERS, random);
  const checkNumber = String(randomInteger(1042, 9987, random));
  const amountDollars = choice([57, 125, 280, 625, 1250, 2400, 7300], random);
  const amountCents = amountDollars * 100;
  const today = toUtc(exerciseDate);
  const checkDate = addDays(today, -randomInteger(0, 35, random));
  const idExpiration = addDays(today, 365 * randomInteger(1, 5, random));
  const birthDate = dateBirthFor(today, random);
  const routingControl = '990' + String(randomInteger(100000, 999999, random));
  const accountControl = 'TRN-' + String(randomInteger(1000, 9999, random)) + '-' + String(randomInteger(10, 99, random));
  const variation = signatureVariation(random);
  const checkSignature = customerIsMaker ? person.name : randomPerson(random).name;
  return {
    caseId: 'fraud-' + String(randomInteger(100000, 999999, random)),
    difficulty,
    exerciseDate: isoDate(today),
    staleAfterDays: settings.staleAfterDays,
    customerIsMaker,
    signatureVariationIsValid: true,
    document: { palette, layout: randomInteger(0, 2, random), olderDesign: random() < 0.18 },
    id: {
      legalName: person.name,
      firstName: person.first,
      middleInitial: person.middle,
      lastName: person.last,
      address: address + ', ' + city + ', ' + state + ' ' + zip,
      idNumber: 'TRN-' + String(today.getUTCFullYear()).slice(-2) + '-' + String(randomInteger(100000, 999999, random)),
      issuingState: state,
      dateOfBirth: compactDate(birthDate),
      expirationDate: isoDate(idExpiration),
      expirationText: compactDate(idExpiration),
      signature: person.name,
      signatureVariation: variation,
      portrait: ID_PORTRAIT_BY_FIRST_NAME[person.first] ?? 'male',
      issueDate: isoDate(addDays(today, -365 * randomInteger(1, 4, random))),
      alterationMarks: [],
    },
    check: {
      payeeName: person.name,
      makerName,
      makerSignature: checkSignature,
      makerSignatureVariation: customerIsMaker ? variation : signatureVariation(random),
      date: isoDate(checkDate),
      dateText: formatExerciseDate(checkDate, random),
      numericAmount: dollars(amountCents / 100),
      numericAmountCents: amountCents,
      writtenAmount: amountInWords(amountCents),
      checkNumber,
      micrCheckNumber: checkNumber,
      routingNumber: routingControl,
      routingControl,
      accountNumber: accountControl,
      accountControl,
      referenceNumber: 'R-' + String(randomInteger(10000, 99999, random)),
      endorsementSignature: person.name,
      endorsementVariation: signatureVariation(random),
      memoText: choice(['Equipment order', 'Workshop supplies', 'Monthly service', 'Invoice 2417', 'Community program'], random),
      memoInk: 'navy',
      alterationMarks: [],
    },
    policy: 'Simulator date rule: checks more than ' + settings.staleAfterDays + ' days before the exercise date are stale.',
    validOddity: choice(['', 'Older check layout, otherwise valid', 'Date uses a different valid format', 'Natural signature variation'], random),
  };
}

function applyIssue(challenge, id, settings, random) {
  const issue = { id, label: CATEGORY_BY_ID.get(id).label, group: CATEGORY_BY_ID.get(id).group, regions: [] };
  const check = challenge.check;
  const identity = challenge.id;
  if (id === 'payee-mismatch') {
    check.payeeName = mutateName(identity.legalName, settings.nameMatchDifficulty, random);
    issue.regions = ['check-payee', 'id-name'];
    issue.explanation = 'ID: ' + identity.legalName + '. Check payee: ' + check.payeeName + '. The names differ.';
  } else if (id === 'amount-mismatch') {
    const difference = settings.amountMatchDifficulty === 'easy' ? 5500 : settings.amountMatchDifficulty === 'medium' ? 500 : 100;
    const alteredCents = check.numericAmountCents + difference;
    check.numericAmount = dollars(alteredCents / 100);
    check.numericAmountCents = alteredCents;
    issue.regions = ['check-numeric-amount', 'check-written-amount'];
    issue.explanation = 'Numeric amount: ' + check.numericAmount + '. Written amount: ' + check.writtenAmount + '. They do not agree.';
  } else if (id === 'date-issue') {
    const variants = settings.dateDifficulty === 'easy'
      ? ['postdated', 'impossible', 'stale']
      : settings.dateDifficulty === 'medium'
      ? ['postdated', 'stale', 'year-change', 'impossible']
        : ['year-change', 'stale', 'postdated', 'impossible', 'rewritten'];
    const variant = choice(variants, random);
    issue.variant = variant;
    if (variant === 'postdated') {
      check.date = isoDate(addDays(new Date(challenge.exerciseDate + 'T00:00:00Z'), randomInteger(1, 20, random)));
      check.dateText = compactDate(new Date(check.date + 'T00:00:00Z'));
      issue.explanation = 'The check is dated ' + check.dateText + ', after the exercise date ' + compactDate(new Date(challenge.exerciseDate + 'T00:00:00Z')) + '.';
    } else if (variant === 'rewritten') {
      check.alterationMarks.push({ field: 'date', kind: settings.alterationSubtlety === 'hard' ? 'fine-overwrite' : 'erasure' });
      issue.explanation = 'The date writing has an overwrite in the year field.';
    } else if (variant === 'stale' || variant === 'year-change') {
      const daysOld = variant === 'year-change' ? 365 : challenge.staleAfterDays + randomInteger(1, 190, random);
      check.date = isoDate(addDays(new Date(challenge.exerciseDate + 'T00:00:00Z'), -daysOld));
      check.dateText = compactDate(new Date(check.date + 'T00:00:00Z'));
      issue.explanation = "The year on the check is " + check.date.slice(0, 4) + ". Under the simulator's " + challenge.staleAfterDays + "-day rule it is stale.";
    } else {
      check.date = 'invalid';
      check.dateText = '02/30/' + challenge.exerciseDate.slice(0, 4);
      issue.explanation = 'February 30 is not a valid calendar date.';
    }
    issue.regions = ['check-date'];
  } else if (id === 'check-alteration') {
    const subtle = settings.alterationSubtlety === 'hard';
    const field = choice(['memo', 'date', 'payee', 'amount'], random);
    check.alterationMarks.push({ field, kind: subtle ? 'fine-overwrite' : 'erasure' });
    if (field === 'memo') check.memoText = subtle ? 'Invoice 2417' : 'Office supplies';
    issue.regions = [field === 'amount' ? 'check-numeric-amount' : 'check-' + field];
    issue.explanation = subtle
      ? 'A small overwrite and alignment shift remain visible in the ' + field + ' field.'
      : 'The ' + field + ' field has a white-out-like patch and overwritten writing.';
  } else if (id === 'handwriting-issue') {
    check.memoInk = settings.handwritingSimilarity === 'easy' ? 'blue-bold' : 'violet-fine';
    check.memoHandwriting = settings.handwritingSimilarity === 'hard' ? 'close' : 'different';
    issue.regions = ['check-memo'];
    issue.explanation = 'The memo uses a different pen and writing style from the other handwritten check entries.';
  } else if (id === 'missing-required-field') {
    check.makerSignature = '';
    issue.regions = ['check-maker-signature'];
    issue.explanation = 'The maker signature line is blank.';
  } else if (id === 'endorsement-missing') {
    check.endorsementSignature = '';
    issue.regions = ['check-endorsement'];
    issue.explanation = 'The payee endorsement area on the back is blank.';
  } else if (id === 'endorsement-signature-mismatch') {
    check.endorsementSignature = mutateSignature(identity.legalName, settings.signatureDifficulty, random);
    check.endorsementVariation = signatureVariation(random);
    issue.regions = ['check-endorsement', 'id-signature'];
    issue.explanation = 'The endorsement reads ' + check.endorsementSignature + ', while the ID signature is ' + identity.signature + '.';
  } else if (id === 'maker-signature-suspicious') {
    check.makerSignature = mutateSignature(identity.legalName, settings.signatureDifficulty, random);
    check.makerSignatureVariation = signatureVariation(random);
    challenge.signatureVariationIsValid = false;
    issue.regions = ['check-maker-signature', 'id-signature'];
    issue.explanation = 'This scenario names the customer as the maker. The front signature differs from the customer ID signature.';
  } else if (id === 'check-number-mismatch') {
    check.micrCheckNumber = String(Number(check.checkNumber) + 7).padStart(check.checkNumber.length, '0');
    issue.regions = ['check-number', 'check-micr'];
    issue.explanation = 'Printed check number ' + check.checkNumber + ' does not match MICR number ' + check.micrCheckNumber + '.';
  } else if (id === 'routing-issue') {
    check.routingNumber = '990' + String(randomInteger(100000, 999999, random));
    if (check.routingNumber === check.routingControl) check.routingNumber = check.routingControl.slice(0, -1) + (Number(check.routingControl.slice(-1)) + 1) % 10;
    issue.regions = ['check-micr', 'routing-control'];
    issue.explanation = 'The routing field ' + check.routingNumber + ' differs from the simulator control ' + check.routingControl + '.';
  } else if (id === 'account-information-issue') {
    check.accountNumber = 'TRN-' + String(randomInteger(1000, 9999, random)) + '-' + String(randomInteger(10, 99, random));
    if (check.accountNumber === check.accountControl) check.accountNumber = 'TRN-0000-00';
    issue.regions = ['check-micr', 'account-control'];
    issue.explanation = 'The account field does not match the simulator control ' + check.accountControl + '.';
  } else if (id === 'id-expired') {
    identity.expirationDate = isoDate(addDays(new Date(challenge.exerciseDate + 'T00:00:00Z'), -randomInteger(1, 720, random)));
    identity.expirationText = compactDate(new Date(identity.expirationDate + 'T00:00:00Z'));
    issue.regions = ['id-expiration'];
    issue.explanation = 'The ID expiration date ' + identity.expirationText + ' is before the exercise date.';
  } else if (id === 'id-information-inconsistent') {
    const variant = settings.idDifficulty === 'easy' ? 'future-birth-date'
      : choice(['future-birth-date', 'issue-after-expiration'], random);
    issue.variant = variant;
    if (variant === 'future-birth-date') {
      identity.dateOfBirth = compactDate(addDays(new Date(challenge.exerciseDate + 'T00:00:00Z'), 30));
      issue.regions = ['id-birth-date'];
      issue.explanation = 'The birth date is in the future relative to the exercise date.';
    } else {
      identity.issueDate = isoDate(addDays(new Date(identity.expirationDate + 'T00:00:00Z'), 20));
      issue.regions = ['id-issue-date', 'id-expiration'];
      issue.explanation = 'The printed issue date is after the ID expiration date.';
    }
  } else if (id === 'id-altered') {
    if (settings.idDifficulty === 'hard' && random() < 0.35) {
      identity.photoObscured = true;
      issue.regions = ['id-photo'];
      issue.explanation = 'A correction-like smear covers part of the ID portrait.';
    } else {
      identity.address = identity.address.replace(/, [A-Z]{2} /, ' Apt 6, XX ');
      identity.alterationMarks.push({ field: 'address', kind: settings.alterationSubtlety === 'hard' ? 'fine-overwrite' : 'erasure' });
      issue.regions = ['id-address'];
      issue.explanation = 'The ID address has a white-out-like patch and altered lettering.';
    }
  }
  issue.description = issue.explanation;
  return issue;
}

function eligibleCategoryIds(challenge, settings) {
  return settings.enabledCategories.filter((id) => id !== 'maker-signature-suspicious' || challenge.customerIsMaker);
}

export function createFraudInspectionCase(difficulty = 'Easy', overrides = {}, random = Math.random, exerciseDate = new Date()) {
  const settings = resolveFraudInspectionSettings(difficulty, overrides, overrides?.runMode);
  const mixedLevel = settings.randomDifficultyMixing ? choice(['Easy', 'Medium', 'Hard'], random) : difficulty;
  const mixedPreset = FRAUD_INSPECTION_MODE_CONFIG[mixedLevel] ?? FRAUD_INSPECTION_MODE_CONFIG.Medium;
  const useMixedAxes = difficulty !== 'Custom' || settings.randomDifficultyMixing;
  const scenarioSettings = {
    ...mixedPreset,
    ...settings,
    signatureDifficulty: useMixedAxes ? mixedPreset.signatureDifficulty : settings.signatureDifficulty,
    handwritingSimilarity: useMixedAxes ? mixedPreset.handwritingSimilarity : settings.handwritingSimilarity,
    alterationSubtlety: useMixedAxes ? mixedPreset.alterationSubtlety : settings.alterationSubtlety,
    dateDifficulty: useMixedAxes ? mixedPreset.dateDifficulty : settings.dateDifficulty,
    nameMatchDifficulty: useMixedAxes ? mixedPreset.nameMatchDifficulty : settings.nameMatchDifficulty,
    amountMatchDifficulty: useMixedAxes ? mixedPreset.amountMatchDifficulty : settings.amountMatchDifficulty,
    idDifficulty: useMixedAxes ? mixedPreset.idDifficulty : settings.idDifficulty,
  };
  const challenge = baseCase(difficulty, settings, random, exerciseDate);
  challenge.caseDifficulty = mixedLevel;
  challenge.settings = settings;
  const candidates = shuffle(eligibleCategoryIds(challenge, settings), random);
  const maximum = Math.min(settings.maximumErrors, candidates.length);
  const requestedMinimum = Math.min(settings.minimumErrors, maximum);
  const minimum = settings.allowNoErrorCases ? requestedMinimum : Math.max(1, requestedMinimum);
  let issueCount = maximum > 0 ? randomInteger(minimum, maximum, random) : 0;
  if (settings.allowNoErrorCases && random() < (difficulty === 'Easy' ? 0.42 : 0.32)) issueCount = 0;
  const chosen = candidates.slice(0, issueCount);
  if (chosen.includes('maker-signature-suspicious') && chosen.includes('missing-required-field')) {
    const replacement = candidates.find((id) => !chosen.includes(id));
    if (replacement) chosen[chosen.indexOf('maker-signature-suspicious')] = replacement;
    else chosen.splice(chosen.indexOf('maker-signature-suspicious'), 1);
  }
  const issueRegions = new Set();
  challenge.expectedIssues = [];
  for (const id of chosen) {
    if (id === 'maker-signature-suspicious' && chosen.includes('missing-required-field')) continue;
    const issue = applyIssue(challenge, id, scenarioSettings, random);
    for (const region of issue.regions) issueRegions.add(region);
    challenge.expectedIssues.push(issue);
  }
  challenge.enabledCategories = [...settings.enabledCategories];
  challenge.availableIssueOptions = FRAUD_INSPECTION_CATEGORIES.filter((item) => challenge.enabledCategories.includes(item.id));
  challenge.document.issueRegions = [...issueRegions];
  challenge.exerciseDateText = compactDate(new Date(challenge.exerciseDate + 'T00:00:00Z'));
  challenge.signatureVariationIsValid = challenge.signatureVariationIsValid && !challenge.expectedIssues.some((issue) => issue.id === 'endorsement-signature-mismatch');
  challenge.settings = { ...settings, scenarioDifficulty: mixedLevel };
  return challenge;
}

export function scoreFraudInspectionAttempt(challenge, selectedIds = [], timedOut = false) {
  const available = new Set(challenge.enabledCategories ?? CATEGORY_IDS);
  const selected = new Set(selectedIds.filter((id) => available.has(id)));
  const expected = new Set((challenge.expectedIssues ?? []).map((issue) => issue.id));
  const correctlySelected = [...selected].filter((id) => expected.has(id));
  const missedIssueIds = [...expected].filter((id) => !selected.has(id));
  const falsePositiveIds = [...selected].filter((id) => !expected.has(id));
  const trueNegatives = [...available].filter((id) => !selected.has(id) && !expected.has(id));
  const categoryResults = Object.fromEntries([...available].map((id) => [
    id,
    expected.has(id) ? selected.has(id) ? 'found' : 'missed' : selected.has(id) ? 'false-positive' : 'valid',
  ]));
  const accuracyPercent = available.size
    ? Math.round(((correctlySelected.length + trueNegatives.length) / available.size) * 100)
    : 100;
  const correct = missedIssueIds.length === 0 && falsePositiveIds.length === 0 && !timedOut;
  return {
    correct,
    timedOut,
    expectedCount: expected.size,
    selectedCount: selected.size,
    correctlySelectedIds: correctlySelected,
    missedIssueIds,
    falsePositiveIds,
    trueNegativeCount: trueNegatives.length,
    cleanCase: expected.size === 0,
    correctlyRecognizedClean: expected.size === 0 && selected.size === 0 && !timedOut,
    accuracyPercent,
    falsePositiveRatePercent: trueNegatives.length + falsePositiveIds.length
      ? Math.round((falsePositiveIds.length / (trueNegatives.length + falsePositiveIds.length)) * 100) : 0,
    missedIssueRatePercent: expected.size ? Math.round((missedIssueIds.length / expected.size) * 100) : 0,
    categoryResults,
  };
}

const medianOf = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const meanOf = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function summarizeFraudHistory(records = []) {
  const cases = records.filter((record) => record && record.outcome !== 'Not answered'
    && (record.game === 'fraud-inspection' || String(record.gameType ?? '').toLowerCase() === 'check & id fraud inspection'));
  const times = cases.map((record) => Number(record.timeUsedSeconds ?? record.fraudTimeUsedSeconds))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const totalNegatives = cases.reduce((sum, record) => sum + Math.max(0,
    Number(record.fraudSelectableCategoryCount ?? 0) - (record.fraudExpectedCategories?.length ?? 0)), 0);
  const falsePositives = cases.reduce((sum, record) => sum + Number(record.fraudFalsePositiveCount ?? 0), 0);
  const expectedIssues = cases.reduce((sum, record) => sum + (record.fraudExpectedCategories?.length ?? 0), 0);
  const missedIssues = cases.reduce((sum, record) => sum + Number(record.fraudFalseNegativeCount ?? 0), 0);
  const cleanChecksCorrectlyRecognized = cases.filter((record) => record.fraudCleanCase === true
    && record.fraudCorrectlyRecognizedClean === true).length;
  const exactSetAccuracyPercent = cases.length
    ? Math.round((cases.filter((record) => record.outcome === 'Correct').length / cases.length) * 100) : null;
  let currentStreak = 0;
  let bestStreak = 0;
  for (const record of cases) {
    currentStreak = record.outcome === 'Correct' ? currentStreak + 1 : 0;
    bestStreak = Math.max(bestStreak, currentStreak);
  }
  const groupMap = new Map();
  for (const record of cases) {
    for (const [id, result] of Object.entries(record.fraudCategoryResults ?? {})) {
      if (!groupMap.has(id)) groupMap.set(id, { id, label: CATEGORY_BY_ID.get(id)?.label ?? id, expectedCount: 0, foundCount: 0, missedCount: 0, falsePositiveCount: 0 });
      const group = groupMap.get(id);
      if (result === 'found') { group.expectedCount += 1; group.foundCount += 1; }
      else if (result === 'missed') { group.expectedCount += 1; group.missedCount += 1; }
      else if (result === 'false-positive') group.falsePositiveCount += 1;
    }
  }
  const byCategory = [...groupMap.values()].map((group) => ({
    ...group,
    accuracyPercent: group.expectedCount ? Math.round((group.foundCount / group.expectedCount) * 100) : null,
  })).sort((left, right) => (left.accuracyPercent ?? 101) - (right.accuracyPercent ?? 101) || right.missedCount - left.missedCount);
  const supportedWeaknesses = byCategory.filter((group) => group.expectedCount >= 3);
  const weakestCategory = supportedWeaknesses[0] ?? null;
  const mostFrequentlyMissedCategory = byCategory.filter((group) => group.missedCount > 0)
    .sort((left, right) => right.missedCount - left.missedCount || left.label.localeCompare(right.label))[0] ?? null;
  const byDifficulty = [...new Set(cases.map((record) => record.fraudCaseDifficulty ?? record.difficulty).filter(Boolean))]
    .map((difficulty) => {
      const group = cases.filter((record) => (record.fraudCaseDifficulty ?? record.difficulty) === difficulty);
      return { difficulty, cases: group.length, accuracyPercent: meanOf(group.map((record) => Number(record.fraudClassificationAccuracyPercent)).filter(Number.isFinite)) };
    });
  const byTimer = [...new Set(cases.map((record) => Number(record.fraudTimeLimitSeconds)).filter((value) => Number.isFinite(value) && value > 0))]
    .sort((left, right) => left - right)
    .map((seconds) => {
      const group = cases.filter((record) => Number(record.fraudTimeLimitSeconds) === seconds);
      return { seconds, cases: group.length, accuracyPercent: meanOf(group.map((record) => Number(record.fraudClassificationAccuracyPercent)).filter(Number.isFinite)) };
    });
  const runModes = [...new Set(cases.map((record) => record.fraudRunMode).filter(Boolean))];
  return {
    casesReviewed: cases.length,
    accuracyPercent: meanOf(cases.map((record) => Number(record.fraudClassificationAccuracyPercent)).filter(Number.isFinite)),
    exactSetAccuracyPercent,
    currentStreak,
    bestStreak,
    averageInspectionTimeSeconds: meanOf(times),
    medianInspectionTimeSeconds: medianOf(times),
    falsePositiveRatePercent: totalNegatives ? Math.round((falsePositives / totalNegatives) * 100) : null,
    missedIssueRatePercent: expectedIssues ? Math.round((missedIssues / expectedIssues) * 100) : null,
    falsePositiveCount: falsePositives,
    missedIssueCount: missedIssues,
    cleanChecksCorrectlyRecognized,
    byCategory,
    byDifficulty,
    byTimer,
    runModes,
    weakestCategory,
    mostFrequentlyMissedCategory,
    recommendedChallenge: weakestCategory
      ? 'Try ' + (weakestCategory.accuracyPercent < 70 ? 'Medium' : 'Hard') + ' difficulty with a 25-second timer; focus on ' + weakestCategory.label.toLowerCase() + '.'
      : cases.length >= 3 ? 'No category has three examples yet. Continue varied cases to build a supported focus.' : 'Review three or more cases to get an evidence-based challenge.',
  };
}
