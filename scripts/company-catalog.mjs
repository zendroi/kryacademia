import assert from 'node:assert/strict';

const key = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const schools = [
  ['cikal-primary', 'Cikal Primary Surabaya', ['Cikal Primary', 'Cikal Primary Surabaya', 'Sekolah Cikal Surabaya']],
  ['gloria-1', 'SD Gloria 1 Surabaya', ['SD Kr Gloria 1', 'SD Gloria 1 Pacar', 'Gloria 1 Surabaya']],
  ['gloria-3', 'SD Gloria 3 Surabaya', ['SD Kr Gloria 3', 'SD Gloria 3', 'Gloria 3 Surabaya']],
  ['xin-zhong-secondary', 'SMP Xin Zhong', ['SMP Xin Zhong', 'Xin Zhong']],
  ['chung-chung', 'Chung Chung Christian School', ['Chung Chung School', 'Chung - Chung', 'Chung Chung Primary', 'Chung Chung Christian School']],
  ['sma-dharma-mulya', 'SMA Kristen Dharma Mulya', ['SMA Kr Dharma Mulya', 'SMA Kristen Dharma Mulya', 'SMA Dharma Mulya']],
  ['smp-dharma-mulya', 'SMP Kristen Dharma Mulya', ['SMP Dharma Mulya', 'SMP Kristen Dharma Mulya']],
  ['ciputra-kasih', 'SMP Ciputra Kasih', ['SMP Ciputra Kasih']],
  ['santa-clara', 'SMP Santa Clara', ['SMPK Santa Clara', 'SPK SMP Santa Clara', 'SMP Santa Clara']],
];
const types = [
  ['steamaker', 'STEAMaker', 'STEAM', /steamaker/i],
  ['innovation', 'Innovation', 'Innovation & Creativity', /innovation/i],
  ['technova', 'Technova', 'Technology & Innovation', /technova/i],
  ['biotechnology', 'Biotechnology', 'Biotechnology', /biotech/i],
  ['visual-thinker', 'Visual Thinker', 'Visual Thinking', /visual thinker/i],
  ['anime-drawing', 'Anime Drawing', 'Art & Design', /anime drawing/i],
  ['coding', 'Coding', 'Digital Technology', /coding/i],
  ['digital-animation', 'Digital Animation', 'Creative Technology', /digital animation/i],
  ['architecture', 'Architecture & Interior Drawing', 'Art & Design', /architect/i],
];
const dayNames = { monday: 'Monday', senin: 'Monday', tuesday: 'Tuesday', selasa: 'Tuesday', wednesday: 'Wednesday', rabu: 'Wednesday', thursday: 'Thursday', kamis: 'Thursday', friday: 'Friday', jumat: 'Friday', saturday: 'Saturday', sabtu: 'Saturday' };
const integer = (value) => value !== undefined && /^\d+(\.0+)?$/.test(value) ? Number(value) : null;
const coaches = (value = '') => [...new Set(value.split(/[,/]/).map((name) => name.trim()).filter((name) => name && name !== '-').map((name) => /^issac$/i.test(name) ? 'Isaac' : name))];
const normalizedTime = (value = '') => value.replace(/\b(\d{1,2})[.:](\d{2})\b/g, (_, hour, minute) => `${hour.padStart(2, '0')}:${minute}`).replace(/\s+/g, ' ').trim();

export function companyCatalog(workbook, master = 'consensus') {
  assert.ok(['consensus', 'daily', 'schools'].includes(master), 'Choose consensus, daily, or schools');
  assert.match(workbook.sha256, /^[a-f0-9]{64}$/);
  const institution = (name) => schools.find(([, , aliases]) => aliases.some((alias) => key(alias) === key(name)));
  const conflicts = [];
  const pending = [];
  const rows = [];
  for (const sheet of ['Schools Schedule', 'Jadwal Harian Ekskul 2026', 'Tanggal Kelas Berjalan']) {
    let day = '';
    for (const { row, cells: c } of workbook.sheets[sheet] || []) {
      const isSchools = sheet === 'Schools Schedule';
      const isDates = sheet === 'Tanggal Kelas Berjalan';
      day = dayNames[key(isSchools || isDates ? c.A : c.B)] || day;
      const school = institution(isSchools ? c.B : isDates ? c.E : c.G);
      const title = (isSchools ? c.C : isDates ? c.C : c.D) || '';
      const type = types.find(([, , , pattern]) => pattern.test(title));
      const status = isSchools ? c.F : isDates ? c.N : c.J;
      if (!type || !school || status !== 'CONFIRMED') {
        if (title && (isSchools ? c.B : isDates ? c.E : c.G) && !/^(class|nama kelas)$/i.test(title)) pending.push({ sheet, row, title, school: isSchools ? c.B : isDates ? c.E : c.G, reason: status !== 'CONFIRMED' ? 'Not confirmed in this sheet' : 'Unmapped institution or subject' });
        continue;
      }
      const groupName = type[0] === 'technova' ? title.match(/grade.*$/i)?.[0].replace(/[()]/g, '').replace(/\s+/g, ' ').trim() : '';
      assert.ok(type[0] !== 'technova' || groupName, `Technova group missing at ${sheet}:${row}`);
      if (school[0] === 'smp-dharma-mulya' && /grade 1[012]/i.test(groupName)) {
        conflicts.push({ sheet, row, field: 'institution', title, value: school[1], resolution: 'Pending: senior grade listed under junior institution; no extra group created' });
        continue;
      }
      rows.push({ sheet, row, schoolId: school[0], typeId: type[0], groupName, day, time: normalizedTime(isSchools ? c.A : isDates ? c.B : c.C), coaches: coaches(isSchools ? c.D : isDates ? c.D : `${c.E || ''},${c.F || ''}`), reportedStudents: integer(isSchools ? c.E : isDates ? c.O : c.K), plannedMeetings: isSchools ? null : integer(isDates ? c.G : c.I) });
    }
  }
  const groups = [];
  const identities = [...new Set(rows.map((row) => `${row.schoolId}:${row.typeId}:${key(row.groupName)}`))];
  for (const identity of identities) {
    const sources = rows.filter((row) => `${row.schoolId}:${row.typeId}:${key(row.groupName)}` === identity);
    const preferred = sources.find((row) => row.sheet === (master === 'daily' ? 'Jadwal Harian Ekskul 2026' : 'Schools Schedule'));
    const choose = (field) => {
      const present = sources.filter((row) => row[field] != null && row[field] !== '');
      const distinct = [...new Set(present.map((row) => row[field]))];
      if (distinct.length > 1) conflicts.push({ identity, field, sources: present.map((row) => ({ sheet: row.sheet, row: row.row, value: row[field] })), resolution: master === 'consensus' || preferred?.[field] == null ? 'Pending' : master });
      return master !== 'consensus' && preferred?.[field] != null && preferred[field] !== '' ? preferred[field] : distinct.length === 1 ? distinct[0] : null;
    };
    const coachSets = sources.map((row) => [...row.coaches].sort());
    const sameCoaches = coachSets.every((names) => JSON.stringify(names) === JSON.stringify(coachSets[0]));
    if (!sameCoaches) conflicts.push({ identity, field: 'coaches', sources: sources.map((row) => ({ sheet: row.sheet, row: row.row, value: row.coaches })), resolution: master !== 'consensus' && preferred ? master : 'Shared names only; others pending' });
    const safeCoaches = master !== 'consensus' && preferred ? preferred.coaches : sources[0].coaches.filter((name) => sources.every((row) => row.coaches.includes(name)));
    const day = choose('day'); const time = choose('time');
    const type = types.find(([id]) => id === sources[0].typeId);
    groups.push({ id: `official-${sources[0].schoolId}-${type[0]}${sources[0].groupName ? `-${key(sources[0].groupName)}` : ''}`, institutionId: sources[0].schoolId, typeId: type[0], title: type[1], category: type[2], groupName: sources[0].groupName, schedule: day && time ? `${day}, ${time}` : '', coaches: safeCoaches, reportedStudents: choose('reportedStudents'), plannedMeetings: choose('plannedMeetings'), sources: sources.map(({ sheet, row }) => ({ sheet, row })) });
  }
  const counts = (workbook.sheets['Students Data'] || []).filter(({ cells }) => institution(cells.B) && integer(cells.D) !== null);
  const institutions = schools.filter(([id]) => groups.some((group) => group.institutionId === id) || counts.some(({ cells }) => institution(cells.B)?.[0] === id)).map(([id, name]) => {
    const row = counts.find(({ cells }) => institution(cells.B)?.[0] === id);
    return { id, name, reportedStudents: row ? integer(row.cells.D) : null, source: row ? { sheet: 'Students Data', row: row.row } : null };
  });
  assert.equal(new Set(groups.map((group) => group.id)).size, groups.length, 'Duplicate class identities');
  for (const group of groups) {
    assert.ok(group.id.length <= 80 && group.schedule.length <= 140, `Group exceeds portal limits: ${group.id}`);
    assert.ok(group.plannedMeetings === null || (Number.isSafeInteger(group.plannedMeetings) && group.plannedMeetings >= 1 && group.plannedMeetings <= 72), `Invalid meeting count: ${group.id}`);
    assert.ok(group.reportedStudents === null || (Number.isSafeInteger(group.reportedStudents) && group.reportedStudents >= 0 && group.reportedStudents <= 10000), `Invalid headcount: ${group.id}`);
    assert.ok(group.coaches.length <= 30 && group.coaches.every((name) => name.length <= 140 && !/[\x00-\x1f]/.test(name)), `Invalid coach names: ${group.id}`);
  }
  assert.ok(institutions.every((item) => item.reportedStudents === null || (Number.isSafeInteger(item.reportedStudents) && item.reportedStudents >= 0 && item.reportedStudents <= 10000)), 'Invalid institution headcount');
  return { file: workbook.file, sha256: workbook.sha256, master, institutions, groups, conflicts, pending, rosterSources: counts.filter(({ cells }) => /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/edit/.test(cells.E || '')).map(({ row, cells }) => ({ institutionId: institution(cells.B)[0], url: cells.E, sheet: 'Students Data', row })), notImported: ['Historical attendance and approvals', 'Fees and payment details', 'Marketing prospects', 'Ambiguous calendar dates', 'Student names from linked sheets', 'Teacher logins, private identities and bank accounts'] };
}
