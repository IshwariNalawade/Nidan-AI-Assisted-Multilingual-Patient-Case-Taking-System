import type { QuestionDefinition, QuestionContext, SymptomKey } from '../types.js'

export interface SymptomModule {
  key: SymptomKey
  label: string
  shortLabel: string
  icon: string
  description: string
  keywords: string[]
  questions: QuestionDefinition[]
}

const notMale = (context: QuestionContext) => context.profile.sex !== 'male'
const stomachPregnancy = (context: QuestionContext) => notMale(context) && Number(context.profile.age) >= 12

export const symptomModules: SymptomModule[] = [
  {
    key: 'headache', label: 'Headache', shortLabel: 'Head / headache', icon: '↗', description: 'Pain in the head, face or neck area.', keywords: ['headache', 'head pain', 'migraine', 'सिरदर्द', 'डोकेदुखी'],
    questions: [
      { id: 'head_onset', label: 'When did the headache begin, and did it start suddenly or gradually?', answerType: 'text', placeholder: 'For example: this morning, gradual / suddenly 20 minutes ago' },
      { id: 'head_location', label: 'Where do you feel the pain?', answerType: 'text', placeholder: 'For example: one side, behind my eyes, all over' },
      { id: 'head_severity', label: 'How severe is it from 1 to 10?', answerType: 'scale' },
      { id: 'head_associated', label: 'Do you have nausea, vision changes, fever, neck stiffness, weakness, or trouble speaking?', answerType: 'text', placeholder: 'Tell us what applies, or write none' },
      { id: 'head_pattern', label: 'What makes it better or worse?', answerType: 'text', placeholder: 'Movement, light, food, rest, medicine, or not sure' }
    ]
  },
  {
    key: 'fever', label: 'Fever', shortLabel: 'Fever / chills', icon: '°', description: 'Feeling hot, feverish or having chills.', keywords: ['fever', 'temperature', 'chills', 'hot', 'बुखार', 'ताप'],
    questions: [
      { id: 'fever_duration', label: 'How long have you felt feverish?', answerType: 'text', placeholder: 'For example: since yesterday' },
      { id: 'fever_temp', label: 'Have you measured your temperature? If yes, what was it?', answerType: 'text', placeholder: 'For example: 101°F, or not measured' },
      { id: 'fever_chills', label: 'Have you had chills, body aches or a rash?', answerType: 'text', placeholder: 'Tell us what applies' },
      { id: 'fever_other', label: 'Do you also have a cough, breathing difficulty, vomiting, diarrhoea, or trouble drinking fluids?', answerType: 'text', placeholder: 'Tell us what applies, or write none' },
      { id: 'fever_risk', label: 'Is the patient a baby, older adult, pregnant, or living with a serious long-term condition?', answerType: 'yesno' }
    ]
  },
  {
    key: 'cough', label: 'Cough or breathing problem', shortLabel: 'Cough / breathing', icon: '≈', description: 'Cough, wheezing or shortness of breath.', keywords: ['cough', 'breath', 'breathing', 'wheeze', 'दम', 'खांसी', 'श्वास'],
    questions: [
      { id: 'cough_duration', label: 'How long have you had the cough or breathing problem?', answerType: 'text', placeholder: 'For example: 3 days' },
      { id: 'cough_type', label: 'Is the cough dry, or are you bringing up mucus?', answerType: 'choice', options: ['Dry', 'Mucus / phlegm', 'Both', 'Not sure'] },
      { id: 'cough_fever', label: 'Do you have fever, chest discomfort or body aches?', answerType: 'text', placeholder: 'Tell us what applies, or write none' },
      { id: 'cough_severity', label: 'How difficult is breathing right now from 1 to 10?', answerType: 'scale' },
      { id: 'cough_trigger', label: 'Does anything trigger or relieve it, such as activity, lying down, dust, or medicine?', answerType: 'text', placeholder: 'Tell us what you notice' }
    ]
  },
  {
    key: 'stomach', label: 'Stomach or abdominal pain', shortLabel: 'Stomach pain', icon: '◒', description: 'Pain, cramps or discomfort in the abdomen.', keywords: ['stomach', 'abdomen', 'belly', 'gastric', 'पेट', 'पोट', 'abdominal'],
    questions: [
      { id: 'stomach_onset', label: 'When did the stomach pain begin?', answerType: 'text', placeholder: 'For example: after lunch today, two days ago' },
      { id: 'stomach_location', label: 'Where exactly is the pain?', answerType: 'text', placeholder: 'Upper/lower, left/right, around the navel, or all over' },
      { id: 'stomach_severity', label: 'How severe is the pain from 1 to 10?', answerType: 'scale' },
      { id: 'stomach_pattern', label: 'Is it constant, cramping, burning, or does it come and go?', answerType: 'choice', options: ['Constant', 'Comes and goes', 'Cramping', 'Burning', 'Not sure'] },
      { id: 'stomach_meals', label: 'Does eating make it better or worse?', answerType: 'text', placeholder: 'For example: worse after oily food, no change' },
      { id: 'stomach_vomit', label: 'Do you have vomiting, diarrhoea, constipation or fever?', answerType: 'text', placeholder: 'Tell us what applies, or write none' },
      { id: 'stomach_blood', label: 'Have you noticed blood in vomit or stool, faintness, or rapidly worsening pain?', answerType: 'text', placeholder: 'Tell us what applies, or write none' },
      { id: 'stomach_pregnancy', label: 'Could pregnancy be possible right now?', answerType: 'yesno', shouldAsk: stomachPregnancy }
    ]
  },
  {
    key: 'chest', label: 'Chest pain', shortLabel: 'Chest pain', icon: '♡', description: 'Pain, pressure or tightness in the chest.', keywords: ['chest', 'pressure', 'tightness', 'छाती', 'छातीत'],
    questions: [
      { id: 'chest_current', label: 'Are you having the chest pain or pressure right now?', answerType: 'yesno' },
      { id: 'chest_onset', label: 'When did it start, and how did it begin?', answerType: 'text', placeholder: 'For example: suddenly while walking, 30 minutes ago' },
      { id: 'chest_character', label: 'How would you describe it?', answerType: 'choice', options: ['Pressure / heaviness', 'Sharp', 'Burning', 'Tightness', 'Not sure'] },
      { id: 'chest_spread', label: 'Does it spread to your arm, jaw, back or shoulder?', answerType: 'text', placeholder: 'Tell us what applies, or write no' },
      { id: 'chest_other', label: 'Do you have breathlessness, sweating, nausea, faintness or severe weakness?', answerType: 'text', placeholder: 'Tell us what applies, or write none' }
    ]
  },
  {
    key: 'vomiting', label: 'Vomiting or diarrhoea', shortLabel: 'Vomiting / diarrhoea', icon: '↘', description: 'Vomiting, loose stools or stomach upset.', keywords: ['vomit', 'vomiting', 'diarrhoea', 'diarrhea', 'loose motion', 'उल्टी', 'दस्त', 'जुलाब'],
    questions: [
      { id: 'vomit_duration', label: 'How long has this been happening?', answerType: 'text', placeholder: 'For example: since last night' },
      { id: 'vomit_frequency', label: 'How many times have you vomited or had loose stools?', answerType: 'text', placeholder: 'Approximate number is okay' },
      { id: 'vomit_fluids', label: 'Can you keep fluids down?', answerType: 'yesno' },
      { id: 'vomit_blood', label: 'Is there blood, black stool, severe belly pain or high fever?', answerType: 'text', placeholder: 'Tell us what applies, or write none' },
      { id: 'vomit_dehydration', label: 'Do you feel dizzy, very thirsty, unusually sleepy, or are you urinating much less?', answerType: 'text', placeholder: 'Tell us what applies, or write none' }
    ]
  },
  {
    key: 'rash', label: 'Skin rash or itching', shortLabel: 'Rash / itching', icon: '✦', description: 'A new rash, itching, swelling or skin change.', keywords: ['rash', 'itch', 'hives', 'skin', 'खुजली', 'चकत्ते', 'पुरळ'],
    questions: [
      { id: 'rash_location', label: 'Where is the rash, and how large an area does it cover?', answerType: 'text', placeholder: 'For example: both arms, small patch on neck' },
      { id: 'rash_onset', label: 'When did it begin, and is it spreading?', answerType: 'text', placeholder: 'Tell us what you notice' },
      { id: 'rash_feel', label: 'Is it itchy, painful, blistering, or warm?', answerType: 'text', placeholder: 'Tell us what applies' },
      { id: 'rash_exposure', label: 'Any new medicine, food, soap, cream, plant or insect exposure?', answerType: 'text', placeholder: 'Tell us what applies, or write none' },
      { id: 'rash_allergy', label: 'Do you have facial/tongue swelling or any breathing difficulty?', answerType: 'text', placeholder: 'Tell us what applies, or write none' }
    ]
  },
  {
    key: 'dizziness', label: 'Dizziness', shortLabel: 'Dizziness', icon: '◎', description: 'Spinning, light-headedness or feeling faint.', keywords: ['dizzy', 'dizziness', 'vertigo', 'lightheaded', 'चक्कर', 'गरगरणे'],
    questions: [
      { id: 'dizzy_type', label: 'Does it feel like the room is spinning, or like you may faint?', answerType: 'choice', options: ['Room spinning', 'May faint', 'Both', 'Not sure'] },
      { id: 'dizzy_onset', label: 'When did it start, and is it constant or in episodes?', answerType: 'text', placeholder: 'Tell us what you notice' },
      { id: 'dizzy_trigger', label: 'Is it triggered by standing, turning your head, eating, or activity?', answerType: 'text', placeholder: 'Tell us what applies' },
      { id: 'dizzy_other', label: 'Any vomiting, hearing changes, severe headache, weakness, numbness or trouble speaking?', answerType: 'text', placeholder: 'Tell us what applies, or write none' }
    ]
  },
  {
    key: 'joint', label: 'Joint or muscle pain', shortLabel: 'Joint / muscle pain', icon: '⌁', description: 'Pain, swelling or reduced movement.', keywords: ['joint', 'muscle', 'knee', 'back pain', 'shoulder', 'घुटना', 'संधी', 'स्नायू'],
    questions: [
      { id: 'joint_location', label: 'Which joint or muscle area is affected?', answerType: 'text', placeholder: 'For example: right knee, lower back' },
      { id: 'joint_onset', label: 'When did it begin, and was there an injury?', answerType: 'text', placeholder: 'Tell us what happened' },
      { id: 'joint_severity', label: 'How severe is it from 1 to 10?', answerType: 'scale' },
      { id: 'joint_signs', label: 'Is there swelling, redness, warmth, stiffness, or difficulty moving?', answerType: 'text', placeholder: 'Tell us what applies' },
      { id: 'joint_fever', label: 'Do you also have fever or feel unusually unwell?', answerType: 'yesno' }
    ]
  },
  {
    key: 'urinary', label: 'Urinary problems', shortLabel: 'Urinary symptoms', icon: '⌇', description: 'Burning, urgency, frequency or difficulty passing urine.', keywords: ['urine', 'urinary', 'pee', 'burning urine', 'पेशाब', 'लघवी', 'मूत्र'],
    questions: [
      { id: 'urinary_burning', label: 'Is there burning or pain when you pass urine?', answerType: 'yesno' },
      { id: 'urinary_frequency', label: 'Are you going more often or feeling an urgent need to go?', answerType: 'text', placeholder: 'Tell us what applies' },
      { id: 'urinary_blood', label: 'Have you seen blood in the urine?', answerType: 'yesno' },
      { id: 'urinary_fever', label: 'Do you have fever, side/back pain, vomiting or chills?', answerType: 'text', placeholder: 'Tell us what applies, or write none' },
      { id: 'urinary_difficulty', label: 'Are you unable or struggling to pass urine?', answerType: 'yesno' },
      { id: 'urinary_pregnancy', label: 'Could pregnancy be possible right now?', answerType: 'yesno', shouldAsk: stomachPregnancy }
    ]
  },
  {
    key: 'fatigue', label: 'Fatigue or weakness', shortLabel: 'Fatigue / weakness', icon: '∿', description: 'Low energy, tiredness or a sense of weakness.', keywords: ['fatigue', 'weakness', 'tired', 'energy', 'थकान', 'अशक्तपणा', 'कमजोरी'],
    questions: [
      { id: 'fatigue_duration', label: 'How long have you felt tired or weak?', answerType: 'text', placeholder: 'For example: two weeks' },
      { id: 'fatigue_sleep', label: 'How have sleep, appetite and daily routine been?', answerType: 'text', placeholder: 'Tell us what has changed' },
      { id: 'fatigue_onset', label: 'Did it start suddenly or gradually?', answerType: 'choice', options: ['Suddenly', 'Gradually', 'Not sure'] },
      { id: 'fatigue_impact', label: 'How much does it affect your normal activities from 1 to 10?', answerType: 'scale' },
      { id: 'fatigue_other', label: 'Do you have dizziness, breathlessness, weight change, fever, or weakness on one side only?', answerType: 'text', placeholder: 'Tell us what applies, or write none' }
    ]
  },
  {
    key: 'bloodSugar', label: 'Blood sugar / diabetes concern', shortLabel: 'Blood sugar', icon: '◉', description: 'Questions about a known diabetes condition or a blood sugar concern.', keywords: ['diabetes', 'blood sugar', 'glucose', 'insulin', 'मधुमेह', 'शुगर'],
    questions: [
      { id: 'sugar_duration', label: 'What blood sugar or diabetes concern would you like to discuss, and when did it begin?', answerType: 'text', placeholder: 'Describe what changed and when' },
      { id: 'sugar_reading', label: 'Have you measured blood sugar recently? If so, share the number, unit, and time; “not measured” is okay.', answerType: 'text' },
      { id: 'sugar_symptoms', label: 'Have you noticed unusual thirst, frequent urination, blurred vision, or unexpected weight change?', answerType: 'text' },
      { id: 'sugar_medicines', label: 'What diabetes medicines or insulin do you use, and were any doses missed or changed?', answerType: 'text' },
      { id: 'sugar_wellbeing', label: 'Are you unusually drowsy or confused, repeatedly vomiting, or having deep or difficult breathing?', answerType: 'yesno' }
    ]
  },
  {
    key: 'bloodPressure', label: 'Blood pressure concern', shortLabel: 'Blood pressure', icon: '⌁', description: 'A known blood pressure condition or a recent reading you want to discuss.', keywords: ['blood pressure', 'hypertension', 'bp reading', 'उच्च रक्तचाप', 'ब्लड प्रेशर', 'रक्तदाब'],
    questions: [
      { id: 'pressure_reading', label: 'Have you checked your blood pressure? Share the reading, unit, and when it was taken, or say “not measured”.', answerType: 'text' },
      { id: 'pressure_duration', label: 'When did this concern begin, and has it changed since then?', answerType: 'text' },
      { id: 'pressure_symptoms', label: 'Have you noticed headache, vision changes, dizziness, or unusual weakness?', answerType: 'text' },
      { id: 'pressure_medicines', label: 'Do you take blood pressure medicine, and have any doses or medicines recently changed?', answerType: 'text' },
      { id: 'pressure_urgent', label: 'Are you having chest pain, severe breathing difficulty, fainting, or sudden weakness or trouble speaking now?', answerType: 'yesno' }
    ]
  },
  {
    key: 'eye', label: 'Eye or vision concern', shortLabel: 'Eye / vision', icon: '◉', description: 'Eye discomfort, redness, injury, or a change in vision.', keywords: ['eye', 'eyesight', 'vision', 'blurred vision', 'आंख', 'डोळा', 'दृष्टी'],
    questions: [
      { id: 'eye_side', label: 'Which eye is affected, and what change or discomfort have you noticed?', answerType: 'text' },
      { id: 'eye_onset', label: 'When did it begin, and is it getting better, worse, or staying the same?', answerType: 'text' },
      { id: 'eye_vision', label: 'Has your vision suddenly become blurry, dim, or missing in part or all of your view?', answerType: 'yesno' },
      { id: 'eye_signs', label: 'Is there pain, redness, discharge, light sensitivity, or swelling?', answerType: 'text' },
      { id: 'eye_exposure', label: 'Was there an injury, chemical splash, new eye medicine, or contact-lens use?', answerType: 'text' }
    ]
  },
  {
    key: 'earNoseThroat', label: 'Ear, nose, or throat concern', shortLabel: 'Ear / nose / throat', icon: '◖', description: 'Ear discomfort, nasal symptoms, or throat concerns.', keywords: ['ear pain', 'sore throat', 'nose', 'hearing', 'कान', 'नाक', 'गला', 'घसा'],
    questions: [
      { id: 'ent_area', label: 'Is the concern mainly in your ear, nose, or throat? Describe what you feel.', answerType: 'text' },
      { id: 'ent_onset', label: 'When did it begin, and is it changing or spreading?', answerType: 'text' },
      { id: 'ent_symptoms', label: 'Have you noticed fever, discharge, reduced hearing, blocked nose, or a hoarse voice?', answerType: 'text' },
      { id: 'ent_swallow', label: 'Are you having trouble swallowing fluids or breathing comfortably right now?', answerType: 'yesno' },
      { id: 'ent_exposure', label: 'Any recent contact with someone unwell, smoke or dust exposure, or new medicine?', answerType: 'text' }
    ]
  },
  {
    key: 'dental', label: 'Dental or mouth concern', shortLabel: 'Dental / mouth', icon: '⌂', description: 'Tooth, gum, jaw, or mouth pain and swelling.', keywords: ['tooth', 'teeth', 'dental', 'gum', 'mouth sore', 'दांत', 'दाँत', 'दात', 'हिरडी'],
    questions: [
      { id: 'dental_location', label: 'Where in your tooth, gum, jaw, or mouth is the problem?', answerType: 'text' },
      { id: 'dental_onset', label: 'When did it begin, and is it constant or does it come and go?', answerType: 'text' },
      { id: 'dental_severity', label: 'How severe is the discomfort from 1 to 10?', answerType: 'scale' },
      { id: 'dental_swelling', label: 'Is there swelling, bleeding, a bad taste, or fever?', answerType: 'text' },
      { id: 'dental_urgent', label: 'Is swelling affecting your face or neck, or making it hard to swallow or breathe?', answerType: 'yesno' }
    ]
  },
  {
    key: 'allergy', label: 'Possible allergy reaction', shortLabel: 'Allergy reaction', icon: '✳', description: 'A possible reaction after a medicine, food, bite, or other exposure.', keywords: ['allergy', 'allergic', 'reaction', 'hives', 'एलर्जी', 'अॅलर्जी'],
    questions: [
      { id: 'allergy_trigger', label: 'What might have triggered the reaction, and when were you exposed?', answerType: 'text' },
      { id: 'allergy_signs', label: 'What have you noticed, such as itching, hives, rash, swelling, or stomach symptoms?', answerType: 'text' },
      { id: 'allergy_progress', label: 'When did the symptoms start, and are they spreading or worsening?', answerType: 'text' },
      { id: 'allergy_medicine', label: 'Did you take any medicine for this reaction? If so, what and when?', answerType: 'text' },
      { id: 'allergy_urgent', label: 'Is there swelling of the lips, tongue, or throat, or any breathing difficulty now?', answerType: 'yesno' }
    ]
  },
  {
    key: 'menstrual', label: 'Menstrual or reproductive concern', shortLabel: 'Menstrual / reproductive', icon: '◌', description: 'A period, pelvic discomfort, or other reproductive-health concern.', keywords: ['period', 'menstrual', 'menstruation', 'pelvic', 'मासिक', 'पाळी', 'गर्भाशय'],
    questions: [
      { id: 'menstrual_concern', label: 'What change or concern would you like to discuss?', answerType: 'text' },
      { id: 'menstrual_onset', label: 'When did it begin? If relevant, when did your last period start?', answerType: 'text' },
      { id: 'menstrual_bleeding', label: 'Have you noticed unusual bleeding, discharge, cramps, or pelvic pain?', answerType: 'text' },
      { id: 'menstrual_pregnancy', label: 'Could pregnancy be possible right now?', answerType: 'yesno' },
      { id: 'menstrual_urgent', label: 'Are you faint, in severe or rapidly worsening pain, or bleeding heavily right now?', answerType: 'yesno' }
    ]
  },
  {
    key: 'injury', label: 'Injury or wound', shortLabel: 'Injury / wound', icon: '✚', description: 'A recent injury, cut, burn, or wound you want reviewed.', keywords: ['injury', 'injured', 'wound', 'cut', 'burn', 'fall', 'चोट', 'जखम', 'घाव'],
    questions: [
      { id: 'injury_event', label: 'What happened, and when did the injury occur?', answerType: 'text' },
      { id: 'injury_location', label: 'Which part of the body is affected, and is the skin broken?', answerType: 'text' },
      { id: 'injury_severity', label: 'How severe is the pain or discomfort from 1 to 10?', answerType: 'scale' },
      { id: 'injury_function', label: 'Can you move and use the affected area as usual?', answerType: 'yesno' },
      { id: 'injury_warning', label: 'Is there heavy bleeding, numbness, a head impact, loss of consciousness, or rapidly worsening swelling?', answerType: 'yesno' }
    ]
  }
]

export const findSymptom = (key: SymptomKey | '') => symptomModules.find((module) => module.key === key)

export function detectSymptom(text: string): SymptomKey | '' {
  const normalized = text.toLocaleLowerCase()
  const scored = symptomModules.map((module) => ({ key: module.key, score: module.keywords.reduce((score, keyword) => score + (normalized.includes(keyword.toLocaleLowerCase()) ? 1 : 0), 0) }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.score ? scored[0].key : ''
}

const emergencyPatterns: { label: string; terms: string[] }[] = [
  { label: 'severe breathing difficulty', terms: ['cannot breathe', "can't breathe", 'unable to breathe', 'gasping', 'severe breathlessness', 'सांस नहीं', 'श्वास घेता येत नाही'] },
  { label: 'new or concerning chest pain', terms: ['chest pain now', 'chest pressure', 'chest pain', 'छाती में दर्द', 'छातीत दुखत'] },
  { label: 'stroke warning sign', terms: ['one-sided weakness', 'face droop', 'difficulty speaking', 'slurred speech', 'अचानक कमजोरी', 'बोलने में दिक्कत'] },
  { label: 'loss of consciousness or seizure', terms: ['unconscious', 'passed out', 'loss of consciousness', 'seizure', 'बेहोश', 'झटका'] },
  { label: 'sudden extremely severe headache', terms: ['worst headache', 'thunderclap', 'sudden severe headache', 'सबसे तेज सिरदर्द'] },
  { label: 'severe allergic reaction', terms: ['tongue swelling', 'throat swelling', 'face swelling and breathing', 'गला सूज', 'जीभ सूज'] },
  { label: 'severe bleeding', terms: ['heavy bleeding', 'bleeding a lot', 'uncontrolled bleeding', 'बहुत ज्यादा खून'] },
  { label: 'suspected poisoning or overdose', terms: ['overdose', 'poisoning', 'swallowed poison', 'ज़हर', 'विष'] },
  { label: 'severe or rapidly worsening abdominal pain', terms: ['severe abdominal pain', 'worsening stomach pain', 'rapidly worsening pain', 'बहुत तेज पेट दर्द'] }
]

export function detectSafety(text: string, symptomKey: SymptomKey | ''): string[] {
  const normalized = text.toLocaleLowerCase()
  const labels = emergencyPatterns.filter((pattern) => pattern.terms.some((term) => normalized.includes(term))).map((pattern) => pattern.label)
  if (symptomKey === 'chest' && /current|now|right now|अभी|आत्ता/.test(normalized) && /yes|हो|हां|होय|pain|दर्द|दुखत/.test(normalized)) labels.push('new or concerning chest pain')
  if ((symptomKey === 'cough' || symptomKey === 'chest') && /10|9|8/.test(normalized) && /breath|breathing|सांस|श्वास/.test(normalized)) labels.push('severe breathing difficulty')
  return [...new Set(labels)]
}

export const safetyGuidance = (labels: string[]) => ({
  title: 'Please seek urgent medical help now',
  message: `A safety warning was triggered for ${labels.join(', ')}. This is not a diagnosis. Call 112 in India or go to the nearest emergency department. Do not wait to finish this intake.`,
  triggers: labels,
  createdAt: new Date().toISOString()
})
