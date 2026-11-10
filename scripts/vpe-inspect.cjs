#!/usr/bin/env node
'use strict';
// Read-only VPE lifecycle inspector: compares live Supabase reservations, willingness,
// meeting info, and local programmes/people/appointments against NUSA TMC's meeting calendar.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const people = require('./people.js');
const meetingsStore = require('./meeting-programmes.js');
const programme = require('./programme.js');
const recommend = require('./recommend.js');
globalThis.ToastFlow = recommend;
const appointments = require('./appointments.js');
const visitingPool = require('../data/visiting-toastmasters.json');
const membersPublic = require('../data/members.public.json');
const pathwaysPublic = require('../data/member-pathways.public.json');

function readIndexConfig() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const url = (html.match(/name="supabase-url"\s+content="([^"]+)"/) || [])[1] || '';
  const key = (html.match(/name="supabase-anon-key"\s+content="([^"]+)"/) || [])[1] || '';
  const meetingsBlock = (html.match(/const meetings\s*=\s*(\[[\s\S]*?\]);/) || [])[1];
  const meetings = meetingsBlock ? vm.runInNewContext(meetingsBlock) : [];
  return { url, key, meetings };
}

function sgToday(override) {
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date());
}

function dayDiff(fromYmd, toYmd) {
  const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function phaseFor(daysUntilNext, daysSincePrev) {
  const stages = [];
  if (daysSincePrev != null && daysSincePrev >= 1 && daysSincePrev <= 9) stages.push('T_PLUS_7');
  if (daysUntilNext != null && daysUntilNext >= 10 && daysUntilNext <= 17) stages.push('T_MINUS_14');
  if (daysUntilNext != null && daysUntilNext >= 4 && daysUntilNext <= 9) stages.push('T_MINUS_7');
  if (daysUntilNext != null && daysUntilNext >= 0 && daysUntilNext <= 3) stages.push('T_MINUS_FINAL');
  if (!stages.length) stages.push('MID_MONTH');
  return stages;
}

const STAGE_LABELS = {
  T_PLUS_7: '会后一周 (T+1w) · 归档复盘与月度更新',
  T_MINUS_14: '会前两周 (T-2w) · Speech Slots 与全员确认统筹',
  T_MINUS_7: '会前一周 (T-1w) · 分角色跟进、TME/Speaker/Guest/SAA 指南下发',
  T_MINUS_FINAL: '会前终检 (T-3~0d) · 清零 TBC 与终版 Program Sheet 定稿',
  MID_MONTH: '月中常规巡检 · 关注远期排期与月度会议更新'
};

function isPlaceholder(name, note) {
  if (/\[SOFTBLOCK\]/i.test(note || '')) return true;
  const clean = people.clean(name);
  return !clean || /^(external(?:\s*[—-].*|\s+to\s+be\s+added)?|tbc|tbd|to\s+be\s+confirmed)$/i.test(clean);
}

function parseProjectNote(note) {
  const str = String(note || '').trim();
  if (!str || /^\[(?:EXTERNAL|SHEET-SYNC|SOFTBLOCK)\]$/i.test(str)) return { project: '', title: '' };
  if (str.includes(' — ')) {
    const [p, ...rest] = str.split(' — ');
    return { project: p.trim(), title: rest.join(' — ').trim() };
  }
  const hasProj = /\bL[1-5]\b|\bProject\s+\d+\b|ice breaker|evaluation|vocal|speech|storytelling|series|persuade|inspire|visual aids|research your topic|body speaks|how to say it|get to the point|organize|organise/i.test(str);
  return hasProj ? { project: str, title: '' } : { project: '', title: str };
}

async function fetchJson(url, key, fallback = []) {
  if (!url || !key) return fallback;
  try {
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    return res.ok ? await res.json() : fallback;
  } catch {
    return fallback;
  }
}

function parseHistory(csvText, reservations = []) {
  const parsed = appointments.parseWide(appointments.parseCSV(csvText));
  const byDate = parsed?.byDate || {};
  const history = [...(parsed?.historyRows || [])].filter(h => h.raw && !/tbc|tbd|\?|one more|to be decided/i.test(h.raw));
  for (const r of reservations) {
    if (r.member_name && !isPlaceholder(r.member_name, r.note)) {
      history.push({ date: r.meeting_date, role: r.reservation_type, raw: r.member_name });
    }
  }
  return { history, byDate };
}

function analyzeMeeting(meeting, data) {
  if (!meeting) return null;
  const { date, month, theme: baseTheme } = meeting;
  const prog = meetingsStore.get(date);
  const info = data.meetingInfo.find(x => x.meeting_date === date) || {};
  const dbProg = data.dbProgrammes.find(x => x.meeting_date === date)?.programme || {};
  const mergedProg = { ...prog, ...dbProg };
  const speechCount = Number(mergedProg.speechSlots || (date === '2026-10-09' ? 3 : 4));
  const hideAh = mergedProg.schedule?.ah === '' || mergedProg.hideAhCounter === true;

  const sheetCols = data.csvByDate[date] || {};
  const resRows = data.reservations.filter(r => r.meeting_date === date);
  const assignments = {};

  for (const [role, entry] of Object.entries(sheetCols)) {
    if (entry && entry.name && !/tbc|tbd|\?|one more|to be decided/i.test(entry.name)) {
      assignments[role] = { name: people.canonical(entry.name), raw: entry.name, note: '', confirmed: true, source: 'sheet' };
    }
  }
  for (const r of resRows) {
    assignments[r.reservation_type] = {
      name: isPlaceholder(r.member_name, r.note) ? '' : people.canonical(r.member_name),
      raw: r.member_name || '',
      note: r.note || '',
      confirmed: r.confirmed === true,
      placeholder: isPlaceholder(r.member_name, r.note),
      source: 'online'
    };
  }

  const requiredRoles = [
    'Sergeant at Arms',
    'Toastmaster of the Evening',
    'Table Topics Master',
    'Timer',
    ...(hideAh ? [] : ['Ah-Counter']),
    'Language Evaluator',
    ...Array.from({ length: speechCount }, (_, i) => `Prepared Speech ${i + 1}`),
    ...Array.from({ length: speechCount }, (_, i) => `Speech Evaluator ${i + 1}`)
  ];

  const openRoles = [];
  const tbcRoles = [];
  const missingProjects = [];
  const missingTitles = [];
  const guestsToVerify = [];
  const unknownPeople = [];

  for (const role of requiredRoles) {
    const slot = assignments[role];
    if (!slot || !slot.name) {
      openRoles.push(role);
      continue;
    }
    if (!slot.confirmed) tbcRoles.push({ role, name: people.label(slot.name) });
    const person = people.find(slot.name);
    if (!person) unknownPeople.push({ role, raw: slot.raw, canonical: slot.name });
    else if (person.visiting) {
      const poolItem = visitingPool.find(v => people.canonical(v.name) === person.name);
      guestsToVerify.push({
        role,
        name: person.name,
        credentials: person.credentials || '',
        club: person.club || poolItem?.club || '',
        inPool: Boolean(poolItem),
        hasClub: Boolean(person.club || poolItem?.club)
      });
    }
    if (/^Prepared Speech/.test(role)) {
      const parsed = parseProjectNote(slot.note);
      if (!parsed.project) missingProjects.push({ role, name: slot.name, note: slot.note });
      if (!parsed.title) missingTitles.push({ role, name: slot.name });
    }
  }

  const venue = info.venue || mergedProg.venue || '';
  const theme = info.theme || baseTheme || 'Chapter Meeting';
  const hasCustomTheme = Boolean((info.theme || '').trim());
  const tmeSlot = assignments['Toastmaster of the Evening'];
  const saaSlot = assignments['Sergeant at Arms'];
  const ttmSlot = assignments['Table Topics Master'];
  const vpeNotTme = !tmeSlot?.name || people.canonical(tmeSlot.name) !== 'XU Jiaqi';

  const recs = {};
  if (openRoles.length && recommend.recommendMeeting) {
    const membersForRec = membersPublic.map(m => {
      const mp = pathwaysPublic.find(p => people.canonical(p.name) === people.canonical(m.name));
      return { name: m.name, credentials: m.credentials || '', pathway: mp?.pathway || '', level: mp?.level || '' };
    });
    const busy = Object.values(assignments).map(a => a.name).filter(Boolean);
    const willingByRole = {};
    for (const w of (data.willingness || []).filter(w => w.meeting_date === date)) {
      for (const wr of (w.willing_roles || [])) {
        (willingByRole[wr] = willingByRole[wr] || []).push(w.member_name);
      }
    }
    const recMap = recommend.recommendMeeting({
      members: membersForRec,
      history: data.history,
      asOf: date,
      openRoles,
      taken: busy,
      willing: willingByRole,
      limit: 3
    });
    for (const role of openRoles) {
      const list = recMap[role] || [];
      if (list.length) {
        recs[role] = list.map(x => `${x.name}${x.member?.credentials ? ', ' + x.member.credentials : ''} (${(x.reasons || [])[0] || ''})`);
      }
    }
  }

  const guides = {
    tme: {
      holder: tmeSlot?.name ? people.label(tmeSlot.name) : '— open —',
      vpeNotTme,
      checklist: [
        '确认每一位 Prepared Speaker 的准确全名、头衔与演讲项目/题目；',
        '收集每位 Speaker 的简短自我介绍 (Self-Introduction / Bio) 用于开场与串场介绍；',
        `核对全流程时长（${mergedProg.schedule?.saa || '7:30'}–${mergedProg.schedule?.end || '9:50'}${hideAh ? '，本场省略 Ah-Counter' : ''}）。`
      ]
    },
    speakers: Array.from({ length: speechCount }, (_, i) => {
      const r = `Prepared Speech ${i + 1}`;
      const s = assignments[r];
      const p = parseProjectNote(s?.note);
      const timing = p.project ? (programme.lookup(programme.objectives, p.project)?.timing || '') : '';
      return {
        role: r,
        holder: s?.name ? people.label(s.name) : '— open —',
        confirmed: Boolean(s?.confirmed),
        project: p.project || '(待填)',
        title: p.title || '(待填)',
        timing: timing || '待确认',
        action: s?.name ? `向 TME (${tmeSlot?.name || 'TME'}) 提交 Self-Introduction；确认项目/题目${s.confirmed ? '' : '并锁定确认状态'}` : '安排演讲者并填写 Pathways 项目'
      };
    }),
    saaAndTtm: {
      saa: saaSlot?.name ? people.label(saaSlot.name) : '— open —',
      ttm: ttmSlot?.name ? people.label(ttmSlot.name) : '— open —',
      theme,
      hasCustomTheme,
      checklist: [
        `同步本次 Meeting Theme（「${theme}」${hasCustomTheme ? '，已定制' : ' — 尚未填写具体主题，请尽快确认'}）给 SAA 与 Table Topics Master；`,
        '提醒 SAA：更新三份 Mentimeter 投票的候选人姓名、题目/problem 题面，并检查 Program Sheet 上的投票二维码及链接是否可用（Best Table Topics 需在现场即兴发言后即时改入发言人姓名）；',
        '提醒 TTM：围绕主题准备 6–8 题（兼顾嘉宾），与 Timer 对齐 1–2 min 信号，并将实际发言人名单同步给 SAA 用于投票。'
      ]
    },
    guestsAndEvaluators: guestsToVerify.map(g => ({
      ...g,
      checklist: [
        `给 ${g.name} (${g.role}) 发送 Program Sheet（含 Page 2 Project Objectives、⬇ Evaluation form 下载链接与 ${venue || 'SMU'} 地图/导航）；`,
        g.hasClub ? `已记录所属分会：${g.club}` : `⚠️ 请向 ${g.name} 确认所属 Home Club，补全 data/visiting-toastmasters.json 与 scripts/people.js`
      ]
    })),
    functionaries: [
      `Timer (${assignments['Timer']?.name ? people.label(assignments['Timer'].name) : '— open —'}): 确认 Prepared / Table Topics / Evaluation 亮牌时间点与 3 次汇报。`,
      `Language Evaluator (${assignments['Language Evaluator']?.name ? people.label(assignments['Language Evaluator'].name) : '— open —'}): 准备结合主题的 Word of the Day 与 10 分钟总结点评。`,
      hideAh
        ? 'Ah-Counter: 本场次已配置为省略 Ah-Counter 环节。'
        : `Ah-Counter (${assignments['Ah-Counter']?.name ? people.label(assignments['Ah-Counter'].name) : '— open —'}): 记录填充词并预备 5 分钟报告。`
    ]
  };

  return {
    date,
    month,
    venue: venue || '— Venue to be confirmed —',
    theme,
    hasCustomTheme,
    speechCount,
    hideAh,
    isFinal: Boolean(mergedProg.final),
    source: mergedProg.source || null,
    openRoles,
    tbcRoles,
    missingProjects,
    missingTitles,
    unknownPeople,
    guestsMissingClub: guestsToVerify.filter(g => !g.hasClub),
    guestsNotInPool: guestsToVerify.filter(g => !g.inPool),
    recommendations: recs,
    guides
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# ToastFlow VPE 巡检报告 (${report.todaySG})`);
  lines.push(`- 当前生效阶段：${report.stages.map(s => STAGE_LABELS[s]).join(' ｜ ')}`);
  if (report.next) {
    lines.push(`- 下一场例会：**${report.next.date}**（${report.next.month}，距今 **${report.daysUntilNext} 天**）`);
  }
  if (report.prev) {
    lines.push(`- 上一场例会：**${report.prev.date}**（${report.prev.month}，已过 **${report.daysSincePrev} 天**）`);
  }
  lines.push('');

  const m = report.nextAnalysis;
  if (m) {
    lines.push(`## 即将到来例会：${m.date} (${m.month})`);
    lines.push(`- 场地：${m.venue}`);
    lines.push(`- 主题：${m.theme}${m.hasCustomTheme ? '' : ' ⚠️ (尚未设置当期具体 Theme)'}`);
    lines.push(`- 演讲席位：${m.speechCount} 席 ｜ Ah-Counter：${m.hideAh ? '已豁免' : '启用'} ｜ Final 标记：${m.isFinal ? '是' : '否'}`);
    lines.push(`- 空缺角色 (${m.openRoles.length})：${m.openRoles.length ? m.openRoles.join('、') : '无 ✅'}`);
    lines.push(`- 待确认 TBC 角色 (${m.tbcRoles.length})：${m.tbcRoles.length ? m.tbcRoles.map(x => `${x.role}: ${x.name}`).join('；') : '无 ✅'}`);
    if (m.missingProjects.length) lines.push(`- ⚠️ 缺 Pathways 项目：${m.missingProjects.map(x => `${x.role} (${x.name})`).join('；')}`);
    if (m.missingTitles.length) lines.push(`- ⚠️ 缺演讲题目：${m.missingTitles.map(x => `${x.role} (${x.name})`).join('；')}`);
    if (m.unknownPeople.length) lines.push(`- ⚠️ 名单/嘉宾池未收录人员：${m.unknownPeople.map(x => `${x.role}: ${x.raw}`).join('；')}`);
    if (m.guestsMissingClub.length) lines.push(`- ⚠️ 缺所属分会 Home Club：${m.guestsMissingClub.map(g => `${g.name} (${g.role})`).join('、')}`);
    lines.push('');
    lines.push('### 分角色跟进指南（可直接转发/沟通）');
    lines.push(`1. **TME**（${m.guides.tme.holder}${m.guides.tme.vpeNotTme ? ' · VPE 未兼任 TME，请重点对接' : ''}）`);
    m.guides.tme.checklist.forEach(c => lines.push(`   - ${c}`));
    lines.push('2. **Prepared Speakers**');
    m.guides.speakers.forEach(s => lines.push(`   - ${s.role} · ${s.holder}${s.confirmed ? '' : ' [TBC]'}：项目「${s.project}」(${s.timing})｜题目「${s.title}」→ ${s.action}`));
    lines.push(`3. **SAA & Table Topics Master**（SAA: ${m.guides.saaAndTtm.saa} ｜ TTM: ${m.guides.saaAndTtm.ttm}）`);
    m.guides.saaAndTtm.checklist.forEach(c => lines.push(`   - ${c}`));
    lines.push('4. **Guests & Speech Evaluators**');
    if (m.guides.guestsAndEvaluators.length) {
      m.guides.guestsAndEvaluators.forEach(g => g.checklist.forEach(c => lines.push(`   - ${c}`)));
    } else {
      lines.push('   - 暂无外部嘉宾记录；如有外邀嘉宾，请添加至 Visiting Toastmasters 并发送 Program Sheet。');
    }
    lines.push('5. **Timer / Language Evaluator / Ah-Counter**');
    m.guides.functionaries.forEach(f => lines.push(`   - ${f}`));
    if (Object.keys(m.recommendations).length) {
      lines.push('');
      lines.push('### 空缺角色推荐候选人 (ToastFlow Recommend)');
      for (const [role, cands] of Object.entries(m.recommendations)) {
        lines.push(`- **${role}**: ${cands.join(' ｜ ')}`);
      }
    }
  }

  const p = report.prevAnalysis;
  if (p && report.stages.includes('T_PLUS_7')) {
    lines.push('');
    lines.push(`## 会后一周归档检查：${p.date} (${p.month})`);
    lines.push(`- TBC 未清零 (${p.tbcRoles.length})：${p.tbcRoles.length ? p.tbcRoles.map(x => `${x.role}: ${x.name}`).join('；') : '无 ✅'}`);
    lines.push(`- 嘉宾池/名单缺漏：unknown=${p.unknownPeople.length}, 缺分会=${p.guestsMissingClub.length}, 未入池=${p.guestsNotInPool.length}`);
    lines.push('- 请确认已完成：1) Google Sheet 历史更新；2) 新成员/新嘉宾补充进 data/visiting-toastmasters.json 与 scripts/people.js；3) meeting_programmes.js / 远期排期检查。');
  }
  return lines.join('\n');
}

(async () => {
  const args = process.argv.slice(2);
  const dateArg = (args.find(a => a.startsWith('--date=')) || '').slice(7);
  const asJson = args.includes('--json');

  const cfg = readIndexConfig();
  const csvText = fs.readFileSync(path.join(root, 'data/appointments-sheet.csv'), 'utf8');

  const [reservations, meetingInfo, dbProgrammes, willingness] = await Promise.all([
    fetchJson(`${cfg.url}/rest/v1/public_reservations?select=meeting_date,reservation_type,member_name,note,confirmed`, cfg.key),
    fetchJson(`${cfg.url}/rest/v1/public_meeting_info?select=meeting_date,venue,theme,saa`, cfg.key),
    fetchJson(`${cfg.url}/rest/v1/meeting_programmes?select=meeting_date,programme`, cfg.key),
    fetchJson(`${cfg.url}/rest/v1/public_willingness?select=member_name,meeting_date,willing_roles`, cfg.key)
  ]);

  const parsedCsv = parseHistory(csvText, reservations);

  const todaySG = sgToday(dateArg);
  const sorted = [...cfg.meetings].sort((a, b) => a.date.localeCompare(b.date));
  const next = sorted.find(m => m.date >= todaySG) || null;
  const prev = [...sorted].reverse().find(m => m.date < todaySG) || null;
  const daysUntilNext = next ? dayDiff(todaySG, next.date) : null;
  const daysSincePrev = prev ? dayDiff(prev.date, todaySG) : null;
  const stages = phaseFor(daysUntilNext, daysSincePrev);

  const sharedData = { reservations, meetingInfo, dbProgrammes, willingness, csvByDate: parsedCsv.byDate, history: parsedCsv.history };
  const report = {
    todaySG,
    stages,
    daysUntilNext,
    daysSincePrev,
    next,
    prev,
    nextAnalysis: analyzeMeeting(next, sharedData),
    prevAnalysis: analyzeMeeting(prev, sharedData)
  };

  console.log(asJson ? JSON.stringify(report, null, 2) : renderMarkdown(report));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
