// Turns the Arabic page text into what the voice should read: numbers written out in words, dates read as
// "the 24th of January, year two thousand and four", units spelled out, and names given vowel marks.
// Returns the spoken text plus a map from each page-text index to its spoken-text index, so sentence
// highlighting still lines up even though the two texts differ.

const ONES = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const ONES_F = ['صفر', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثماني', 'تسع'];
const TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TEENS_F = ['عشر', 'إحدى عشرة', 'اثنتا عشرة', 'ثلاث عشرة', 'أربع عشرة', 'خمس عشرة', 'ست عشرة', 'سبع عشرة', 'ثماني عشرة', 'تسع عشرة'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

function below1000(n, fem = false) {
  const ones = fem ? ONES_F : ONES, teens = fem ? TEENS_F : TEENS;
  const h = Math.floor(n / 100), r = n % 100, parts = [];
  if (h) parts.push(HUNDREDS[h]);
  const u = r % 10, unit = fem && u === 1 ? 'إحدى' : ones[u];
  if (r >= 20) parts.push(u ? `${unit} و${TENS[Math.floor(r / 10)]}` : TENS[Math.floor(r / 10)]);
  else if (r >= 10) parts.push(teens[r - 10]);
  else if (r) parts.push(ones[r]);
  return parts.join(' و');
}

/**
 * Cardinal number in words. Numbers here are mostly objects or follow a preposition, so the default is the
 * -ين form ("واحدًا وعشرين" is read "واحد وعشرين"); nominative is for names like "أبولو اثنا عشر".
 * fem: the counted noun is feminine (ساعة، مرة…), which flips the gender of 1–19 ("ثلاث مرات").
 */
export function numberWords(n, { nominative = false, fem = false } = {}) {
  if (n === 0) return ONES[0];
  const th = Math.floor(n / 1000), rest = n % 1000, parts = [];
  if (th === 1) parts.push('ألف');
  else if (th === 2) parts.push('ألفان');
  else if (th) {
    const r = th % 100;
    if (r === 0) parts.push(`${below1000(th).replace(/مئتان$/, 'مئتا')} ألف`);
    else if (r <= 10) parts.push(`${below1000(th)} آلاف`);
    else parts.push(`${below1000(th)} ألفًا`);
  }
  if (rest) parts.push(below1000(rest, fem));
  let out = parts.join(' و');
  if (!nominative) out = out.replace(/ون(?=\s|$)/g, 'ين').replace(/ان(?=\s|$)/g, 'ين').replace(/اثنا /g, 'اثني ').replace(/اثنتا /g, 'اثنتي ').replace(/مئتا /g, 'مئتي ');
  return out;
}

const ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
/** Day of the month as an ordinal, as read in dates: 24 → "الرابع والعشرين". */
function dayWords(d) {
  if (d <= 10) return ORD[d];
  if (d === 11) return 'الحادي عشر';
  if (d < 20) return `${ORD[d - 10]} عشر`;
  const tens = d < 30 ? 'العشرين' : 'الثلاثين', u = d % 10;
  return u ? `${u === 1 ? 'الحادي' : ORD[u]} و${tens}` : tens;
}

const MONTHS = 'يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر';
const UNITS = { 'كم': 'كيلومتر', 'كغ': 'كيلوغرام', 'سم': 'سنتيمتر', '%': 'بالمئة' };
const isYear = (s) => /^(19|20)\d\d$/.test(s);
// Feminine counted nouns that follow numbers in our texts.
const FEM = /^\s*(?:ساعة|ساعات|دقيقة|دقائق|مرة|مرات|صورة|صور|رحلة|رحلات|ثانية|ثوانٍ|درجة|درجات|جولة|جولات|سنة|سنوات)(?![ء-ي])/;
const num = (s, opts = {}) => {
  const [int, frac] = s.split('.');
  if (!frac && isYear(int)) return numberWords(+int);
  return frac ? `${numberWords(+int, opts)} فاصلة ${numberWords(+frac, opts)}` : numberWords(+int, opts);
};

const NAMES = [
  ['إيغل', 'إِيغَل'], ['أبولو', 'أَبُولُّو'], ['أرمسترونغ', 'آرْمْسْتْرُونْغ'], ['ألدرين', 'أَلْدْرِين'], ['باز', 'بَاز'],
  ['سيرفيور', 'سِيرْفِيُور'], ['كونراد', 'كُونْرَاد'], ['وبين', 'وَبِين'], ['سوجورنر', 'سُوجُورْنَر'], ['باثفايندر', 'بَاثْفَايْنْدَر'],
  ['أبورتيونيتي', 'أُبُورْتْيُونِيتِي'], ['أوبي', 'أُوبِي'], ['ميريدياني بلانوم', 'مِيرِيدْيَانِي بْلَانُوم'], ['برسفيرنس', 'بِرْسِفِيرَنْس'],
  ['سبيريت', 'سْبِيرِيت'], ['غوسيف', 'غُوسِيف'], ['إنجنيويتي', 'إِنْجِنْيُوِيتِي'], ['جيزيرو', 'جِيزِيرُو'], ['رايت', 'رَايْت'],
  ['دراغونفلاي', 'دْرَاغُونْفْلَاي'], ['تيتان', 'تِيتَان'], ['إنسايت', 'إِنْسَايْت'], ['إليزيوم بلانيتيا', 'إِلِيزْيُوم بْلَانِيتْيَا'],
  ['بايونير', 'بَايُونِير'], ['الدبران', 'الدَّبَرَان'], ['كبلر', 'كِبْلَر'], ['تيس', 'تِيس'], ['أرتميس', 'أَرْتِمِيس'],
  ['هادلي ريل', 'هَادْلِي رِيل'], ['آريس فاليس', 'آرِيس فَالِيس'], ['فرا ماورو', 'فْرَا مَاوْرُو'], ['نيو مكسيكو', 'نْيُو مِكْسِيكُو'],
  ['ناسا', 'نَاسَا'], ['الهيماتيت', 'الْهِيمَاتِيت'], ['رائدَي', 'رَائِدَيْ'], ['رائدا', 'رَائِدَا'],
  ['ALSEP', 'أَلْسِيب'], ['RTG', 'آرْ تِي جِي'], ['K2', 'كِيه تُو'],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Tried in order at each position of the text; the first that matches is replaced. fn(match, textAfter).
const NAMED = new Map(NAMES);
const RULES = [
  [/\s*\((?:TESS|Dawn|NEAR Shoemaker|LRO|NASA Space Apps Challenge)\)/y, () => ''],
  [new RegExp(`(\\d{1,2}) (${MONTHS}) (\\d{4})`, 'y'), (m) => `${dayWords(+m[1])} من ${m[2]} عام ${numberWords(+m[3])}`],
  [new RegExp(`(\\d{1,2}) (${MONTHS})`, 'y'), (m) => `${dayWords(+m[1])} من ${m[2]}`],
  [new RegExp(`(${MONTHS}|أواخر) (\\d{4})`, 'y'), (m) => `${m[1]} عام ${numberWords(+m[2])}`],
  [/(أبولو|بايونير|سيرفيور) (\d+)/y, (m) => `${NAMED.get(m[1])} ${numberWords(+m[2], { nominative: true })}`],
  [/الرحلة (\d+)/y, (m) => `الرحلة رقم ${numberWords(+m[1])}`],
  [/1 متر/y, () => 'متر واحد'],
  [/مليار كم/y, () => 'مليار كيلومتر'],
  [/(\d+(?:\.\d+)?)(?:\s*(كم|كغ|سم|%))?/y, (m, after) => num(m[1], { fem: !m[2] && FEM.test(after) }) + (m[2] ? ' ' + UNITS[m[2]] : '')],
  ...NAMES.map(([a, b]) => [new RegExp(esc(a), 'y'), () => b]),
];

export function arabicSay(str) {
  let out = '';
  const map = new Array(str.length + 1);
  for (let i = 0; i < str.length;) {
    let hit = null;
    for (const [re, fn] of RULES) {
      re.lastIndex = i;
      const m = re.exec(str);
      if (m && m[0].length) { hit = [m[0].length, fn(m, str.slice(i + m[0].length))]; break; }
    }
    if (hit) {
      for (let k = 0; k < hit[0]; k++) map[i + k] = out.length;   // every page character of the match points at its start
      out += hit[1];
      i += hit[0];
    } else {
      map[i] = out.length;
      out += str[i++];
    }
  }
  map[str.length] = out.length;
  return { spoken: out, map };
}
