import { languageByCode } from './data/languages'
import type { LanguageCode } from './types'
import locales from './locales.json'
const LOC = locales as Record<string, Record<string, string>>

// English is source copy. Hindi, Marathi and every additional locale use explicit review-status metadata.
// Order: [en, mr, hi]
const D: Record<string, [string, string, string]> = {
  brandSub: ['PATIENT FIRST INTAKE', 'PATIENT FIRST INTAKE', 'PATIENT FIRST INTAKE'],
  voiceTouch: ['Voice + touch', 'आवाज + टच', 'आवाज़ + टच'],
  fictionalOnly: ['Fictional data only', 'फक्त काल्पनिक डेटा', 'केवल काल्पनिक डेटा'],
  demoTitle: ['DEMO PROTOTYPE — FICTIONAL DATA ONLY', 'डेमो प्रोटोटाइप — फक्त काल्पनिक डेटा', 'डेमो प्रोटोटाइप — केवल काल्पनिक जानकारी'],
  demoWarning: ['Do not enter real patient, health, Aadhaar, ABHA, or report information. This site is not production-ready or clinically validated.', 'खरी रुग्ण, आरोग्य, आधार, ABHA किंवा अहवालाची माहिती टाकू नका. ही साइट उत्पादनासाठी तयार किंवा वैद्यकीयदृष्ट्या प्रमाणित नाही.', 'असली रोगी, स्वास्थ्य, आधार, ABHA या रिपोर्ट की जानकारी न डालें। यह साइट उत्पादन के लिए तैयार या चिकित्सकीय रूप से सत्यापित नहीं है।'],
  ocrFallback: ['The selected OCR language could not be downloaded. This text was recognized with the bundled English model; please review and correct it. This is not native-language recognition.', 'निवडलेली OCR भाषा डाउनलोड होऊ शकली नाही. हा मजकूर स्थानिक इंग्रजी मॉडेलने वाचला आहे; कृपया तपासून दुरुस्त करा. हे मूळ भाषेतील OCR नाही.', 'चुनी गई OCR भाषा डाउनलोड नहीं हो सकी। यह पाठ स्थानीय अंग्रेज़ी मॉडल से पहचाना गया है; कृपया जाँचकर सुधारें। यह मूल भाषा की पहचान नहीं है।'],
  help: ['Need help?', 'मदत हवी?', 'मदद चाहिए?'],
  demo: ['Hackathon demo', 'हॅकॅथॉन डेमो', 'हैकाथॉन डेमो'],
  reset: ['Start over', 'पुन्हा सुरू करा', 'फिर से शुरू करें'],
  flow: ['NIDAN / FLOW', 'NIDAN / FLOW', 'NIDAN / FLOW'],
  inProgress: ['In progress', 'सुरू आहे', 'जारी'],
  doneS: ['Done', 'पूर्ण', 'पूर्ण'],
  skippedS: ['Skipped', 'वगळले', 'छोड़ा गया'],
  stepOf: ['{a} of {b}', '{a} पैकी {b}', '{b} में से {a}'],
  back: ['Back', 'मागे', 'पीछे'],
  next: ['Next', 'पुढे जा', 'आगे बढ़ें'],
  backToStart: ['Back to start', 'सुरुवातीला', 'शुरुआत पर'],
  // steps (sidebar)
  s_welcome: ['Welcome', 'स्वागत', 'स्वागत'], s_language: ['Language', 'भाषा', 'भाषा'], s_patient: ['Patient', 'रुग्ण', 'रोगी'],
  s_register: ['Register patient', 'या रुग्णाची नोंदणी करा', 'रोगी का पंजीकरण'], s_consent: ['Consent', 'संमती', 'सहमति'],
  s_consultation: ['Type of consultation', 'तुम्ही कोणत्या प्रकारच्या तपासणीसाठी आला आहात?', 'परामर्श का प्रकार'],
  s_ayushSys: ['Choose AYUSH system', 'AYUSH प्रणाली निवडा', 'AYUSH प्रणाली चुनें'], s_concern: ['Main concern', 'मुख्य तक्रार', 'मुख्य शिकायत'],
  s_body: ['Where does it hurt?', 'कुठे दुखतंय?', 'कहाँ दर्द है?'], s_ayHist: ['Ayurvedic history', 'आयुर्वेदिक इतिहास', 'आयुर्वेदिक इतिहास'],
  s_questions: ['Questions', 'प्रश्न', 'प्रश्न'], s_reports: ['Reports', 'रिपोर्ट', 'रिपोर्ट'], s_safety: ['Safety check', 'सुरक्षा तपासणी', 'सुरक्षा जाँच'],
  s_summary: ['Summary', 'सारांश', 'सारांश'], s_review: ['Doctor review', 'डॉक्टर रिव्ह्यू', 'डॉक्टर समीक्षा'], s_done: ['Complete', 'पूर्ण', 'पूर्ण'],
  // welcome
  eyebrow: ['Safe first conversation', 'सुरक्षित पहिली बातचीत', 'सुरक्षित पहली बातचीत'],
  welcomeTitle: ['Why are you here today?', 'आज तुम्ही इथे कशासाठी आला आहात?', 'आज आप यहाँ किसलिए आए हैं?'],
  welcomeBody: ['NIDAN helps the care team prepare for your visit in your language. It does not diagnose and does not replace doctors.', 'NIDAN तुमच्या भाषेत काळजी घेणाऱ्या टीमला भेटीची तयारी करण्यास मदत करते. हे निदान करत नाही आणि डॉक्टरांची जागा घेत नाही.', 'NIDAN आपकी भाषा में देखभाल टीम को मुलाकात की तैयारी में मदद करता है। यह निदान नहीं करता और डॉक्टरों की जगह नहीं लेता।'],
  startIntake: ['Start patient intake', 'रुग्णाची माहिती सुरू करा', 'रोगी की जानकारी शुरू करें'],
  localDemo: ['Local kiosk demo · no real Aadhaar data', 'लोकल किओस्क डेमो · खरा आधार डेटा नाही', 'लोकल किओस्क डेमो · असली आधार डेटा नहीं'],
  t1: ['23 interface languages', '२३ भाषांमध्ये इंटरफेस', '२३ इंटरफ़ेस भाषाएँ'], t1d: ['English plus 22 Indian languages are available. Non-English UI and clinical translations are drafts and need review.', 'इंग्रजीसह २२ भारतीय भाषा उपलब्ध आहेत. इंग्रजीव्यतिरिक्त UI व वैद्यकीय भाषांतरे मसुदे आहेत आणि त्यांची तपासणी आवश्यक आहे.', 'अंग्रेज़ी सहित २२ भारतीय भाषाएँ उपलब्ध हैं। अंग्रेज़ी के अलावा UI और क्लिनिकल अनुवाद प्रारूप हैं और उनकी समीक्षा ज़रूरी है।'],
  t2: ['Voice + touch', 'आवाज + टच', 'आवाज़ + टच'], t2d: ['Every question can be heard and answered by speaking or tapping.', 'प्रत्येक प्रश्न ऐकता येतो आणि बोलून किंवा टॅप करून उत्तर देता येते.', 'हर प्रश्न सुना जा सकता है और बोलकर या टैप करके उत्तर दिया जा सकता है।'],
  t3: ['Safety first', 'सुरक्षा प्रथम', 'सुरक्षा पहले'], t3d: ['Urgent warning signs are shown at once and sent to staff.', 'तातडीची धोक्याची लक्षणे लगेच दाखवली जातात आणि स्टाफला कळवली जातात.', 'आपातकालीन चेतावनी संकेत तुरंत दिखाए जाते और स्टाफ को बताए जाते हैं।'],
  // language
  langTitle: ['Choose your language', 'भाषा निवडा', 'भाषा चुनें'], langDesc: ['Your language stays selected for the whole intake. You can say the language name or tap a card.', 'तुमची भाषा संपूर्ण नोंदणीत कायम राहील. भाषेचे नाव सांगा किंवा कार्डवर टॅप करा.', 'आपकी भाषा पूरे इंटेक में बनी रहेगी। भाषा का नाम बोलें या कार्ड पर टैप करें।'],
  tr_reviewed: ['UI translated', 'UI भाषांतरित', 'UI अनुदित'], tr_other: ['UI in English · type & speak in your language', 'UI इंग्रजीत · तुमच्या भाषेत लिहा व बोला', 'UI अंग्रेज़ी में · अपनी भाषा में लिखें/बोलें'],
  langFallback: ['A translation is missing for some text and English is shown instead. Draft translations need native-speaker review.', 'काही मजकुराचे भाषांतर नसल्याने तो इंग्रजीत दाखवला आहे. मसुदा भाषांतर मूळ भाषकाने तपासणे आवश्यक आहे.', 'कुछ पाठ का अनुवाद उपलब्ध नहीं है, इसलिए उसे अंग्रेज़ी में दिखाया गया है। प्रारूप अनुवाद की मूल भाषी से समीक्षा ज़रूरी है।'],
  // patient
  patientTitle: ['Patient details', 'रुग्णाची माहिती', 'रोगी की जानकारी'], patientDesc: ['Start a new case with a demo patient ID.', 'डेमो रुग्ण ID सह नवीन केस सुरू करा.', 'डेमो रोगी ID के साथ नया केस शुरू करें।'],
  newP: ['New patient', 'नवीन रुग्ण', 'नया रोगी'], newPd: ['Start a new case with a demo patient ID.', 'डेमो रुग्ण ID सह नवीन केस सुरू करा.', 'डेमो रोगी ID के साथ नया केस शुरू करें।'],
  retP: ['Returning patient', 'परत येणारा रुग्ण', 'वापस आने वाला रोगी'], retPd: ['Use a demo patient ID or scan a QR.', 'डेमो रुग्ण ID वापरा किंवा QR स्कॅन करा.', 'डेमो रोगी ID का उपयोग करें या QR स्कैन करें।'],
  fullName: ['Full name', 'पूर्ण नाव', 'पूरा नाम'], age: ['Age', 'वय', 'उम्र'], sex: ['Sex', 'लिंग', 'लिंग'], phone: ['Phone (optional)', 'फोन (पर्यायी)', 'फ़ोन (वैकल्पिक)'],
  male: ['Male', 'पुरुष', 'पुरुष'], female: ['Female', 'महिला', 'महिला'], pns: ['Prefer not to say', 'सांगू इच्छित नाही', 'बताना नहीं चाहते'],
  demoId: ['Demo patient ID', 'डेमो रुग्ण ID', 'डेमो रोगी ID'], demoIdReady: ['Demo ID ready', 'डेमो ID तयार', 'डेमो ID तैयार'],
  v_name: ['Please say your full name.', 'कृपया तुमचे पूर्ण नाव सांगा.', 'कृपया अपना पूरा नाम बताइए।'],
  v_age: ['Please say your age.', 'कृपया तुमचे वय सांगा.', 'कृपया अपनी उम्र बताइए।'],
  v_sex: ['Please say male, female, or prefer not to say.', 'कृपया पुरुष, महिला किंवा सांगू इच्छित नाही असे सांगा.', 'कृपया पुरुष, महिला या बताना नहीं चाहते बोलिए।'],
  v_phone: ['Please say your phone number, or skip it.', 'कृपया तुमचा फोन नंबर सांगा किंवा वगळा.', 'कृपया अपना फ़ोन नंबर बताइए या छोड़ दीजिए।'],
  v_ptype: ['Please say new patient or returning patient.', 'कृपया नवीन रुग्ण किंवा परत येणारा रुग्ण असे सांगा.', 'कृपया नया रोगी या वापस आने वाला रोगी बोलिए।'],
  errName: ['Please enter the full name.', 'कृपया पूर्ण नाव लिहा.', 'कृपया पूरा नाम लिखें।'], errAge: ['Enter an age between 0 and 120.', '0 ते 120 मधील वय लिहा.', '0 से 120 के बीच उम्र लिखें।'], errPhone: ['Phone must have 10 digits, or leave it empty.', 'फोन 10 अंकी असावा किंवा रिकामा ठेवा.', 'फ़ोन 10 अंकों का हो या खाली छोड़ें।'],
  confirmFirst: ['Please confirm or correct the spoken answer first.', 'कृपया आधी बोललेले उत्तर तपासा किंवा दुरुस्त करा.', 'कृपया पहले बोले गए उत्तर की पुष्टि या सुधार करें।'],
  // register
  regTitle: ['Register this patient', 'या रुग्णाची नोंदणी करा', 'इस रोगी का पंजीकरण करें'], regDesc: ['Use the fictional demo ABHA ID and patient name for this kiosk visit.', 'या किओस्क भेटीसाठी काल्पनिक डेमो ABHA ID आणि रुग्णाचे नाव वापरा.', 'इस किओस्क विज़िट के लिए काल्पनिक डेमो ABHA ID और रोगी का नाम उपयोग करें।'],
  demoAbha: ['Demo ABHA', 'डेमो ABHA', 'डेमो ABHA'], demoQr: ['Demo QR scan', 'डेमो QR स्कॅन करा', 'डेमो QR स्कैन करें'], demoOnly: ['Demo only — do not enter real Aadhaar or ABHA data.', 'फक्त डेमो – खरा आधार किंवा ABHA डेटा टाकू नका.', 'केवल डेमो — असली आधार या ABHA डेटा न डालें।'],
  regOptional: ['Registration is optional in this prototype', 'या प्रोटोटाइपसाठी नोंदणी पर्यायी आहे', 'इस प्रोटोटाइप के लिए पंजीकरण वैकल्पिक है'], regPreview: ['REGISTRATION PREVIEW', 'REGISTRATION PREVIEW', 'REGISTRATION PREVIEW'],
  fictionalId: ['Fictional demo identity', 'काल्पनिक डेमो ओळख', 'काल्पनिक डेमो पहचान'], fictionalIdD: ['This prototype never requests real Aadhaar or ABHA information.', 'हे प्रोटोटाइप कधीही खरी आधार किंवा ABHA माहिती मागत नाही.', 'यह प्रोटोटाइप कभी असली आधार या ABHA जानकारी नहीं माँगता।'],
  saveReg: ['Save registration', 'नोंदणी सेव्ह करा', 'पंजीकरण सहेजें'],
  // consent
  consentTitle: ['Consent and privacy', 'संमती आणि गोपनीयता', 'सहमति और गोपनीयता'], consentDesc: ['Please read and agree before we continue.', 'पुढे जाण्यापूर्वी कृपया वाचा आणि संमती द्या.', 'आगे बढ़ने से पहले कृपया पढ़ें और सहमति दें।'],
  c1: ['NIDAN prepares a history for the care team. It does not diagnose and does not replace a doctor.', 'NIDAN काळजी टीमसाठी इतिहास तयार करते. हे निदान करत नाही आणि डॉक्टरांची जागा घेत नाही.', 'NIDAN देखभाल टीम के लिए इतिहास तैयार करता है। यह निदान नहीं करता और डॉक्टर की जगह नहीं लेता।'],
  c2: ['Your answers stay on this device in this prototype, and you can edit them before continuing.', 'या प्रोटोटाइपमध्ये तुमची उत्तरे याच उपकरणावर राहतात आणि पुढे जाण्यापूर्वी तुम्ही ती बदलू शकता.', 'इस प्रोटोटाइप में आपके उत्तर इसी डिवाइस पर रहते हैं और आगे बढ़ने से पहले आप उन्हें बदल सकते हैं।'],
  c3: ['Voice recognition may be handled by your browser vendor. You can always type instead.', 'आवाज ओळख तुमच्या ब्राउझर कंपनीकडून हाताळली जाऊ शकते. तुम्ही नेहमी टाइप करू शकता.', 'आवाज़ पहचान आपके ब्राउज़र प्रदाता द्वारा संभाली जा सकती है। आप हमेशा टाइप कर सकते हैं।'],
  c4: ['You may stop at any time and ask staff for help. In an emergency call 112.', 'तुम्ही कधीही थांबू शकता आणि स्टाफची मदत मागू शकता. आणीबाणीत 112 वर कॉल करा.', 'आप कभी भी रुक सकते हैं और स्टाफ से मदद माँग सकते हैं। आपातकाल में 112 पर कॉल करें।'],
  agree: ['I understand and agree to continue.', 'मला समजले आहे आणि मी पुढे जाण्यास संमती देतो/देते.', 'मैं समझता/समझती हूँ और आगे बढ़ने के लिए सहमत हूँ।'],
  // consultation
  consTitle: ['What type of consultation?', 'तुम्ही कोणत्या प्रकारच्या तपासणीसाठी आला आहात?', 'आप किस प्रकार की जाँच के लिए आए हैं?'], consDesc: ['Choose one path. AYUSH takes a separate clinical history.', 'एक मार्ग निवडा. AYUSH साठी स्वतंत्र क्लिनिकल इतिहास घेतला जाईल.', 'एक मार्ग चुनें। AYUSH के लिए अलग क्लिनिकल इतिहास लिया जाएगा।'],
  general: ['General medical consultation', 'सामान्य वैद्यकीय तपासणी', 'सामान्य चिकित्सा जाँच'], generalD: ['Standard Clinical Intake', 'Standard Clinical Intake', 'Standard Clinical Intake'],
  ayushC: ['AYUSH consultation', 'AYUSH तपासणी', 'AYUSH जाँच'], ayushD: ['Dedicated AYUSH Clinical Intake', 'Dedicated AYUSH Clinical Intake', 'Dedicated AYUSH Clinical Intake'],
  consNote: ['General Medicine and AYUSH remain separate clinical histories in this prototype.', 'General Medicine आणि AYUSH या प्रोटोटाइपमध्ये स्वतंत्र क्लिनिकल इतिहास राहतात.', 'General Medicine और AYUSH इस प्रोटोटाइप में अलग क्लिनिकल इतिहास रहते हैं।'],
  v_cons: ['Please say general or AYUSH.', 'कृपया सामान्य किंवा आयुष असे सांगा.', 'कृपया सामान्य या आयुष बोलिए।'],
  ayushSysTitle: ['Choose AYUSH system', 'AYUSH प्रणाली निवडा', 'AYUSH प्रणाली चुनें'], ayushSysDesc: ['Select the system your practitioner will use.', 'तुमचे वैद्य कोणती प्रणाली वापरतील ते निवडा.', 'आपके चिकित्सक कौन-सी प्रणाली उपयोग करेंगे, चुनें।'],
  skipAyush: ['Skipped — general consultation selected.', 'वगळले – सामान्य तपासणी निवडली आहे.', 'छोड़ा गया — सामान्य जाँच चुनी गई है।'],
  // concern
  concernTitle: ['Main concern', 'मुख्य तक्रार', 'मुख्य शिकायत'], concernDesc: ['Tell us what brings you in, then confirm the matching card.', 'तुम्ही कशासाठी आला आहात ते सांगा, नंतर योग्य कार्ड निवडा.', 'बताइए आप किसलिए आए हैं, फिर सही कार्ड चुनें।'],
  v_concern: ['Please tell us what problem brings you here today.', 'कृपया आज तुम्ही कोणत्या त्रासासाठी आला आहात ते सांगा.', 'कृपया बताइए आज आप किस तकलीफ़ के लिए आए हैं।'],
  concernLabel: ['Describe your problem', 'तुमची तक्रार सांगा', 'अपनी तकलीफ़ बताएँ'], matched: ['This looks like:', 'हे असे दिसते:', 'यह ऐसा दिखता है:'], pickCard: ['Choose the closest card', 'सर्वात जवळचे कार्ड निवडा', 'सबसे नज़दीकी कार्ड चुनें'],
  // body
  bodyTitle: ['Where does it hurt?', 'कुठे दुखतंय?', 'कहाँ दर्द है?'], bodyDesc: ['Tap a body area or choose Not sure. Related questions follow.', 'शरीराच्या भागावर टॅप करा किंवा माहिती नाही निवडा. त्यानंतर संबंधित प्रश्न येतील.', 'शरीर के हिस्से पर टैप करें या पता नहीं चुनें। इसके बाद संबंधित प्रश्न आएँगे।'],
  bodyFront: ['BODY FRONT VIEW', 'शरीराचा पुढचा भाग', 'शरीर का अगला भाग'], tapHurt: ['Tap if this is where it hurts', 'येथे दुखत असल्यास टॅप करा', 'यहाँ दर्द हो तो टैप करें'], notSure: ['Not sure', 'माहिती नाही', 'पता नहीं'],
  v_body: ['Please say where it hurts, for example head, chest or stomach.', 'कृपया कुठे दुखते ते सांगा, उदाहरणार्थ डोके, छाती किंवा पोट.', 'कृपया बताइए कहाँ दर्द है, जैसे सिर, छाती या पेट।'],
  // ayurveda
  ayHistTitle: ['Ayurvedic history', 'आयुर्वेदिक इतिहास', 'आयुर्वेदिक इतिहास'], ayHistDesc: ['Patient-reported answers; a practitioner will confirm them.', 'हे रुग्णाने सांगितलेले आहे; वैद्य त्याची खात्री करतील.', 'ये रोगी द्वारा बताए गए उत्तर हैं; चिकित्सक पुष्टि करेंगे।'],
  skipAyHist: ['Skipped — only for AYUSH consultation.', 'वगळले – फक्त AYUSH तपासणीसाठी.', 'छोड़ा गया — केवल AYUSH जाँच के लिए।'],
  f_prakriti: ['Body constitution (Prakriti)', 'शरीर प्रकृती (प्रकृती)', 'शरीर प्रकृति'], f_vikriti: ['Current imbalance (Vikriti)', 'सध्याचा असमतोल (विकृती)', 'वर्तमान असंतुलन (विकृति)'], f_appetite: ['Appetite / digestion (Ahara shakti)', 'भूक / पचन (आहार शक्ती)', 'भूख / पाचन (आहार शक्ति)'],
  f_sleep: ['Sleep', 'झोप', 'नींद'], f_bowel: ['Bowel habit', 'शौचाची सवय', 'मल त्याग की आदत'], f_stress: ['Mental stress (Satva)', 'मानसिक ताण (सत्त्व)', 'मानसिक तनाव (सत्त्व)'], f_exercise: ['Exercise capacity (Vyayama shakti)', 'व्यायाम क्षमता (व्यायाम शक्ती)', 'व्यायाम क्षमता (व्यायाम शक्ति)'], f_diet: ['Diet habit (Satmya)', 'आहाराची सवय (सात्म्य)', 'आहार की आदत (सात्म्य)'],
  o_vata: ['Vata', 'वात', 'वात'], o_pitta: ['Pitta', 'पित्त', 'पित्त'], o_kapha: ['Kapha', 'कफ', 'कफ'], o_unsure: ['Not sure', 'माहिती नाही', 'पता नहीं'], o_good: ['Good', 'चांगली', 'अच्छी'], o_irregular: ['Irregular', 'अनियमित', 'अनियमित'], o_poor: ['Poor', 'कमी', 'कम'],
  o_sound: ['Sound', 'शांत', 'गहरी'], o_disturbed: ['Disturbed', 'विस्कळीत', 'बाधित'], o_little: ['Very little', 'खूप कमी', 'बहुत कम'], o_regular: ['Regular', 'नियमित', 'नियमित'], o_constipated: ['Constipated', 'बद्धकोष्ठ', 'कब्ज़'], o_loose: ['Loose', 'पातळ', 'पतला'],
  o_low: ['Low', 'कमी', 'कम'], o_medium: ['Medium', 'मध्यम', 'मध्यम'], o_high: ['High', 'जास्त', 'अधिक'], o_veg: ['Vegetarian', 'शाकाहारी', 'शाकाहारी'], o_mixed: ['Mixed', 'मिश्र', 'मिश्रित'], o_nonveg: ['Non-vegetarian', 'मांसाहारी', 'मांसाहारी'],
  v_ayHist: ['Please say your answer, or tap an option.', 'कृपया उत्तर सांगा किंवा पर्यायावर टॅप करा.', 'कृपया उत्तर बोलें या विकल्प पर टैप करें।'],
  // questions
  qTitle: ['A few more questions', 'काही पुढील प्रश्न', 'कुछ और प्रश्न'], qDesc: ['These questions change with your main concern. Tap an answer or speak.', 'हे प्रश्न तुमच्या मुख्य तक्रारीनुसार बदलतात. उत्तरावर टॅप करा किंवा बोला.', 'ये प्रश्न आपकी मुख्य शिकायत के अनुसार बदलते हैं। उत्तर पर टैप करें या बोलें।'],
  qN: ['QUESTION {a} OF {b}', 'प्रश्न {a} / {b}', 'प्रश्न {a} / {b}'], yes: ['Yes', 'होय', 'हाँ'], no: ['No', 'नाही', 'नहीं'], skipQ: ['Skip this question', 'हा प्रश्न वगळा', 'यह प्रश्न छोड़ें'],
  ph: ['Type your answer or use the microphone', 'उत्तर लिहा किंवा मायक्रोफोन वापरा', 'उत्तर लिखें या माइक्रोफ़ोन का उपयोग करें'], stays: ['Your answer stays on this kiosk and can be edited before continuing.', 'तुमचे उत्तर या किओस्कवरच राहते आणि पुढे जाण्यापूर्वी बदलता येते.', 'आपका उत्तर इसी किओस्क पर रहता है और आगे बढ़ने से पहले बदला जा सकता है।'],
  speakNat: ['Speak naturally. You can change the words before continuing.', 'नैसर्गिकपणे बोला. पुढे जाण्यापूर्वी शब्द बदलू शकता.', 'स्वाभाविक रूप से बोलें। आगे बढ़ने से पहले शब्द बदल सकते हैं।'],
  hAllergy: ['Do you have any allergies (medicine, food, dust)?', 'तुम्हाला कोणत्याही गोष्टीची ॲलर्जी आहे का (औषध, अन्न, धूळ)?', 'क्या आपको किसी चीज़ से एलर्जी है (दवा, भोजन, धूल)?'],
  hMeds: ['Which medicines do you take now?', 'सध्या तुम्ही कोणती औषधे घेता?', 'अभी आप कौन-सी दवाइयाँ लेते हैं?'], hPrev: ['Any past illnesses or long-term conditions (diabetes, BP, asthma…)?', 'पूर्वीचे आजार किंवा दीर्घकालीन आजार (मधुमेह, बीपी, दमा…)?', 'पहले की बीमारियाँ या पुरानी स्थितियाँ (मधुमेह, बीपी, दमा…)?'],
  backQ: ['Does the back pain stay in one place or travel down one leg, with tingling or weakness?', 'कंबरेचे दुखणे तिथेच राहते की एका पायापर्यंत जाते, आणि मुंग्या किंवा अशक्तपणा आहे का?', 'क्या कमर दर्द वहीं रहता है या एक पैर तक जाता है, और झुनझुनी या कमज़ोरी है?'],
  backH: ['Tell staff immediately if there is new weakness or difficulty passing urine.', 'नवीन अशक्तपणा किंवा लघवी करण्यास त्रास असल्यास स्टाफला लगेच सांगा.', 'नई कमज़ोरी या पेशाब में दिक्कत हो तो तुरंत स्टाफ को बताएँ।'],
  // reports
  repTitle: ['Reports', 'रिपोर्ट', 'रिपोर्ट'], repDesc: ['Optional: add a prescription or report by camera, file, or typing.', 'पर्यायी: कॅमेरा, फाइल किंवा टाइप करून प्रिस्क्रिप्शन/रिपोर्ट जोडा.', 'वैकल्पिक: कैमरा, फ़ाइल या टाइप करके पर्चा/रिपोर्ट जोड़ें।'],
  cam: ['Scan with camera', 'कॅमेऱ्याने स्कॅन करा', 'कैमरे से स्कैन करें'], mobileCam: ['Use mobile camera', 'मोबाइल कॅमेरा वापरा', 'मोबाइल कैमरा उपयोग करें'], upload: ['Upload PDF / JPG / PNG', 'PDF / JPG / PNG अपलोड करा', 'PDF / JPG / PNG अपलोड करें'], typed: ['Add written report', 'लिहिलेला रिपोर्ट जोडा', 'लिखी रिपोर्ट जोड़ें'],
  repSafety: ['Safety signals found in the report text will be shown to staff.', 'रिपोर्टच्या मजकुरात सापडलेले सुरक्षा संकेत स्टाफला दाखवले जातील.', 'रिपोर्ट के पाठ में मिले सुरक्षा संकेत स्टाफ को दिखाए जाएँगे।'],
  ocrNote: ['This text was read automatically and may contain mistakes. Please check and correct it.', 'हा मजकूर आपोआप वाचला आहे आणि त्यात चुका असू शकतात. कृपया तपासा आणि दुरुस्त करा.', 'यह पाठ अपने-आप पढ़ा गया है और इसमें गलतियाँ हो सकती हैं। कृपया जाँचें और सुधारें।'],
  ruleNote: ['Detected fields use simple keyword rules, not AI, and may be incomplete. They are not a diagnosis.', 'आढळलेली फील्ड साध्या शब्द-नियमांनी काढली आहेत, AI ने नाही, आणि अपूर्ण असू शकतात. हे निदान नाही.', 'पहचाने गए फ़ील्ड सरल शब्द-नियमों से निकाले गए हैं, AI से नहीं, और अधूरे हो सकते हैं। यह निदान नहीं है।'],
  extractedText: ['EXTRACTED TEXT (editable)', 'काढलेला मजकूर (बदलता येतो)', 'निकाला गया पाठ (बदला जा सकता है)'], status_processing: ['Reading…', 'वाचत आहे…', 'पढ़ रहे हैं…'], status_ready: ['Ready', 'तयार', 'तैयार'], status_failed: ['Could not read', 'वाचता आले नाही', 'पढ़ा नहीं जा सका'],
  f_med: ['MEDICINES', 'औषधे', 'दवाइयाँ'], f_dx: ['DIAGNOSIS (as written)', 'निदान (लिहिल्याप्रमाणे)', 'निदान (जैसा लिखा है)'], f_tests: ['TESTS', 'चाचण्या', 'जाँचें'], f_allergy: ['ALLERGIES', 'ॲलर्जी', 'एलर्जी'], f_obs: ['OBSERVATIONS', 'निरीक्षणे', 'अवलोकन'], notFound: ['Not found in uploaded report', 'अपलोड केलेल्या रिपोर्टमध्ये आढळले नाही', 'अपलोड की गई रिपोर्ट में नहीं मिला'],
  retake: ['Retake', 'पुन्हा घ्या', 'दोबारा लें'], useShot: ['Use this photo', 'हा फोटो वापरा', 'यह फ़ोटो उपयोग करें'], capture: ['Capture', 'फोटो घ्या', 'फ़ोटो लें'], cancel: ['Cancel', 'रद्द करा', 'रद्द करें'], remove: ['Remove', 'काढा', 'हटाएँ'], trim: ['Trim edges', 'कडा कापा', 'किनारे काटें'], saveDoc: ['Add to intake', 'नोंदणीत जोडा', 'इंटेक में जोड़ें'],
  camErr: ['The camera could not be opened. Allow camera permission or upload a file instead.', 'कॅमेरा उघडता आला नाही. कॅमेरा परवानगी द्या किंवा फाइल अपलोड करा.', 'कैमरा नहीं खुल सका। कैमरा अनुमति दें या फ़ाइल अपलोड करें।'],
  fileErr: ['Only PDF, JPG and PNG files up to 15 MB are accepted.', 'फक्त 15 MB पर्यंतच्या PDF, JPG आणि PNG फाइल स्वीकारल्या जातात.', 'केवल 15 MB तक की PDF, JPG और PNG फ़ाइलें स्वीकार हैं।'],
  typedPh: ['Type or paste the report text here', 'रिपोर्टचा मजकूर येथे लिहा किंवा पेस्ट करा', 'रिपोर्ट का पाठ यहाँ लिखें या पेस्ट करें'], v_rep: ['You may add a report now, or continue without one.', 'तुम्ही आता रिपोर्ट जोडू शकता किंवा न जोडता पुढे जाऊ शकता.', 'आप अभी रिपोर्ट जोड़ सकते हैं या बिना जोड़े आगे बढ़ सकते हैं।'],
  // safety
  safeTitle: ['Safety check', 'सुरक्षा तपासणी', 'सुरक्षा जाँच'], safeDesc: ['We checked everything you entered for urgent warning signs.', 'तुम्ही दिलेली सर्व माहिती तातडीच्या धोक्याच्या लक्षणांसाठी तपासली.', 'आपके द्वारा दी गई सारी जानकारी को आपातकालीन चेतावनी संकेतों के लिए जाँचा गया।'],
  safeNone: ['No urgent warning signs were detected in what you entered. This is not a medical clearance — tell staff at once if you feel worse.', 'तुम्ही दिलेल्या माहितीत तातडीची धोक्याची लक्षणे आढळली नाहीत. ही वैद्यकीय क्लिअरन्स नाही – त्रास वाढल्यास लगेच स्टाफला सांगा.', 'आपकी दी गई जानकारी में कोई आपातकालीन संकेत नहीं मिला। यह चिकित्सकीय मंज़ूरी नहीं है — तकलीफ़ बढ़े तो तुरंत स्टाफ को बताएँ।'],
  emTitle: ['Please seek urgent medical help now', 'कृपया आत्ताच तातडीची वैद्यकीय मदत घ्या', 'कृपया अभी तुरंत चिकित्सा सहायता लें'],
  emBody: ['A warning sign was found: {x}. This is not a diagnosis. Tell staff now, call 112 in India, or go to the nearest emergency department. Do not wait to finish this intake.', 'धोक्याचे लक्षण आढळले: {x}. हे निदान नाही. आत्ताच स्टाफला सांगा, भारतात 112 वर कॉल करा किंवा जवळच्या आपत्कालीन विभागात जा. ही नोंदणी पूर्ण होण्याची वाट पाहू नका.', 'चेतावनी संकेत मिला: {x}। यह निदान नहीं है। अभी स्टाफ को बताएँ, भारत में 112 पर कॉल करें या नज़दीकी आपातकालीन विभाग जाएँ। इंटेक पूरा होने का इंतज़ार न करें।'],
  signals: ['Warning signs found', 'आढळलेली धोक्याची लक्षणे', 'मिले चेतावनी संकेत'],
  // summary
  sumTitle: ['Summary', 'सारांश', 'सारांश'], sumDesc: ['Check your answers. You can go back to change anything.', 'तुमची उत्तरे तपासा. काही बदलायचे असल्यास मागे जा.', 'अपने उत्तर जाँचें। कुछ बदलना हो तो पीछे जाएँ।'],
  print: ['Print', 'प्रिंट', 'प्रिंट'], dlTxt: ['Download .txt', '.txt डाउनलोड', '.txt डाउनलोड'], dlJson: ['Download .json', '.json डाउनलोड', '.json डाउनलोड'],
  h_patient: ['Patient', 'रुग्ण', 'रोगी'], h_cons: ['Consultation', 'तपासणी प्रकार', 'जाँच का प्रकार'], h_concern: ['Main concern', 'मुख्य तक्रार', 'मुख्य शिकायत'], h_body: ['Body areas', 'शरीराचे भाग', 'शरीर के हिस्से'], h_ans: ['Question answers', 'प्रश्नांची उत्तरे', 'प्रश्नों के उत्तर'], h_ay: ['Ayurvedic history (patient-reported)', 'आयुर्वेदिक इतिहास (रुग्णाने सांगितलेला)', 'आयुर्वेदिक इतिहास (रोगी द्वारा बताया)'],
  h_reports: ['Reports (text as read from the document — unverified)', 'रिपोर्ट (दस्तऐवजातून वाचलेला मजकूर – पडताळलेला नाही)', 'रिपोर्ट (दस्तावेज़ से पढ़ा पाठ — असत्यापित)'], h_safety: ['Safety signals', 'सुरक्षा संकेत', 'सुरक्षा संकेत'], notProvided: ['Not provided', 'दिलेले नाही', 'नहीं दिया'], none: ['None found', 'काहीही आढळले नाही', 'कुछ नहीं मिला'],
  disclaimer: ['NIDAN is not a diagnostic tool. This summary lists only what the patient entered or what was read from uploaded documents, for review by a qualified clinician.', 'NIDAN हे निदान साधन नाही. या सारांशात फक्त रुग्णाने दिलेली किंवा अपलोड केलेल्या दस्तऐवजातून वाचलेली माहिती आहे, पात्र डॉक्टरांच्या तपासणीसाठी.', 'NIDAN निदान उपकरण नहीं है। इस सारांश में केवल रोगी द्वारा दी गई या अपलोड दस्तावेज़ों से पढ़ी जानकारी है, योग्य चिकित्सक की समीक्षा के लिए।'],
  // review/done
  revTitle: ['Doctor review', 'डॉक्टर रिव्ह्यू', 'डॉक्टर समीक्षा'], revDesc: ['For the care team: read the handoff, add notes and mark it reviewed.', 'काळजी टीमसाठी: हँडऑफ वाचा, नोंदी लिहा आणि तपासले म्हणून चिन्हांकित करा.', 'देखभाल टीम के लिए: हैंडऑफ पढ़ें, नोट जोड़ें और समीक्षित चिह्नित करें।'],
  notes: ['Clinician notes (entered by staff only)', 'डॉक्टरांच्या नोंदी (फक्त स्टाफ लिहितो)', 'चिकित्सक नोट (केवल स्टाफ लिखता है)'], markRev: ['Mark as reviewed and save', 'तपासले म्हणून सेव्ह करा', 'समीक्षित के रूप में सहेजें'], reviewedOk: ['Saved on this kiosk.', 'या किओस्कवर सेव्ह केले.', 'इस किओस्क पर सहेजा गया।'],
  saved: ['Saved sessions on this kiosk', 'या किओस्कवरील सेव्ह केलेले सेशन', 'इस किओस्क पर सहेजे सत्र'], noSaved: ['No saved sessions yet.', 'अजून कोणतेही सेशन सेव्ह नाहीत.', 'अभी कोई सत्र सहेजा नहीं गया।'], delete: ['Delete', 'हटवा', 'हटाएँ'],
  doneTitle: ['All done', 'सर्व पूर्ण', 'सब पूरा'], doneDesc: ['Your intake is ready for the care team. Please wait — staff will call you.', 'तुमची नोंदणी काळजी टीमसाठी तयार आहे. कृपया थांबा – स्टाफ तुम्हाला बोलावेल.', 'आपका इंटेक देखभाल टीम के लिए तैयार है। कृपया प्रतीक्षा करें — स्टाफ आपको बुलाएगा।'],
  newCase: ['Start a new patient', 'नवीन रुग्ण सुरू करा', 'नया रोगी शुरू करें'],
  // voice UI
  guide: ['AI GUIDE', 'AI GUIDE', 'AI GUIDE'], guideTip: ['For clear capture: speak one sentence at a time, keep the microphone close, and check the words before continuing.', 'आवाज स्पष्ट पकडण्यासाठी: एका वेळी एक वाक्य बोला, मायक्रोफोन जवळ ठेवा आणि वापरण्यापूर्वी शब्द तपासा.', 'आवाज़ साफ़ पकड़ने के लिए: एक बार में एक वाक्य बोलें, माइक्रोफ़ोन पास रखें और आगे बढ़ने से पहले शब्द जाँचें।'],
  replay: ['Replay', 'पुन्हा ऐका', 'फिर सुनें'], stop: ['Stop', 'थांबवा', 'रोकें'], mute: ['Mute', 'म्यूट', 'म्यूट'], unmute: ['Unmute', 'आवाज सुरू', 'आवाज़ चालू'], speakAns: ['Speak answer', 'उत्तर बोला', 'उत्तर बोलें'], auto: ['Auto-read', 'आपोआप वाचा', 'अपने-आप पढ़ें'],
  listening: ['Listening… speak now', 'ऐकत आहे… आता बोला', 'सुन रहे हैं… अब बोलें'], stopListen: ['Stop listening', 'ऐकणे थांबवा', 'सुनना रोकें'], heard: ['I heard:', 'मी ऐकले:', 'मैंने सुना:'], correct: ['Yes, correct', 'होय, बरोबर', 'हाँ, सही'], retry: ['Try again', 'पुन्हा बोला', 'फिर बोलें'], editHint: ['You can also edit the text above.', 'वरील मजकूर तुम्ही बदलू शकता.', 'आप ऊपर का पाठ बदल भी सकते हैं।'],
  noRecog: ['Voice recognition is not available in this browser. Please type your answer.', 'या ब्राउझरमध्ये आवाज ओळख उपलब्ध नाही. कृपया उत्तर टाइप करा.', 'इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। कृपया उत्तर टाइप करें।'],
  noVoice: ['No installed voice for this language, so it cannot be read aloud here. Please read the text.', 'या भाषेसाठी स्थापित आवाज नाही, त्यामुळे येथे वाचून दाखवता येत नाही. कृपया मजकूर वाचा.', 'इस भाषा के लिए कोई आवाज़ स्थापित नहीं है, इसलिए यहाँ पढ़कर नहीं सुनाया जा सकता। कृपया पाठ पढ़ें।'],
  micDenied: ['Microphone permission was denied. Allow it in the browser, or type your answer.', 'मायक्रोफोन परवानगी नाकारली गेली. ब्राउझरमध्ये परवानगी द्या किंवा उत्तर टाइप करा.', 'माइक्रोफ़ोन अनुमति अस्वीकृत हुई। ब्राउज़र में अनुमति दें या उत्तर टाइप करें।'],
  noSpeech: ['I could not hear clearly. Please try again or type.', 'स्पष्ट ऐकू आले नाही. कृपया पुन्हा प्रयत्न करा किंवा टाइप करा.', 'साफ़ सुनाई नहीं दिया। कृपया फिर कोशिश करें या टाइप करें।'],
  unclear: ['I could not tell which option you meant. Please tap one.', 'तुम्ही कोणता पर्याय म्हणालात ते समजले नाही. कृपया एकावर टॅप करा.', 'समझ नहीं आया आपने कौन-सा विकल्प कहा। कृपया एक पर टैप करें।'],
  picked: ['Selected: {x}. Tap another to change.', 'निवडले: {x}. बदलण्यासाठी दुसरे टॅप करा.', 'चुना गया: {x}। बदलने के लिए दूसरा टैप करें।'],
  speakOpt: ['Speak your choice', 'तुमचा पर्याय बोला', 'अपना विकल्प बोलें'],
  // help / misc
  helpTitle: ['How to use NIDAN', 'NIDAN कसे वापरावे', 'NIDAN कैसे उपयोग करें'], helpBody: ['Tap the speaker to hear a question. Tap the microphone to answer, then check the words and tap “Yes, correct”. You can always type or tap instead. If you feel very unwell, tell staff at once or call 112.', 'प्रश्न ऐकण्यासाठी स्पीकरवर टॅप करा. उत्तर देण्यासाठी मायक्रोफोनवर टॅप करा, मग शब्द तपासा आणि “होय, बरोबर” दाबा. तुम्ही नेहमी टाइप किंवा टॅप करू शकता. खूप अस्वस्थ वाटल्यास लगेच स्टाफला सांगा किंवा 112 वर कॉल करा.', 'प्रश्न सुनने के लिए स्पीकर पर टैप करें। उत्तर देने के लिए माइक्रोफ़ोन पर टैप करें, फिर शब्द जाँचें और “हाँ, सही” दबाएँ। आप हमेशा टाइप या टैप कर सकते हैं। बहुत बीमार लगे तो तुरंत स्टाफ को बताएँ या 112 पर कॉल करें।'],
  close: ['Close', 'बंद करा', 'बंद करें'], confirmReset: ['Clear this session and start over?', 'हे सेशन पुसून पुन्हा सुरू करायचे?', 'यह सत्र मिटाकर फिर से शुरू करें?'],
  required: ['Please answer this question or use “Skip this question”.', 'कृपया या प्रश्नाचे उत्तर द्या किंवा “हा प्रश्न वगळा” वापरा.', 'कृपया इस प्रश्न का उत्तर दें या “यह प्रश्न छोड़ें” उपयोग करें।'],
  needConsent: ['Please tick the box to agree before continuing.', 'पुढे जाण्यापूर्वी संमतीचा बॉक्स निवडा.', 'आगे बढ़ने से पहले सहमति का बॉक्स चुनें।'],
  needPick: ['Please choose an option to continue.', 'पुढे जाण्यासाठी एक पर्याय निवडा.', 'आगे बढ़ने के लिए एक विकल्प चुनें।'],  qChanged: ['What has changed since your last visit?', 'मागील भेटीनंतर काय बदलले?', 'पिछली मुलाकात के बाद क्या बदला?'],
  feelNow: ['How are you feeling now?', 'आता तुम्हाला कसे वाटत आहे?', 'अब आप कैसा महसूस कर रहे हैं?'], fb: ['Better', 'बरे', 'बेहतर'], fs: ['About the same', 'साधारण तसेच', 'लगभग वैसा ही'], fw: ['Worse', 'वाईट', 'बदतर'], fn: ['A new problem', 'नवीन समस्या', 'नई समस्या'],
  feelDesc: ['Welcome back. Tell us how you are today compared with your last visit.', 'पुन्हा स्वागत. मागील भेटीच्या तुलनेत आज तुम्ही कसे आहात ते सांगा.', 'फिर स्वागत है। पिछली मुलाकात की तुलना में आज आप कैसे हैं, बताइए।'], tellMore: ['Tell us more', 'अधिक सांगा', 'और बताइए'],
  researchOpt: ['Optional: allow my answers, with name and phone removed, to help improve this hospital’s own AI. Saying no changes nothing about my care.', 'ऐच्छिक: नाव व फोन काढून माझी उत्तरे या रुग्णालयाच्या स्वतःच्या AI ला सुधारण्यासाठी वापरता येतील. नाही म्हटल्याने माझ्या उपचारात काहीही फरक पडत नाही.', 'वैकल्पिक: नाम और फ़ोन हटाकर मेरे उत्तर इस अस्पताल के अपने AI को बेहतर बनाने में उपयोग हो सकते हैं। मना करने से मेरे इलाज में कोई फ़र्क नहीं पड़ता।'],
  aiProcessOpt: ['Optional: I agree to let this hospital’s configured local AI process my visit information to prepare an unverified draft summary or translation for staff. This is not for training; saying no does not affect my care.', 'ऐच्छिक: स्टाफसाठी अप्रमाणित मसुदा सारांश किंवा भाषांतर तयार करण्यासाठी या रुग्णालयाच्या कॉन्फिगर केलेल्या स्थानिक AI कडून माझ्या भेटीची माहिती प्रक्रिया करण्यास मी संमती देतो/देते. याचा प्रशिक्षणासाठी वापर होणार नाही; नकार दिल्यासही माझ्या काळजीवर परिणाम होणार नाही.', 'वैकल्पिक: स्टाफ के लिए अप्रमाणित प्रारूप सारांश या अनुवाद तैयार करने हेतु इस अस्पताल के कॉन्फ़िगर किए गए स्थानीय AI द्वारा मेरी मुलाक़ात की जानकारी संसाधित करने की मैं सहमति देता/देती हूँ। इसका उपयोग प्रशिक्षण के लिए नहीं होगा; मना करने पर भी मेरी देखभाल प्रभावित नहीं होगी।'],
  aiProcessDesc: ['Separate, optional, and off by default. If you leave this unchecked, no AI processing is requested for this visit. A local model may still be unavailable; any draft requires staff review and is not a diagnosis or treatment.', 'ही संमती स्वतंत्र व ऐच्छिक असून डीफॉल्टने बंद आहे. हा पर्याय न निवडल्यास या भेटीसाठी AI प्रक्रिया मागितली जाणार नाही. स्थानिक मॉडेल उपलब्ध नसेलही; कोणताही मसुदा स्टाफने तपासणे आवश्यक आहे आणि तो निदान किंवा उपचार नाही.', 'यह अलग, वैकल्पिक और डिफ़ॉल्ट रूप से बंद है। इसे न चुनने पर इस मुलाक़ात के लिए AI प्रसंस्करण का अनुरोध नहीं होगा। स्थानीय मॉडल उपलब्ध न भी हो सकता है; किसी भी प्रारूप की स्टाफ द्वारा जाँच आवश्यक है और यह निदान या उपचार नहीं है।'],
  proxyTr: ['This language’s interface is shown using a closely related language until its own native-speaker translation is reviewed. Typing and speaking in your own language still work.', 'या भाषेचा इंटरफेस तिचे स्वतःचे मूळ-भाषक भाषांतर तपासले जाईपर्यंत जवळच्या भाषेत दाखवला आहे. तुमच्या भाषेत लिहिणे आणि बोलणे आधीप्रमाणेच चालते.', 'इस भाषा का इंटरफ़ेस, उसका अपना मूल-भाषी अनुवाद जाँचे जाने तक, किसी निकट भाषा में दिखाया गया है। अपनी भाषा में लिखना और बोलना पहले की तरह काम करता है।'],
  tr_draft: ['Draft translation — review required', 'मसुदा भाषांतर — तपासणी आवश्यक', 'प्रारूप अनुवाद — समीक्षा ज़रूरी'],
  draftTr: ['Draft translation: not yet reviewed by a native speaker or clinician. Ask staff if anything is unclear.', 'मसुदा भाषांतर: मूळ भाषक किंवा डॉक्टरांनी अजून तपासलेले नाही. काही अस्पष्ट असल्यास स्टाफला विचारा.', 'प्रारूप अनुवाद: अभी किसी मूल भाषी या चिकित्सक ने जाँचा नहीं है। कुछ अस्पष्ट हो तो स्टाफ से पूछें।'],

  // privacy / proxy / alerts / accessibility
  forWho: ['Who is answering?', 'उत्तर कोण देत आहे?', 'उत्तर कौन दे रहा है?'], forSelf: ['The patient (myself)', 'रुग्ण स्वतः', 'रोगी स्वयं'], forChild: ['I am answering for my child', 'मी माझ्या मुलासाठी उत्तर देत आहे', 'मैं अपने बच्चे की ओर से उत्तर दे रहा/रही हूँ'], forOther: ['I am answering for a family member', 'मी कुटुंबातील सदस्यासाठी उत्तर देत आहे', 'मैं परिवार के सदस्य की ओर से उत्तर दे रहा/रही हूँ'],
  relation: ['Your relation to the patient (e.g. mother)', 'रुग्णाशी तुमचे नाते (उदा. आई)', 'रोगी से आपका संबंध (जैसे माँ)'], proxyNote: ['Please answer about the patient, not about yourself.', 'कृपया स्वतःबद्दल नाही, रुग्णाबद्दल उत्तर द्या.', 'कृपया अपने बारे में नहीं, रोगी के बारे में उत्तर दें।'],
  unitY: ['years', 'वर्षे', 'वर्ष'], unitM: ['months', 'महिने', 'महीने'], errAgeM: ['Enter months between 0 and 35.', '0 ते 35 महिने लिहा.', '0 से 35 महीने लिखें।'], errRel: ['Please write your relation to the patient.', 'कृपया रुग्णाशी तुमचे नाते लिहा.', 'कृपया रोगी से अपना संबंध लिखें।'],
  pregQ: ['Is the patient pregnant, or could she be?', 'रुग्ण गर्भवती आहे का किंवा असू शकते का?', 'क्या रोगी गर्भवती है या हो सकती है?'], staffHelp: ['Staff is helping me', 'स्टाफ मला मदत करत आहे', 'स्टाफ मेरी मदद कर रहा है'], express: ['Quick intake (skip optional steps)', 'जलद नोंदणी (पर्यायी पायऱ्या वगळा)', 'त्वरित इंटेक (वैकल्पिक चरण छोड़ें)'],
  guardian: ['I am the parent / legal guardian, or authorised to answer for this patient.', 'मी पालक / कायदेशीर पालक आहे किंवा या रुग्णासाठी उत्तर देण्यास अधिकृत आहे.', 'मैं माता-पिता / कानूनी अभिभावक हूँ या इस रोगी की ओर से उत्तर देने के लिए अधिकृत हूँ।'], needGuardian: ['Please confirm you are the guardian or authorised person.', 'कृपया तुम्ही पालक किंवा अधिकृत व्यक्ती आहात हे निश्चित करा.', 'कृपया पुष्टि करें कि आप अभिभावक या अधिकृत व्यक्ति हैं।'],
  voiceTitle: ['Use voice input?', 'आवाज इनपुट वापरायचे?', 'आवाज़ इनपुट उपयोग करें?'], voiceBody: ['If you allow voice, your browser sends the recording to its speech service (Google for Chrome, Microsoft for Edge) to turn it into text. NIDAN does not store audio. You can type instead.', 'आवाजाला परवानगी दिल्यास तुमचा ब्राउझर रेकॉर्डिंग मजकुरात बदलण्यासाठी त्याच्या स्पीच सेवेकडे (Chrome साठी Google, Edge साठी Microsoft) पाठवतो. NIDAN ऑडिओ साठवत नाही. तुम्ही टाइप करू शकता.', 'आवाज़ की अनुमति देने पर आपका ब्राउज़र रिकॉर्डिंग को टेक्स्ट में बदलने के लिए अपनी स्पीच सेवा (Chrome के लिए Google, Edge के लिए Microsoft) को भेजता है। NIDAN ऑडियो सहेजता नहीं। आप टाइप कर सकते हैं।'],
  voiceAllow: ['Allow voice', 'आवाज वापरा', 'आवाज़ की अनुमति दें'], voiceDeny: ['Typing only', 'फक्त टाइप', 'केवल टाइप'], voiceOff: ['Voice is off (you chose typing only). Tap the mic to change.', 'आवाज बंद आहे (तुम्ही फक्त टाइप निवडले). बदलण्यासाठी माइकवर टॅप करा.', 'आवाज़ बंद है (आपने केवल टाइप चुना)। बदलने के लिए माइक पर टैप करें।'],
  alertSent: ['Staff have been alerted. Please stay here.', 'स्टाफला कळवले आहे. कृपया येथेच थांबा.', 'स्टाफ को सूचित कर दिया गया है। कृपया यहीं रुकें।'], alertLocal: ['The alert is on the staff screen. Please also tell the nearest staff member now.', 'सूचना स्टाफच्या स्क्रीनवर आहे. कृपया जवळच्या स्टाफलाही आत्ताच सांगा.', 'सूचना स्टाफ की स्क्रीन पर है। कृपया पास के स्टाफ को भी अभी बताएँ।'], alertQueued: ['Alert saved but not yet delivered. Please tell the nearest staff member NOW.', 'सूचना सेव्ह केली पण अजून पोहोचली नाही. कृपया जवळच्या स्टाफला आत्ताच सांगा.', 'सूचना सहेजी गई पर अभी पहुँची नहीं। कृपया पास के स्टाफ को अभी बताएँ।'], alertAck: ['Staff are coming to you.', 'स्टाफ तुमच्याकडे येत आहे.', 'स्टाफ आपके पास आ रहा है।'],
  token: ['Your queue token', 'तुमचा रांग क्रमांक', 'आपका कतार टोकन'], delData: ['Delete my data now', 'माझा डेटा आत्ता हटवा', 'मेरा डेटा अभी हटाएँ'], delDone: ['Your data was deleted from this kiosk. An urgent alert, if there was one, stays (without your name) until staff see it.', 'तुमचा डेटा या किओस्कवरून हटवला. तातडीची सूचना असल्यास ती (नावाशिवाय) स्टाफने पाहेपर्यंत राहते.', 'आपका डेटा इस किओस्क से हटा दिया गया। आपातकालीन सूचना हो तो वह (नाम के बिना) स्टाफ के देखने तक रहती है।'],
  demoBanner: ['DEMO MODE — fictional patient. Nothing real is entered.', 'डेमो मोड — काल्पनिक रुग्ण. काहीही खरे नोंदवले जात नाही.', 'डेमो मोड — काल्पनिक रोगी। कुछ भी असली दर्ज नहीं होता।'], handoff: ['Your intake has been handed to the care team. Only staff can open it.', 'तुमची नोंदणी काळजी टीमकडे सोपवली आहे. ती फक्त स्टाफ उघडू शकतो.', 'आपका इंटेक देखभाल टीम को सौंप दिया गया है। इसे केवल स्टाफ खोल सकता है।'], notSaved: ['Staff setup is not done on this device, so this intake was NOT saved. Ask staff.', 'या उपकरणावर स्टाफ सेटअप झालेला नाही, म्हणून ही नोंदणी सेव्ह झाली नाही. स्टाफला विचारा.', 'इस डिवाइस पर स्टाफ सेटअप नहीं हुआ है, इसलिए यह इंटेक सहेजा नहीं गया। स्टाफ से पूछें।'],
  textSize: ['Text size', 'अक्षरांचा आकार', 'अक्षर का आकार'], contrast: ['High contrast', 'उच्च कॉन्ट्रास्ट', 'उच्च कंट्रास्ट'], reviewTier: ['Needs staff check', 'स्टाफने तपासावे', 'स्टाफ द्वारा जाँच आवश्यक'], handwriting: ['Low confidence: handwriting or a poor photo is often unreadable. Please type the key lines or ask staff to read the original.', 'कमी विश्वास: हस्ताक्षर किंवा खराब फोटो अनेकदा वाचता येत नाही. कृपया मुख्य ओळी टाइप करा किंवा स्टाफला मूळ वाचायला सांगा.', 'कम विश्वसनीयता: हस्तलिखित या खराब फोटो अक्सर नहीं पढ़े जाते। कृपया मुख्य पंक्तियाँ टाइप करें या स्टाफ से मूल पढ़वाएँ।'],
  unverified: ['UNVERIFIED — staff must check against the original', 'असत्यापित — स्टाफने मूळाशी तपासावे', 'असत्यापित — स्टाफ मूल से मिलान करे'], voiceInstalled: ['voice installed', 'आवाज उपलब्ध', 'आवाज़ उपलब्ध'], voiceMissingChip: ['no voice on this device', 'या उपकरणावर आवाज नाही', 'इस डिवाइस पर आवाज़ नहीं'],
}

export const uiEnglishSource: Record<string, string> = Object.fromEntries(Object.entries(D).map(([key, values]) => [key, values[0]]))

export type UiLang = 'en' | 'mr' | 'hi'
export const baseOf = (code: string) => code.split('-')[0]
// Languages whose interface text is not yet written individually show the closest related language
// (same script / family) instead of English. They are always labelled as draft + proxy in the UI.
export const UI_PROXY: Record<string, string> = { kok: 'mr', mai: 'hi', doi: 'hi', brx: 'hi', sa: 'hi', sat: 'hi', ks: 'ur', sd: 'ur', mni: 'bn' }
export const uiProxyOf = (code: string): string | null => UI_PROXY[baseOf(code)] ?? null
const resBase = (code: string) => UI_PROXY[baseOf(code)] ?? baseOf(code)
export const uiLangOf = (code: LanguageCode): UiLang | null => { const b = baseOf(code); const eff = UI_PROXY[b] ?? b; return eff === 'mr' ? 'mr' : eff === 'hi' ? 'hi' : b === 'en' ? 'en' : null }
export const isRtl = (code: LanguageCode) => /^(ur|sd|ks)(-|$)/.test(code)
export type Tier = 'full' | 'draft' | 'none'
export const uiTier = (code: LanguageCode): Tier => languageByCode(code).translation === 'reviewed' ? 'full' : uiLangOf(code) || LOC[resBase(code)] ? 'draft' : 'none'
export const hasUiTranslation = (code: LanguageCode) => uiTier(code) !== 'none'
export const dict = D
export const nativeName = (code: LanguageCode) => languageByCode(code).nativeName

function applyVars(value: string, vars?: Record<string, string | number>) {
  if (!vars) return value
  for (const [key, item] of Object.entries(vars)) value = value.split(`{${key}}`).join(String(item))
  return value
}

export function localeTextValue(code: LanguageCode, source: string, vars?: Record<string, string | number>) {
  const entries = LOC[resBase(code)] ?? {}
  const exact = entries[`text:${source}`]
  if (exact) return applyVars(exact, vars)
  const keys = Object.keys(entries).filter((key) => key.startsWith('text:') && key.includes('{'))
  for (const key of keys) {
    const template = key.slice(5)
    const names: string[] = []
    const regexMeta = '.+*?^$()|[]{}\\'
    const escape = (part: string) => Array.from(part).map((char) => regexMeta.includes(char) ? `\\${char}` : char).join('')
    let cursor = 0, patternSource = '^'
    while (cursor < template.length) {
      const open = template.indexOf('{', cursor)
      if (open < 0) { patternSource += escape(template.slice(cursor)); break }
      patternSource += escape(template.slice(cursor, open))
      const close = template.indexOf('}', open + 1)
      if (close < 0) { patternSource += escape(template.slice(open)); break }
      const name = template.slice(open + 1, close)
      if (!name || !Array.from(name).every((char) => /[A-Za-z0-9_]/.test(char))) {
        patternSource += escape(template.slice(open, close + 1)); cursor = close + 1; continue
      }
      names.push(name); patternSource += '(.+?)'; cursor = close + 1
    }
    const pattern = new RegExp(`${patternSource}$`)
    const match = source.match(pattern)
    if (!match) continue
    const replacements = Object.fromEntries(names.map((name, index) => [name, match[index + 1]]))
    return applyVars(entries[key], { ...replacements, ...vars })
  }
  return applyVars(source, vars)
}

export const translateUiText = (code: LanguageCode, source: string, vars?: Record<string, string | number>) => localeTextValue(code, source, vars)
export const clinicalText = (code: LanguageCode, key: string, fallback: string) => LOC[resBase(code)]?.[`clinical:${key}`] ?? fallback

export function makeUi(code: LanguageCode) {
  const idx = { en: 0, mr: 1, hi: 2 }[uiLangOf(code) ?? 'en']
  return (key: string, vars?: Record<string, string | number>) => {
    const loc = uiLangOf(code) ? undefined : LOC[resBase(code)]?.[key]
    return applyVars(loc ?? D[key]?.[idx] ?? D[key]?.[0] ?? key, vars)
  }
}
export type Ui = ReturnType<typeof makeUi>
