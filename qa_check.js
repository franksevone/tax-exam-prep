/**
 * qa_check.js — ตัวตรวจ QA หลัง Google Antigravity แก้ knowledge_data.js (เฟส 3-5 + โจทย์ชุด 5-16)
 * วิธีใช้:  node qa_check.js
 * ผ่านทั้งหมด -> พิมพ์ "QA PASS" / มีปัญหา -> แสดงรายการแล้ว exit code 1
 */
const fs = require("fs");

const DATA_FILE = "knowledge_data.js";
const APP_FILE = "app.js";
const KB_SRC = fs.readFileSync(DATA_FILE, "utf8");
const APP_SRC = fs.readFileSync(APP_FILE, "utf8");

const issues = [];
const warnings = [];

// ---------- 1. Syntax ----------
try {
  new Function(KB_SRC + "; return KNOWLEDGE_BASE;");
} catch (e) {
  issues.push(`SYNTAX ERROR knowledge_data.js: ${e.message}`);
}
try {
  new Function(APP_SRC);
} catch (e) {
  issues.push(`SYNTAX ERROR app.js: ${e.message}`);
}

// ---------- 2. โหลดข้อมูล ----------
let KB = [];
try {
  KB = new Function(KB_SRC + "; return KNOWLEDGE_BASE;")();
} catch (e) {
  issues.push(`โหลด KNOWLEDGE_BASE ไม่ได้: ${e.message}`);
}

if (KB.length) {
  // ---------- 3. id ซ้ำ / โครงสร้าง ----------
  const ids = new Set();
  KB.forEach((t) => {
    if (ids.has(t.id)) issues.push(`id ซ้ำ: ${t.id}`);
    ids.add(t.id);
    if (!t.title || !t.category) issues.push(`${t.id}: ขาด title/category`);
    if (!t.sections || !t.sections.length) issues.push(`${t.id}: ไม่มี sections`);
    else
      t.sections.forEach((s, i) => {
        if (!s.heading || !s.content) issues.push(`${t.id} section#${i + 1}: ขาด heading/content`);
      });

    // ---------- 4. Quiz validation ----------
    (t.quiz || []).forEach((q, i) => {
      if (!q.question || !q.explanation) issues.push(`${t.id} quiz#${i + 1}: ขาด question/explanation`);
      if (!Array.isArray(q.options) || q.options.length !== 4)
        issues.push(`${t.id} quiz#${i + 1}: ต้องมี 4 options (มี ${q.options && q.options.length})`);
      if (typeof q.answer !== "number" || q.answer < 0 || q.answer > 3)
        issues.push(`${t.id} quiz#${i + 1}: answer ต้องเป็น 0-3 (ได้ ${q.answer})`);
    });

    // ---------- 5. ตัวบท ----------
    (t.statutes || []).forEach((s, i) => {
      if (!s.sectionNumber || !s.fullText) issues.push(`${t.id} statute#${i + 1}: ขาด sectionNumber/fullText`);
    });
  });

  // ---------- 6. guard rails: เนื้อหาที่ห้ามถูกแก้ย้อน ----------
  const mustHave = [
    { file: DATA_FILE, label: "ม.42(10) ต้องเป็น 'เงินได้ที่ได้รับจากการรับมรดก' (ไม่ใช่สลากกินแบ่ง)", re: /\(10\) เงินได้ที่ได้รับจากการรับมรดก/ },
    { file: DATA_FILE, label: "ม.42(25) ต้องเป็นเงินประกันสังคม (ไม่ใช่ดอกเบี้ยพันธบัตร)", re: /\(25\) เงินประโยชน์ทดแทนที่ผู้ประกันตน/ },
    { file: DATA_FILE, label: "ม.65 ตรี(2) ต้องเป็น 'เงินกองทุน' (ไม่ใช่ค่าเสื่อมราคา)", re: /\(2\) เงินกองทุน เว้นแต่กองทุนสำรองเลี้ยงชีพ/ },
    { file: DATA_FILE, label: "ม.65 ตรี(6) ต้องมี 'เบี้ยปรับและเงินเพิ่ม...ภาษีเงินได้ของบริษัท'", re: /\(6\) เบี้ยปรับและเงินเพิ่มภาษีอากร/ },
    { file: DATA_FILE, label: "ม.65 ตรี(15) ต้องเป็น 'ค่าซื้อทรัพย์สิน...เกินปกติ' (ไม่ใช่ค่าค้ำประกัน)", re: /\(15\) ค่าซื้อทรัพย์สินและรายจ่าย/ },
    { file: DATA_FILE, label: "ม.65 ตรี(19) ต้องเป็น 'รายจ่ายที่กำหนดจ่ายจากผลกำไร'", re: /\(19\) รายจ่ายใดๆ ที่กำหนดจ่ายจากผลกำไร/ },
    { file: DATA_FILE, label: "ม.82/5 ต้องมี 6 ข้อ (รวมรถยนต์นั่ง + ม.65 ตรี(13))", re: /\(6\) ภาษีซื้อที่เกิดจากรายจ่ายต้องห้ามตามมาตรา 65 ตรี \(13\)/ },
    { file: DATA_FILE, label: "ม.47 ต้องมี 'ดอกเบี้ยเงินกู้ยืมเพื่อซื้อ/เช่าซื้อ/สร้างที่อยู่อาศัย' 100,000", re: /ดอกเบี้ยเงินกู้ยืมเพื่อซื้อ\/เช่าซื้อ\/สร้างที่อยู่อาศัย/ },
    { file: DATA_FILE, label: "ม.47 ต้องมี RMF/SSF/กองทุนสำรองเลี้ยงชีพ", re: /RMF/ },
    { file: APP_FILE, label: "app.js ต้องใช้ gemini-3.6-flash (ไม่ใช่ 1.5-flash ที่ปลดระวาง)", re: /gemini-3\.6-flash/ },
    { file: APP_FILE, label: "app.js ต้องไม่มี 'เมนูเดิม' (note นักพัฒนาหลุด)", re: /เมนูเดิม/ , neg: true},
    { file: APP_FILE, label: "app.js ต้องมี escapeHTML สำหรับข้อความผู้ใช้ในแชท (กัน XSS)", re: /escapeHTML\(text\)/ },
  ];
  mustHave.forEach((m) => {
    const src = m.file === DATA_FILE ? KB_SRC : APP_SRC;
    const ok = m.neg ? !m.re.test(src) : m.re.test(src);
    if (!ok) issues.push(`GUARD: ${m.label}`);
  });

  // ---------- 6b. เฟส 5 content guards (ตรวจเฉพาะเมื่อหมวดนั้นถูกเพิ่มมาแล้ว — ยังไม่เพิ่ม = ข้าม) ----------
  const topicById = Object.fromEntries(KB.map((t) => [t.id, JSON.stringify(t)]));
  const contentGuards = [
    ["law-fiscal-discipline", "ม.9 ขาดดุลงบประมาณไม่เกิน 20% ของงบประมาณรายจ่าย", /(ร้อยละ\s?(20|ยี่สิบ|๒๐)|20%)\s?ของงบประมาณรายจ่าย/],
    ["law-fiscal-discipline", "ม.50 หนี้สาธารณะไม่เกิน 60% ของ GDP", /(ร้อยละ\s?(60|หกสิบ|๖๐)|60%)\s?ของผลิตภัณฑ์มวลรวม/],
    ["law-fiscal-discipline", "ภาระหนี้ไม่เกิน 15% ของงบประมาณรายจ่าย (ม.51)", /(ร้อยละ\s?(15|สิบห้า|๑๕)|15%)\s?ของงบประมาณรายจ่าย/],
    ["law-procurement", "วิธีเฉพาะเจาะจง วงเงิน 500,000 บาท", /เฉพาะเจาะจง.{0,150}(500,000|ห้าแสน|๕๐๐,๐๐๐)/],
    ["law-procurement", "ข้อตกลงคุณธรรม 1,000 ล้านบาท (ม.93)", /(1,000|หนึ่งพัน) ?ล้านบาท/],
    ["law-state-admin", "ต้องมีราชการส่วนภูมิภาค", /ราชการส่วนภูมิภาค/],
    ["law-state-admin", "ต้องมีราชการส่วนท้องถิ่น", /ราชการส่วนท้องถิ่น/],
    ["law-revenue-code-extra", "ภ.ง.ด.94 ภายใน 30 กันยายน (ม.56 ทวิ)", /มาตรา 56 ทวิ|56 ทวิ|ภ\.ง\.ด\.94/],
    ["law-revenue-code-extra", "มาตรา 71 ทวิ Transfer Pricing", /มาตรา 71 ทวิ|71 ทวิ/],
    ["law-revenue-code-extra", "มาตรา 84/1 ขอคืน VAT ภายใน 3 ปี", /มาตรา 84\/1|84\/1/],
    ["law-revenue-code-extra", "SBT อัตราโดยทั่วไป 3% (ม.91/6)", /ร้อยละ\s?3(\.0)?|(3|3\.0)\s?%|3(\.0)? เปอร์เซ็นต์/],
    // ---------- เฟส 6 (หมวด Q-T) ----------
    ["law-local-taxes", "LBT: ยกเว้นที่อยู่อาศัยหลัก 50 ล้านบาทแรก", /(50|ห้าสิบ|๕๐)\s?ล้านบาท/],
    ["law-local-taxes", "LBT: ยกเว้นเจ้าของเฉพาะสิ่งปลูกสร้าง 10 ล้านบาท", /(10|สิบ|๑๐)\s?ล้านบาท/],
    ["law-local-taxes", "LBT: ชำระภาษีภายในเดือนเมษายน (ม.46)", /เมษายน/],
    ["law-local-taxes", "ภาษีป้าย: อัตราต่อ 500 ตารางเซนติเมตร", /500\s?(ตารางเซนติเมตร|ตร\.ซม\.?)/],
    ["law-local-taxes", "ภาษีป้าย: มีอัตรา 10 บาท (อักษรไทยล้วน)", /(10|สิบ)\s?บาท/],
    ["law-excise-customs", "สรรพสามิต: ฐานราคาขาย ณ โรงอุตสาหกรรม", /ราคาขาย\s?(ณ|ที่)\s?โรง|โรงอุตสาหกรรม/],
    ["law-excise-customs", "ศุลกากร: ฐานภาษีราคา CIF", /CIF/],
    ["law-excise-customs", "ต้องมีกรมสรรพสามิต และ กรมศุลกากร", /สรรพสามิต[\s\S]{0,500}ศุลกากร/],
    ["law-civil-basics", "ป.พ.พ.: นิติบุคคล ม.65", /มาตรา 65|ม\.65/],
    ["law-civil-basics", "ป.พ.พ.: นิติกรรม ม.149", /มาตรา 149|ม\.149/],
    ["law-civil-basics", "ป.พ.พ.: ห้างหุ้นส่วนสามัญ ม.1012 / จำกัด ม.1077 / บริษัท ม.1096", /1012[\s\S]{0,300}1077[\s\S]{0,300}1096/],
    ["law-civil-basics", "ป.พ.พ.: มรดก ม.1599", /1599/],
    ["law-civil-basics", "ป.พ.พ.: มีทั้ง โมฆะ และ โมฆียะ", /โมฆะ[\s\S]{0,200}โมฆียะ/],
    ["law-criminal-basics", "ป.อาญา: โทษ 5 สถาน มีประหารชีวิต", /ประหารชีวิต[\s\S]{0,100}(จำคุก|กักขัง|ปรับ|ริบทรัพย์)/],
    ["law-criminal-basics", "ป.อาญา: ลักทรัพย์ ม.334", /มาตรา 334|ม\.334/],
    ["law-criminal-basics", "ป.อาญา: ฉ้อโกง ม.341", /มาตรา 341|ม\.341/],
    ["law-criminal-basics", "ป.อาญา: เจ้าพนักงานยักยอก ม.147 / เรียกรับ ม.149", /มาตรา 147|ม\.147[\s\S]{0,200}มาตรา 149|ม\.149/],
    ["law-criminal-basics", "คอมพิวเตอร์: ความผิดข้อมูลเท็จ ม.14", /มาตรา 14|ม\.14/],
    // ---------- เฟส 7 (หมวด U-W) ----------
    ["law-inheritance-tax", "มรดก: ฐานเก็บเฉพาะส่วนเกิน 100 ล้านบาท (ม.12)", /(100|หนึ่งร้อย|๑๐๐)\s?ล้านบาท/],
    ["law-inheritance-tax", "มรดก: อัตรา 5% (ผู้สืบสันดาน/บุพการี ม.16)", /(ร้อยละ\s?5|5\s?%|5\.0\s?%)/],
    ["law-inheritance-tax", "มรดก: อัตรา 10% (บุคคลอื่น ม.16)", /(ร้อยละ\s?10|10\s?%|10\.0\s?%)/],
    ["law-inheritance-tax", "มรดก: คู่สมรสของเจ้ามรดกไม่ต้องเสีย (ม.3(2)) — ห้ามเขียน 50 ล้าน", null, (t) => {
      const all = JSON.stringify(t.sections || []) + JSON.stringify(t.statutes || []);
      if (!/คู่สมรส/.test(all)) return true; // ไม่พูดถึงคู่สมรสเลย -> ข้าม
      const hasExempt = /คู่สมรส[\s\S]{0,350}(ไม่ต้องเสีย|ไม่ต้องชำระ|ไม่ใช้บังคับ|ยกเว้น|ได้รับยกเว้น)/.test(all);
      const has50m = /คู่สมรส[\s\S]{0,150}(50|ห้าสิบ)\s?ล้าน/.test(all);
      return hasExempt && !has50m;
    }],
    ["law-inheritance-tax", "มรดก: ยื่นแบบ/ชำระภายใน 150 วัน (ม.17)", /150\s?วัน|หนึ่งร้อยห้าสิบ/],
    ["law-etax-invoice", "e-Tax: ใบกำกับภาษีอิเล็กทรอนิกส์ตาม ม.86/4", /มาตรา 86\/4|ม\.86\/4/],
    ["law-etax-invoice", "e-Tax: ลายมือชื่อดิจิทัล (Digital Signature) หรือ ประทับเวลา (Time Stamp)", /(ลายมือชื่อดิจิทัล|Digital Signature)[\s\S]{0,100}(Time Stamp|ประทับเวลา)/],
    ["law-etax-invoice", "e-Tax: e-Receipt = ใบรับตาม ม.105 ทวิ", /105\s?ทวิ|มาตรา 105/],
    ["law-etax-invoice", "e-Tax: มี พ.ร.บ.ฉบับที่ 53/2564 หรือ กฎกระทรวง 384/2565", /(ฉบับที่\s?53|53\/2564|384)/],
    ["revenue-pit-section40", "ม.40(3): หัก 50% ไม่เกิน 100,000 (กับดัก: ไม่ใช่ 40%/60,000)", /40\s?\(3\)[\s\S]{0,900}(50%|ร้อยละ 50)[\s\S]{0,200}(100,000|หนึ่งแสน|๑๐๐,๐๐๐)/],
    ["revenue-pit-section40", "ม.40(7): หัก 60% (กับดัก: ไม่ใช่ 70%)", /40\s?\(7\)[\s\S]{0,900}(60%|ร้อยละ 60)/],
    ["revenue-pit-section40", "ม.40(8): หัก 60% ไม่เกิน 600,000", /40\s?\(8\)[\s\S]{0,900}(60%|ร้อยละ 60)[\s\S]{0,200}(600,000|หกแสน|๖๐๐,๐๐๐)/],
    ["revenue-pit-section40", "ม.40(5): บ้าน/โรงเรือน/แพ หัก 30%", /40\s?\(5\)[\s\S]{0,900}(30%|ร้อยละ 30)/],
    ["revenue-pit-section40", "ม.40(6): เวชกรรม/ประกอบโรคศิลปะ หัก 60%", /(เวชกรรม|ประกอบโรคศิลปะ)[\s\S]{0,200}(60%|ร้อยละ 60)/],
    // ---------- เฟส 8 (หมวด X-Z จากหนังสือนักวิชาการสรรพากร) ----------
    ["revenue-dept-strategy", "ยุทธศาสตร์: ต้องมี OneRD", /OneRD/],
    ["revenue-dept-strategy", "ยุทธศาสตร์: ต้องมี Zero Tax Gap", /Zero Tax Gap/],
    ["revenue-dept-strategy", "ยุทธศาสตร์: ต้องมี SMILE RD", /SMILE RD/],
    ["revenue-dept-strategy", "ยุทธศาสตร์: พันธกิจย่อ 'จัดเก็บภาษีตรงเป้า นโยบายตรงกลุ่ม บริการตรงใจ'", /จัดเก็บภาษีตรงเป้า[\s\S]{0,50}นโยบายตรงกลุ่ม[\s\S]{0,50}บริการตรงใจ/],
    ["revenue-dept-strategy", "ยุทธศาสตร์: ค่านิยม I AM RD", /I AM RD/],
    ["revenue-dept-strategy", "ยุทธศาสตร์: Zero Tax Gap Ambition ปี 2570", /Zero Tax Gap Ambition[\s\S]{0,300}(2570|2\s?570|ปี 2570)/],
    ["law-pit-exempt42", "เงินชดเชยเลิกจ้าง 600,000 = กฎกระทรวง 394/2567 ตาม ม.42(17) (ไม่มี ม.42(24) ในกฎหมายปัจจุบัน)", /600,000[\s\S]{0,300}(394|กฎกระทรวง)[\s\S]{0,300}42\s?\(17\)/],
    ["law-pit-exempt42", "เงินชดเชยเกษียณอายุไม่ได้รับยกเว้น (ต้องเสียเต็มจำนวน)", /เกษียณ[\s\S]{0,300}ไม่ได้รับยกเว้น/],
    ["law-pit-exempt42", "ผู้สูงอายุ 65 ปี ยกเว้น 190,000 (พ.ร.ฎ. 470/2551 — ไม่ใช่ ม.42)", /(65|หกสิบห้า)[\s\S]{0,500}(190,000|หนึ่งแสนเก้าหมื่น)[\s\S]{0,300}(470|พ\.ร\.ฎ\.)/],
    ["law-pit-exempt42", "ม.42(26): โอนให้บุตรชอบด้วยกฎหมาย ไม่เกิน 20 ล้าน (ไม่รวมบุตรบุญธรรม)", /\(26\)[\s\S]{0,900}(ไม่รวม|ไม่ใช่)บุตรบุญธรรม[\s\S]{0,300}(20|ยี่สิบ)[\s\S]{0,200}ล้าน/],
    ["law-pit-exempt42", "ม.42(28): ให้โดยเสน่หาเนื่องในพิธีจากบุคคลอื่น ไม่เกิน 10 ล้าน", /\(28\)[\s\S]{0,900}(10|สิบ)[\s\S]{0,200}ล้าน/],
    ["revenue-pit-expense43", "43 รายการ: ต้องมีตารางครบ 43 ข้อ (เห็นข้อ 43 = ขายเรือกำปั่น)", /43[\s\S]{0,200}ขายเรือกำปั่น/],
    ["revenue-pit-expense43", "43 รายการ: นักแสดงสาธารณะ 60%/40% รวมไม่เกิน 600,000", /(60%|ร้อยละ 60)[\s\S]{0,400}(40%|ร้อยละ 40)[\s\S]{0,400}(600,000|หกแสน)/],
    ["revenue-pit-expense43", "43 รายการ: นอก 43 รายการต้องหักตามจริง", /(นอก|ไม่เข้าข่าย|ไม่ใช่ 43)[\s\S]{0,300}(ตามจริง|ความจำเป็นและสมควร)/],
    ["revenue-pit-expense43", "43 รายการ: นักแสดงสาธารณะไม่รวมผู้ประกาศข่าว/โฆษก/พิธีกร", /(ผู้ประกาศข่าว|โฆษก|พิธีกร)[\s\S]{0,100}(ไม่รวม|ไม่ถือ)/],
  ];
  contentGuards.forEach((g) => {
    const [tid, label, re, fn] = g;
    const json = topicById[tid];
    if (!json) return;
    const ok = fn ? fn(JSON.parse(json)) : re.test(json);
    if (!ok) issues.push(`GUARD (${tid}): ${label}`);
  });

  // ---------- 7. หมวดเฟส 3-5 ที่คาดหวัง (ถ้ายังไม่มา -> warning ไม่ใช่ error) ----------
  const expected = [
    ["accounting-basics", "หมวด G หลักการบัญชี"],
    ["law-official-info", "หมวด H ข้อมูลข่าวสาร 2540"],
    ["law-pdpa", "หมวด I PDPA"],
    ["reg-office-doc", "หมวด J สารบรรณ"],
    ["law-civil-service", "หมวด K ข้าราชการพลเรือน/ปกครอง"],
    ["revenue-dept-info", "หมวด L กรมสรรพากร"],
    ["quiz-set-5", "โจทย์ชุด 5 (เบี้ยปรับ/เงินเพิ่ม/อุทธรณ์)"],
    ["quiz-set-6", "โจทย์ชุด 6 (บัญชี)"],
    ["quiz-set-7", "โจทย์ชุด 7 (อำนาจเจ้าพนักงาน/หัก ณ ที่จ่าย)"],
    ["quiz-set-8", "โจทย์ชุด 8 (PDPA/ข้อมูลข่าวสาร/สารบรรณ)"],
    ["law-procurement", "หมวด M จัดซื้อจัดจ้าง 2560"],
    ["law-state-admin", "หมวด N บริหารราชการแผ่นดิน 2534"],
    ["law-fiscal-discipline", "หมวด O วินัยการเงินการคลัง 2561"],
    ["law-revenue-code-extra", "หมวด P มาตราเสริมประมวลรัษฎากร"],
    ["quiz-set-9", "โจทย์ชุด 9 (จัดซื้อจัดจ้าง 2560)"],
    ["quiz-set-10", "โจทย์ชุด 10 (บริหารราชการแผ่นดิน 2534)"],
    ["quiz-set-11", "โจทย์ชุด 11 (วินัยการเงินการคลัง 2561)"],
    ["quiz-set-12", "โจทย์ชุด 12 (มาตราเสริมประมวลรัษฎากร)"],
    ["quiz-set-13", "โจทย์ชุด 13 (เก็งประมวลรัษฎากรรวม)"],
    ["quiz-set-14", "โจทย์ชุด 14 (เก็งกฎหมายประกอบรวม)"],
    ["quiz-set-15", "โจทย์ชุด 15 (เก็งบัญชี+กรมสรรพากร)"],
    ["quiz-set-16", "โจทย์ชุด 16 (ข้อสอบรวมทุกหมวด)"],
    ["law-local-taxes", "หมวด Q ภาษีท้องถิ่น (ที่ดินและสิ่งปลูกสร้าง/ภาษีป้าย)"],
    ["law-excise-customs", "หมวด R สรรพสามิต/ศุลกากร"],
    ["law-civil-basics", "หมวด S ป.พ.พ. เบื้องต้น"],
    ["law-criminal-basics", "หมวด T ป.อาญา/คอมพิวเตอร์"],
    ["quiz-set-17", "โจทย์ชุด 17 (ที่ดินและสิ่งปลูกสร้าง/ภาษีป้าย)"],
    ["quiz-set-18", "โจทย์ชุด 18 (สรรพสามิต/ศุลกากร)"],
    ["quiz-set-19", "โจทย์ชุด 19 (ป.พ.พ. เบื้องต้น)"],
    ["quiz-set-20", "โจทย์ชุด 20 (ป.อาญา/คอมพิวเตอร์)"],
    ["quiz-set-21", "โจทย์ชุด 21 (เก็งประมวลรัษฎากรรวม ชุด 2)"],
    ["quiz-set-22", "โจทย์ชุด 22 (เก็งภาษีอื่น ๆ รวม)"],
    ["quiz-set-23", "โจทย์ชุด 23 (เก็งกฎหมายราชการรวม ชุด 2)"],
    ["quiz-set-24", "โจทย์ชุด 24 (ข้อสอบรวมทุกหมวด เฟส 6)"],
    ["law-inheritance-tax", "หมวด U ภาษีการรับมรดก 2558"],
    ["law-etax-invoice", "หมวด V e-Tax Invoice / e-Receipt"],
    ["revenue-pit-section40", "หมวด W มาตรา 40(1)-(8) ครบชุด + ตารางค่าใช้จ่าย"],
    ["quiz-set-25", "โจทย์ชุด 25 (คำนวณภาษีเงินได้บุคคลธรรมดา)"],
    ["quiz-set-26", "โจทย์ชุด 26 (คำนวณ VAT/ภาษีซื้อต้องห้าม)"],
    ["quiz-set-27", "โจทย์ชุด 27 (คำนวณ CIT/หัก ณ ที่จ่าย/เงินเพิ่ม-เบี้ยปรับ)"],
    ["quiz-set-28", "โจทย์ชุด 28 (ภาษีการรับมรดก/e-Tax Invoice)"],
    ["quiz-set-29", "โจทย์ชุด 29 (คำนวณที่ดิน/ป้าย/อากรแสตมป์/SBT)"],
    ["quiz-set-30", "โจทย์ชุด 30 (ข้อสอบรวมทุกหมวด 100% เฟส 7)"],
    ["revenue-dept-strategy", "หมวด X ยุทธศาสตร์กรมสรรพากร (OneRD/Zero Tax Gap/SMILE RD)"],
    ["law-pit-exempt42", "หมวด Y เงินได้ที่ได้รับยกเว้น ม.42 ครบชุด"],
    ["revenue-pit-expense43", "หมวด Z ค่าใช้จ่ายเหมา 43 รายการ ม.40(8)"],
    ["quiz-set-31", "โจทย์ชุด 31 (ยุทธศาสตร์กรมสรรพากร OneRD/SMILE RD)"],
    ["quiz-set-32", "โจทย์ชุด 32 (เงินได้ที่ได้รับยกเว้น ม.42)"],
    ["quiz-set-33", "โจทย์ชุด 33 (ค่าใช้จ่ายเหมา 43 รายการ)"],
    ["quiz-set-34", "โจทย์ชุด 34 (ข้อสอบรวมทุกหมวด เฟส 8 ปิดท้าย)"],
  ];
  expected.forEach(([id, name]) => {
    if (!ids.has(id)) warnings.push(`ยังไม่มี: ${name} (id: ${id})`);
  });

  // ---------- 8. จำนวนโจทย์รวม ----------
  const totalQuiz = KB.reduce((s, t) => s + (t.quiz ? t.quiz.length : 0), 0);
  const totalStat = KB.reduce((s, t) => s + (t.statutes ? t.statutes.length : 0), 0);
  console.log(`Topics: ${KB.length} | Quiz รวม: ${totalQuiz} ข้อ | Statutes: ${totalStat}`);
  if (totalQuiz < 194) warnings.push(`โจทย์รวมยังไม่ครบ 194 ข้อ (เป้าหมายเฟส 7 — ตอนนี้ ${totalQuiz})`);

  // ---------- 9. markdown `**` / `:**` ในเนื้อหา (ไม่นับคอมเมนต์หัวไฟล์) ----------
  const body = KB_SRC.replace(/^\/\*[\s\S]*?\*\//, "");
  const md = body.match(/\*\*/g);
  if (md) issues.push(`พบ '**' markdown ${md.length} จุดในเนื้อหา (ต้องใช้ <strong>)`);
  const colon = body.match(/:\*\*/g);
  if (colon) issues.push(`พบ ':**' ${colon.length} จุดในเนื้อหา`);
}

// ---------- 10. เส้นทางการเรียนรู้ 0-100 (LEARNING_PATH) ----------
let LP = [];
try {
  LP = new Function(KB_SRC + "; return LEARNING_PATH;")();
} catch (e) {
  issues.push("โหลด LEARNING_PATH ไม่ได้: " + e.message);
}
if (LP.length) {
  const kbIds = new Set(KB.map((t) => t.id));
  const lpIds = LP.map((p) => p.id);
  const dupes = lpIds.filter((id, i) => lpIds.indexOf(id) !== i);
  if (dupes.length) issues.push("LEARNING_PATH: id ซ้ำ -> " + [...new Set(dupes)].join(", "));
  const missing = lpIds.filter((id) => !kbIds.has(id));
  if (missing.length) issues.push("LEARNING_PATH: id ไม่อยู่ใน KNOWLEDGE_BASE -> " + missing.join(", "));
  const notInPath = [...kbIds].filter((id) => !lpIds.includes(id));
  if (notInPath.length) issues.push("LEARNING_PATH: หัวข้อไม่ได้อยู่ในเส้นทาง -> " + notInPath.join(", "));
  LP.forEach((p, i) => {
    if (typeof p.difficulty !== "number" || p.difficulty < 0 || p.difficulty > 100)
      issues.push("LEARNING_PATH step " + (i + 1) + " (" + p.id + "): difficulty ต้องเป็น 0-100");
    if (!p.stage) issues.push("LEARNING_PATH step " + (i + 1) + " (" + p.id + "): ไม่มี stage");
    if (i > 0 && p.difficulty < LP[i - 1].difficulty)
      issues.push("LEARNING_PATH step " + (i + 1) + " (" + p.id + "): difficulty ลดลง (" + LP[i - 1].difficulty + " -> " + p.difficulty + ") — ต้องเรียงยากขึ้นเท่านั้น");
  });
  console.log("LEARNING_PATH: " + LP.length + " ขั้น (0-100 เรียงจากง่ายไปยาก)");
}

// ---------- สรุป ----------
console.log("--------------------------------");
if (warnings.length) {
  console.log(`⚠ WARNINGS (${warnings.length}):`);
  warnings.forEach((w) => console.log("  - " + w));
}
if (issues.length) {
  console.log(`❌ ISSUES (${issues.length}):`);
  issues.forEach((i) => console.log("  - " + i));
  console.log("=> QA FAIL");
  process.exit(1);
}
console.log("=> QA PASS ✅");
