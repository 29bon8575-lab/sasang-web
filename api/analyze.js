// ════════════════════════════════════════════════════════════════════════
//  干支體質論 체질감별 엔진 (서버 전용 · IP 은닉)
//  ─ 이 파일은 Vercel 서버에서만 실행됩니다. 브라우저로 전송되지 않습니다.
//  ─ 알고리즘 출처: 황교헌 원장 干支體質論 (신라한의원)
//  ─ 천문 계산: Jean Meeus 알고리즘 기반, KST 보정
// ════════════════════════════════════════════════════════════════════════

const heavenlyStems   = ['갑','을','병','정','무','기','경','신','임','계'];
const earthlyBranches = ['자','축','인','묘','진','사','오','미','신','유','술','해'];

const stemHanja = {
  '갑':'甲','을':'乙','병':'丙','정':'丁','무':'戊',
  '기':'己','경':'庚','신':'辛','임':'壬','계':'癸'
};
const branchHanja = {
  '자':'子','축':'丑','인':'寅','묘':'卯','진':'辰','사':'巳',
  '오':'午','미':'未','신':'申','유':'酉','술':'戌','해':'亥'
};

const stemElement = {
  '갑':'목','을':'목','병':'화','정':'화','무':'토',
  '기':'토','경':'금','신':'금','임':'수','계':'수'
};

// ⭐ 미·술은 相火(상화) → 화로 처리
const branchElement = {
  '자':'수','축':'토','인':'목','묘':'목','진':'토','사':'화',
  '오':'화','미':'화','신':'금','유':'금','술':'화','해':'수'
};

// ─── 천문 계산 (Jean Meeus 기반, KST) ──────────────────────────────────────
const _R = Math.PI / 180;

const g2jd = (y, m, d) => {
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y/100), B = 2 - A + Math.floor(A/4);
  return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + d + B - 1524.5;
};

const jd2g = jd => {
  const z = Math.floor(jd + 0.5);
  const al = Math.floor((z - 1867216.25)/36524.25);
  const a  = z >= 2299161 ? z + 1 + al - Math.floor(al/4) : z;
  const b  = a + 1524, c = Math.floor((b - 122.1)/365.25);
  const d  = Math.floor(365.25*c), e = Math.floor((b - d)/30.6001);
  const day   = b - d - Math.floor(30.6001*e);
  const month = e < 14 ? e - 1 : e - 13;
  return { year: month > 2 ? c - 4716 : c - 4715, month, day };
};

const _newMoon = k => {
  const T = k/1236.85, T2 = T*T, T3 = T2*T;
  let j = 2451550.09766 + 29.530588861*k + 0.00015437*T2 - 0.00000015*T3;
  const M  = _R*(2.5534   + 29.10535669*k  - 0.0000218*T2);
  const M1 = _R*(201.5643 + 385.81693528*k + 0.0107438*T2);
  const F  = _R*(160.7108 + 390.67050274*k - 0.0016341*T2);
  const O  = _R*(124.7746 - 1.56375580*k   + 0.0020691*T2);
  j += -.40720*Math.sin(M1) + .17241*Math.sin(M)  + .01608*Math.sin(2*M1)
     + .01039*Math.sin(2*F) + .00739*Math.sin(M1-M) - .00514*Math.sin(M1+M)
     + .00208*Math.sin(2*M) - .00111*Math.sin(M1-2*F) - .00057*Math.sin(M1+2*F)
     + .00056*Math.sin(2*M1+M) - .00042*Math.sin(3*M1) + .00042*Math.sin(M+2*F)
     + .00038*Math.sin(M-2*F) - .00024*Math.sin(2*M1-M) - .00017*Math.sin(O);
  return j + 9/24; // KST 보정
};

// KST 자정 기준 새달 정수일
const _newMoonDay = k => Math.floor(_newMoon(k) + 0.5);

const _kFor = jd => {
  let k = Math.round((jd - 2451550.09766)/29.530588861);
  while (_newMoonDay(k)   > Math.floor(jd + 0.5)) k--;
  while (_newMoonDay(k+1) <= Math.floor(jd + 0.5)) k++;
  return k;
};

const _sunLon = jd => {
  const T = (jd - 9/24 - 2451545)/36525, T2 = T*T;
  let L = 280.46646 + 36000.76983*T + 0.0003032*T2;
  const M = _R*(357.52911 + 35999.05029*T - 0.0001537*T2);
  L += (1.914602 - .004817*T - .000014*T2)*Math.sin(M)
     + (.019993  - .000101*T)*Math.sin(2*M)
     + .000289*Math.sin(3*M)
     - 0.00569 - 0.00478*Math.sin(_R*(125.04 - 1934.136*T));
  return ((L % 360) + 360) % 360;
};

const _findSunLon = (targetLon, startJD) => {
  let jd = startJD;
  for (let i = 0; i < 50; i++) {
    const delta = ((targetLon - _sunLon(jd) + 540) % 360) - 180;
    jd += delta/360 * 365.25;
    if (Math.abs(delta) < 0.0001) break;
  }
  return jd;
};

const _getZhongqi = k => {
  const ls = _sunLon(_newMoon(k)), le = _sunLon(_newMoon(k+1));
  const n1 = Math.floor(ls/30);
  const n2 = le >= ls ? Math.floor(le/30) : Math.floor(le/30) + 12;
  return n2 > n1 ? ((n1+1)*30) % 360 : -1;
};

// 음력 11/12월 연도 해석 (정통 음력 표기법)
const _findMonthK = (lunarYear, lunarMonth) => {
  const zqLon = lunarMonth === 1 ? 330 : (lunarMonth - 2)*30;
  let gYear = lunarYear, gMonth;
  if      (lunarMonth === 11) { gMonth = 12; }
  else if (lunarMonth === 12) { gYear = lunarYear + 1; gMonth = 1; }
  else                        { gMonth = lunarMonth + 1; }
  const zqJD = _findSunLon(zqLon, g2jd(gYear, gMonth, 15) - 30);
  return _kFor(zqJD);
};

const lunarToGreg = (ly, lm, ld, isLeap) => {
  try {
    const k = _findMonthK(ly, lm);
    let targetK = k;
    if (isLeap) {
      if (_getZhongqi(k+1) === -1) targetK = k + 1;
      else return null;
    }
    const days = Math.round(_newMoon(targetK+1) - _newMoon(targetK));
    if (ld < 1 || ld > days) return null;
    return jd2g(_newMoonDay(targetK) + ld - 1);
  } catch { return null; }
};

// ─── 절기 데이터 ──────────────────────────────────────────────────────────
const JIEQI = [
  { lon: 315, idx: 2,  name: '입춘' },
  { lon: 345, idx: 3,  name: '경칩' },
  { lon: 15,  idx: 4,  name: '청명' },
  { lon: 45,  idx: 5,  name: '입하' },
  { lon: 75,  idx: 6,  name: '망종' },
  { lon: 105, idx: 7,  name: '소서' },
  { lon: 135, idx: 8,  name: '입추' },
  { lon: 165, idx: 9,  name: '백로' },
  { lon: 195, idx: 10, name: '한로' },
  { lon: 225, idx: 11, name: '입동' },
  { lon: 255, idx: 0,  name: '대설' },
  { lon: 285, idx: 1,  name: '소한' },
];

const _getIpchunJD = year => _findSunLon(315, g2jd(year, 1, 15) - 30);

const _getEffectiveYear = (year, month, day) => {
  const birthJD = g2jd(year, month, day);
  const ipchunJD = _getIpchunJD(year);
  return birthJD < ipchunJD ? year - 1 : year;
};

const _getIpchunDate = year => jd2g(_getIpchunJD(year));

const getMonthBranchByJieqi = (year, month, day) => {
  const jd = g2jd(year, month, day);
  const curLon = _sunLon(jd);

  const lonShifted = ((curLon - 15) % 360 + 360) % 360;
  let lastLon = (Math.floor(lonShifted/30) * 30 + 15) % 360;

  let lastJD = _findSunLon(lastLon, jd - 60);
  if (lastJD > jd + 0.5) {
    lastLon = (lastLon - 30 + 360) % 360;
    lastJD = _findSunLon(lastLon, jd - 90);
  }

  const nextLon = (lastLon + 30) % 360;
  const nextJD  = _findSunLon(nextLon, lastJD + 15);

  const cur  = JIEQI.find(j => j.lon === lastLon);
  const next = JIEQI.find(j => j.lon === nextLon);

  return {
    branchIdx: cur.idx,
    branch:    earthlyBranches[cur.idx],
    jieqi:     cur.name,
    jieqiDate: jd2g(lastJD),
    nextJieqi: next.name,
    nextDate:  jd2g(nextJD),
  };
};

// ─── 간지 계산 ────────────────────────────────────────────────────────────
const _yearGanjiOf = effYear => {
  const baseYear = 1984; // 갑자년
  const si = ((effYear - baseYear) % 10 + 10) % 10;
  const bi = ((effYear - baseYear) % 12 + 12) % 12;
  return { stem: heavenlyStems[si], branch: earthlyBranches[bi] };
};

const _calcMonthGanji = (year, month, day, yearStem) => {
  const jieqi = getMonthBranchByJieqi(year, month, day);
  const ySI = heavenlyStems.indexOf(yearStem);
  const monthNum = ((jieqi.branchIdx - 2 + 12) % 12) + 1;
  const monthStemStart = (ySI % 5) * 2 + 2;
  const stemIndex = (monthStemStart + monthNum - 1) % 10;
  return {
    stem: heavenlyStems[stemIndex],
    branch: jieqi.branch,
    _jieqi: jieqi,
  };
};

const _calcDayGanji = (year, month, day) => {
  const baseDate   = new Date(Date.UTC(1900, 0, 1));
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const diffDays = Math.round((targetDate - baseDate) / 86400000);
  const stemIndex   = ((diffDays % 10) + 10) % 10;
  const branchIndex = ((diffDays + 10) % 12 + 12) % 12;
  return { stem: heavenlyStems[stemIndex], branch: earthlyBranches[branchIndex] };
};

// ─── 체질 판정 (자리강도 max 기반) ────────────────────────────────────────
const _determineConstitution = g => {
  const positions = [
    { kind:'stem',   value:g.year.stem,    strength:1, label:'년간' },
    { kind:'stem',   value:g.month.stem,   strength:2, label:'월간' },
    { kind:'stem',   value:g.day.stem,     strength:4, label:'일간' },
    { kind:'branch', value:g.year.branch,  strength:4, label:'년지' },
    { kind:'branch', value:g.month.branch, strength:5, label:'월지' },
    { kind:'branch', value:g.day.branch,   strength:6, label:'일지' },
  ];

  const harmonyPos = positions.filter(p => p.kind === 'branch' && ['미','술'].includes(p.value));
  const maxH = harmonyPos.length === 0 ? 0 : Math.max(...harmonyPos.map(p => p.strength));

  const firePos = positions.filter(p => p.kind === 'stem' && ['병','정'].includes(p.value));
  const maxF = firePos.length === 0 ? 0 : Math.max(...firePos.map(p => p.strength));

  const maxOf = element => {
    const matches = positions.filter(p => {
      const e = p.kind === 'stem' ? stemElement[p.value] : branchElement[p.value];
      return e === element;
    });
    return matches.length === 0 ? 0 : Math.max(...matches.map(p => p.strength));
  };

  const maxMetal = maxOf('금');
  const maxWater = maxOf('수');
  const maxEarth = maxOf('토');
  const maxWood  = maxOf('목');

  // 자리강도 순위 시각화용 (판정 로직과 무관 · 표시 전용)
  const _elOf = p => p.kind === 'stem' ? stemElement[p.value] : branchElement[p.value];
  const ranked = positions
    .slice()
    .sort((a, b) => b.strength - a.strength)
    .map(p => ({
      label: p.label,
      value: p.value,
      kind: p.kind,
      strength: p.strength,
      element: ['미','술'].includes(p.value) && p.kind === 'branch' ? '相' : _elOf(p),
    }));

  const trace = { maxH, maxF, maxMetal, maxWater, maxEarth, maxWood, ranked };

  const decideHarmony = () => {
    if (maxMetal === 0 && maxWater === 0) {
      return { result:'태양인', note:'금·수 없음 → 오행제어상 태양인 (Q2)' };
    }
    return {
      result: maxMetal >= maxWater ? '태양인' : '소음인',
      note: `금(${maxMetal}) vs 수(${maxWater})`
    };
  };

  const decideFire = () => {
    if (maxEarth === 0 && maxWood === 0) {
      return { result:'소양인', note:'토·목 없음 → 기본 소양인 (Q3)' };
    }
    return {
      result: maxEarth >= maxWood ? '소양인' : '태음인',
      note: `토(${maxEarth}) vs 목(${maxWood})`
    };
  };

  const decideByFourElements = () => {
    const cands = [
      { name:'태양인', score:maxMetal, el:'금' },
      { name:'소음인', score:maxWater, el:'수' },
      { name:'소양인', score:maxEarth, el:'토' },
      { name:'태음인', score:maxWood,  el:'목' },
    ].sort((a,b) => b.score - a.score);
    if (cands[0].score === 0) return { result:'태양인', note:'4오행 모두 0 → 태양인' };
    return { result:cands[0].name, note:`${cands[0].el}(${cands[0].score}) 우세` };
  };

  let branch, decision;
  if (maxH === 0 && maxF === 0) {
    branch = '和·火 모두 없음 → 火 상정 (Q1)';
    decision = decideFire();
  } else if (maxH > 0 && maxF === 0) {
    branch = '和만 있음';
    decision = decideHarmony();
  } else if (maxH === 0 && maxF > 0) {
    branch = '火만 있음';
    decision = decideFire();
  } else if (maxH > maxF) {
    branch = `和(${maxH}) > 火(${maxF}) → 和 분기`;
    decision = decideHarmony();
  } else if (maxH < maxF) {
    branch = `和(${maxH}) < 火(${maxF}) → 火 분기`;
    decision = decideFire();
  } else {
    branch = `和=火=${maxH} 동률 → 4오행 max 비교 (Q5)`;
    decision = decideByFourElements();
  }

  return { result:decision.result, trace, branch, note:decision.note };
};

// ─── P3 경계 사례 margin 계산 ─────────────────────────────────────────────
const _computeMargin = trace => {
  const { maxH, maxF, maxMetal, maxWater, maxEarth, maxWood } = trace;
  if (maxH === 0 && maxF === 0)       return Math.abs(maxEarth - maxWood);
  if (maxH > 0  && maxF === 0)        return Math.abs(maxMetal - maxWater);
  if (maxH === 0 && maxF > 0)         return Math.abs(maxEarth - maxWood);
  if (maxH > maxF)                    return Math.abs(maxMetal - maxWater);
  if (maxH < maxF)                    return Math.abs(maxEarth - maxWood);
  const sorted = [maxMetal, maxWater, maxEarth, maxWood].sort((a,b) => b - a);
  return Math.abs(sorted[0] - sorted[1]);
};

// ─── 통합 분석 (입춘 기준 + 양력 기준 동시) ─────────────────────────────
const _analyzeBoth = (year, month, day) => {
  const yY_ip = _getEffectiveYear(year, month, day);
  const yearG_ip = _yearGanjiOf(yY_ip);
  const monthG_ip = _calcMonthGanji(year, month, day, yearG_ip.stem);
  const dayG = _calcDayGanji(year, month, day);

  const ganji_ip = {
    year: yearG_ip,
    month: { stem: monthG_ip.stem, branch: monthG_ip.branch },
    day: dayG
  };
  const r_ip = _determineConstitution(ganji_ip);

  const yearG_sol = _yearGanjiOf(year);
  const monthG_sol = _calcMonthGanji(year, month, day, yearG_sol.stem);
  const ganji_sol = {
    year: yearG_sol,
    month: { stem: monthG_sol.stem, branch: monthG_sol.branch },
    day: dayG
  };
  const r_sol = _determineConstitution(ganji_sol);

  const isBoundary = r_ip.result !== r_sol.result;

  let percentages = null;
  if (isBoundary) {
    const m_ip  = _computeMargin(r_ip.trace);
    const m_sol = _computeMargin(r_sol.trace);
    const adj = Math.max(-15, Math.min(15, (m_ip - m_sol) * 3));
    percentages = {
      ip:  60 + adj,
      sol: 40 - adj,
      margin_ip:  m_ip,
      margin_sol: m_sol,
      adj
    };
  }

  return {
    primary:   { ganji: ganji_ip,  constitution: r_ip,  effectiveYear: yY_ip },
    alternate: { ganji: ganji_sol, constitution: r_sol, effectiveYear: year },
    jieqiInfo: monthG_ip._jieqi,
    ipchunDate: _getIpchunDate(year),
    isBoundary,
    percentages,
  };
};

// 간지에 한자 부착 (표시용)
const decorate = g => ({
  stem: g.stem, branch: g.branch,
  stemHanja: stemHanja[g.stem], branchHanja: branchHanja[g.branch],
});

// ════════════════════════════════════════════════════════════════════════
//  Vercel Serverless Function 엔트리포인트
// ════════════════════════════════════════════════════════════════════════
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 허용됩니다.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    let { calType, year, month, day, isLeap } = body || {};

    year = parseInt(year, 10);
    month = parseInt(month, 10);
    day = parseInt(day, 10);

    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      return res.status(400).json({ error: '생년월일을 올바르게 입력해주세요.' });
    }

    let solarY = year, solarM = month, solarD = day;
    let convertedFrom = null;

    // 음력 입력 시 양력 변환
    if (calType === 'lunar') {
      const conv = lunarToGreg(year, month, day, !!isLeap);
      if (!conv) {
        return res.status(400).json({ error: '존재하지 않는 음력 날짜입니다. (윤달 여부·일자를 확인해주세요)' });
      }
      convertedFrom = { year, month, day, isLeap: !!isLeap };
      solarY = conv.year; solarM = conv.month; solarD = conv.day;
    }

    const a = _analyzeBoth(solarY, solarM, solarD);

    // 응답: 알고리즘 내부값은 최소화, 표시에 필요한 결과만
    const pack = (side) => ({
      constitution: side.constitution.result,
      effectiveYear: side.effectiveYear,
      ganji: {
        year:  decorate(side.ganji.year),
        month: decorate(side.ganji.month),
        day:   decorate(side.ganji.day),
      },
      branch: side.constitution.branch,
      note: side.constitution.note,
      ranked: side.constitution.trace.ranked,
    });

    return res.status(200).json({
      ok: true,
      input: {
        calType,
        solar: { year: solarY, month: solarM, day: solarD },
        convertedFrom,
      },
      primary: pack(a.primary),
      alternate: pack(a.alternate),
      isBoundary: a.isBoundary,
      percentages: a.percentages,
      jieqi: a.jieqiInfo ? {
        name: a.jieqiInfo.jieqi,
        date: a.jieqiInfo.jieqiDate,
        next: a.jieqiInfo.nextJieqi,
        nextDate: a.jieqiInfo.nextDate,
      } : null,
      ipchunDate: a.ipchunDate,
    });
  } catch (e) {
    return res.status(500).json({ error: '분석 중 오류가 발생했습니다.', detail: String(e && e.message || e) });
  }
}
