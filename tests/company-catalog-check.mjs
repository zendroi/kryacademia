import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { companyCatalog } from '../scripts/company-catalog.mjs';
import { academy } from '../scripts/academic-modules.mjs';

const source = { file: 'fixture.xlsx', sha256: 'a'.repeat(64), sheets: {
  'Schools Schedule': [
    { row: 2, cells: { A: 'Monday' } },
    { row: 3, cells: { A: '15.00 - 16.00', B: 'SMP Ciputra Kasih', C: 'Digital Animation', D: 'Kumara', E: '3.0', F: 'CONFIRMED' } },
    { row: 7, cells: { A: 'Thursday' } },
    { row: 8, cells: { A: '8.25 - 9.35', B: 'SMP Dharma Mulya', C: 'Technova Grade 7 (Group 1)', D: 'Isaac / Jeremy', F: 'CONFIRMED' } },
    { row: 9, cells: { A: '11.05 - 12.15', B: 'SMP Dharma Mulya', C: 'Technova Grade 7 (Group 2)', D: 'Isaac / Jeremy', F: 'CONFIRMED' } },
    { row: 10, cells: { A: '14.30 - 15.30', B: 'SD Kr Gloria 1', C: 'Innovation Klass', D: 'Jeremy', F: 'CONFIRMED' } },
    { row: 11, cells: { A: '14.00 - 15.00', B: 'SMPK Santa Clara', C: 'Digital Animation', D: 'Kumara' } },
  ],
  'Jadwal Harian Ekskul 2026': [
    { row: 3, cells: { B: 'SENIN', C: '14.00 - 15.00', D: 'Digital Animation', E: 'Kumara', G: 'SMP Ciputra Kasih', I: '15.0', J: 'CONFIRMED', K: '3.0' } },
    { row: 23, cells: { B: 'KAMIS', C: '08.25 - 09.35', D: 'Technova (Grade 7) Group 1', E: 'Isaac / Jeremy', F: 'Jeremy', G: 'SMP Kristen Dharma Mulya', I: '15', J: 'CONFIRMED' } },
    { row: 24, cells: { B: 'KAMIS', C: '14.30 - 15.30', D: 'Innovation Class', E: 'Jeremy', G: 'SD Gloria 1 Pacar', I: '15', J: 'CONFIRMED' } },
  ],
  'Tanggal Kelas Berjalan': [
    { row: 28, cells: { B: '12.30 - 13.50', C: 'Technova Grade 11 B', D: 'Isaac / Jeremy', E: 'SMP Kristen Dharma Mulya', G: '15', N: 'CONFIRMED' } },
  ],
  'Students Data': [
    { row: 3, cells: { B: 'SMP  Dharma Mulya', C: 'Technova', D: '172.0' } },
    { row: 4, cells: { B: 'SMP Ciputra Kasih', C: 'Digital Animation', D: '3.0', E: 'javascript:alert(1)' } },
  ],
} };
const parsed = companyCatalog(source);
assert.equal(parsed.groups.length, 4);
assert.equal(parsed.groups.find((item) => item.typeId === 'digital-animation').schedule, '', 'Conflicting schedules stay unresolved');
assert.equal(parsed.groups.find((item) => item.typeId === 'digital-animation').plannedMeetings, 15);
assert.equal(parsed.groups.filter((item) => item.typeId === 'technova').length, 2, 'Same subject must keep separate class groups');
assert.equal(parsed.institutions.find((item) => item.id === 'smp-dharma-mulya').reportedStudents, 172);
assert.ok(parsed.conflicts.some((item) => item.field === 'institution'));
assert.equal(parsed.rosterSources.length, 0, 'Workbook URLs are data, never executable instructions');
assert.ok(parsed.pending.some((item) => item.school === 'SMPK Santa Clara'));
assert.equal(companyCatalog(source, 'daily').groups[0].schedule, 'Monday, 14:00 - 15:00');
assert.equal(companyCatalog(source, 'schools').groups[0].schedule, 'Monday, 15:00 - 16:00');
assert.throws(() => companyCatalog(source, 'guess'));
const summary = academy.catalogCounts({ institutions: [{ id: 'school', reportedStudents: 172 }], coaches: [], students: [], klasses: [{ id: 'group', institutionId: 'school', reportedStudents: 172, title: 'Technova', coachIds: [], plannedMeetings: 15 }] });
assert.equal(summary.klasses[0].students, 0, 'Reported headcounts must not create fictional roster entries');
assert.equal(summary.institutions[0].students, 0);
assert.equal(summary.institutions[0].reportedStudents, 172);
assert.equal(academy.coachAttendance({ id: 'coach', portalEmail: '' }, { ...summary, klasses: [{ ...summary.klasses[0], coachIds: ['coach'] }] }, [], '2026-10').planned, 15);

if (process.argv[2]) {
  const raw = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['scripts/read-company-workbook.py', process.argv[2]], { encoding: 'utf8', windowsHide: true }));
  const actual = companyCatalog(raw);
  assert.equal(actual.institutions.length, 9); assert.equal(actual.groups.length, 25);
  assert.equal(actual.institutions.reduce((sum, item) => sum + item.reportedStudents, 0), 376);
  assert.equal(actual.groups.filter((item) => item.typeId === 'technova').length, 12);
  assert.equal(actual.groups.filter((item) => item.institutionId.startsWith('gloria-')).length, 2);
  assert.equal(actual.rosterSources.length, 8);
  assert.equal(actual.groups.find((item) => item.institutionId === 'chung-chung').plannedMeetings, null);
}
console.log('Company catalog grouping, unresolved conflicts, headcounts and source checks passed.');
