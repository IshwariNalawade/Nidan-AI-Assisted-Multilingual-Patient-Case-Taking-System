import type { SymptomKey } from '../types'
export const symTr: Record<SymptomKey, [string, string]> = {
  headache: ['डोकेदुखी', 'सिरदर्द'], fever: ['ताप', 'बुखार'], cough: ['खोकला / श्वास', 'खांसी / सांस'], stomach: ['पोटदुखी', 'पेट दर्द'], chest: ['छातीत दुखणे', 'सीने में दर्द'],
  vomiting: ['उलट्या / जुलाब', 'उल्टी / दस्त'], rash: ['त्वचेवर पुरळ', 'त्वचा पर दाने'], dizziness: ['चक्कर', 'चक्कर आना'], joint: ['सांधे / स्नायू दुखणे', 'जोड़ / मांसपेशी दर्द'],
  urinary: ['लघवीची समस्या', 'पेशाब की समस्या'], fatigue: ['थकवा / अशक्तपणा', 'थकान / कमज़ोरी'],
  bloodSugar: ['रक्तातील साखर / मधुमेहाची चिंता', 'रक्त शर्करा / मधुमेह की चिंता'], bloodPressure: ['रक्तदाबाची चिंता', 'रक्तचाप की चिंता'], eye: ['डोळा / दृष्टीची समस्या', 'आंख / दृष्टि की समस्या'],
  earNoseThroat: ['कान, नाक किंवा घशाची समस्या', 'कान, नाक या गले की समस्या'], dental: ['दात किंवा तोंडाची समस्या', 'दांत या मुंह की समस्या'], allergy: ['संभाव्य अॅलर्जीची प्रतिक्रिया', 'संभावित एलर्जी प्रतिक्रिया'],
  menstrual: ['मासिक पाळी / प्रजनन आरोग्याची चिंता', 'मासिक धर्म / प्रजनन स्वास्थ्य की चिंता'], injury: ['दुखापत / जखम', 'चोट / घाव'],
}
// id, English, [mr, hi], spoken keywords, x,y on the figure (viewBox 0 0 200 300)
export const REGIONS: { id: string; en: string; tr: [string, string]; words: string[]; x: number; y: number }[] = [
  { id: 'head', en: 'Head', tr: ['डोके', 'सिर'], words: ['head', 'डोके', 'सिर', 'डोकं', 'माथा'], x: 100, y: 28 },
  { id: 'neck', en: 'Neck', tr: ['मान', 'गर्दन'], words: ['neck', 'मान', 'गर्दन'], x: 100, y: 66 },
  { id: 'chest', en: 'Chest', tr: ['छाती', 'छाती'], words: ['chest', 'छाती', 'सीना'], x: 100, y: 98 },
  { id: 'stomach', en: 'Stomach', tr: ['पोट', 'पेट'], words: ['stomach', 'belly', 'abdomen', 'पोट', 'पेट'], x: 100, y: 138 },
  { id: 'lowerBack', en: 'Lower back', tr: ['कंबर', 'कमर'], words: ['back', 'कंबर', 'कमर', 'पाठ', 'पीठ'], x: 100, y: 172 },
  { id: 'shoulderL', en: 'Left shoulder', tr: ['डावा खांदा', 'बायाँ कंधा'], words: ['left shoulder', 'डावा खांदा', 'बायाँ कंधा'], x: 66, y: 86 },
  { id: 'shoulderR', en: 'Right shoulder', tr: ['उजवा खांदा', 'दायाँ कंधा'], words: ['right shoulder', 'उजवा खांदा', 'दायाँ कंधा'], x: 134, y: 86 },
  { id: 'armL', en: 'Left arm', tr: ['डावा हात', 'बायाँ हाथ'], words: ['left arm', 'left hand', 'डावा हात', 'बायाँ हाथ'], x: 52, y: 140 },
  { id: 'armR', en: 'Right arm', tr: ['उजवा हात', 'दायाँ हाथ'], words: ['right arm', 'right hand', 'उजवा हात', 'दायाँ हाथ'], x: 148, y: 140 },
  { id: 'hipL', en: 'Left hip', tr: ['डावे कूल्हे', 'बायाँ कूल्हा'], words: ['left hip', 'डावे कूल्हे', 'बायाँ कूल्हा'], x: 82, y: 196 },
  { id: 'hipR', en: 'Right hip', tr: ['उजवे कूल्हे', 'दायाँ कूल्हा'], words: ['right hip', 'उजवे कूल्हे', 'दायाँ कूल्हा'], x: 118, y: 196 },
  { id: 'kneeL', en: 'Left knee', tr: ['डावा गुडघा', 'बायाँ घुटना'], words: ['left knee', 'डावा गुडघा', 'बायाँ घुटना'], x: 84, y: 242 },
  { id: 'kneeR', en: 'Right knee', tr: ['उजवा गुडघा', 'दायाँ घुटना'], words: ['right knee', 'उजवा गुडघा', 'दायाँ घुटना'], x: 116, y: 242 },
  { id: 'footL', en: 'Left foot', tr: ['डावा पाय', 'बायाँ पैर'], words: ['left foot', 'left leg', 'डावा पाय', 'बायाँ पैर'], x: 84, y: 282 },
  { id: 'footR', en: 'Right foot', tr: ['उजवा पाय', 'दायाँ पैर'], words: ['right foot', 'right leg', 'उजवा पाय', 'दायाँ पैर'], x: 116, y: 282 },
]
export const AYUSH_SYSTEMS: { id: string; en: string; tr: [string, string]; words: string[] }[] = [
  { id: 'Ayurveda', en: 'Ayurveda', tr: ['आयुर्वेद', 'आयुर्वेद'], words: ['ayurveda', 'ayurved', 'आयुर्वेद'] },
  { id: 'Yoga & Naturopathy', en: 'Yoga & Naturopathy', tr: ['योग व निसर्गोपचार', 'योग एवं प्राकृतिक चिकित्सा'], words: ['yoga', 'naturopathy', 'योग', 'निसर्गोपचार'] },
  { id: 'Unani', en: 'Unani', tr: ['युनानी', 'यूनानी'], words: ['unani', 'युनानी', 'यूनानी'] },
  { id: 'Siddha', en: 'Siddha', tr: ['सिद्ध', 'सिद्ध'], words: ['siddha', 'सिद्ध'] },
  { id: 'Homeopathy', en: 'Homeopathy', tr: ['होमिओपॅथी', 'होम्योपैथी'], words: ['homeopathy', 'homoeopathy', 'होमिओपॅथी', 'होम्योपैथी'] },
  { id: 'Sowa-Rigpa', en: 'Sowa-Rigpa', tr: ['सोवा-रिग्पा', 'सोवा-रिग्पा'], words: ['sowa', 'rigpa', 'सोवा'] },
]
export const AY_FIELDS: { k: string; label: string; opts: string[] }[] = [
  { k: 'prakriti', label: 'f_prakriti', opts: ['vata', 'pitta', 'kapha', 'unsure'] }, { k: 'vikriti', label: 'f_vikriti', opts: ['vata', 'pitta', 'kapha', 'unsure'] },
  { k: 'appetite', label: 'f_appetite', opts: ['good', 'irregular', 'poor'] }, { k: 'sleep', label: 'f_sleep', opts: ['sound', 'disturbed', 'little'] },
  { k: 'bowel', label: 'f_bowel', opts: ['regular', 'constipated', 'loose'] }, { k: 'stress', label: 'f_stress', opts: ['low', 'medium', 'high'] },
  { k: 'exercise', label: 'f_exercise', opts: ['low', 'medium', 'high'] }, { k: 'diet', label: 'f_diet', opts: ['veg', 'mixed', 'nonveg'] },
]
