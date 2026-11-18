import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adToBs,
  bsToAd,
  buildDailyAttendanceRecord,
  getNepaliMonthCalendar,
  getTodayNepaliDate,
  groupAttendanceArchive,
  makeDailyAttendanceId,
  parseBsDateString,
  reconcileDailyAttendanceRecordWithBsTable,
  stepNepaliDay,
  stepNepaliMonth,
} from './nepaliCalendar';
import { pickUniqueAvatarConfig } from './avatarGenerator';
import type { ClassRecord, Student } from './types';

test('adToBs and bsToAd convert exact Bikram Sambat dates matching Nepali Patro', () => {
  // Known exact New Year anchors (1 Baisakh)
  const bs2080 = adToBs(2023, 4, 14);
  assert.equal(bs2080.bsDateString, '2080-01-01');
  assert.equal(bs2080.monthNameEn, 'Baisakh');
  assert.equal(bs2080.weekdayNameEn, 'Friday');

  // 2024 is a Gregorian leap year, so 1 Baisakh 2081 falls on April 13, 2024
  const bs2081 = adToBs(2024, 4, 13);
  assert.equal(bs2081.bsDateString, '2081-01-01');
  assert.equal(bs2081.weekdayNameEn, 'Saturday');

  // 2081 BS has 366 days, so 1 Baisakh 2082 returns to April 14, 2025
  const bs2082 = adToBs(2025, 4, 14);
  assert.equal(bs2082.bsDateString, '2082-01-01');
  assert.equal(bs2082.weekdayNameEn, 'Monday');

  // 1 Baisakh 2083 falls on April 14, 2026 (Tuesday)
  const bs2083 = adToBs(2026, 4, 14);
  assert.equal(bs2083.bsDateString, '2083-01-01');
  assert.equal(bs2083.weekdayNameEn, 'Tuesday');

  // November 17, 2026 AD -> 2083 Mangsir 01 (Tuesday) per Nepali Patro
  const nov17 = adToBs(2026, 11, 17);
  assert.equal(nov17.bsYear, 2083);
  assert.equal(nov17.bsMonth, 8);
  assert.equal(nov17.monthNameEn, 'Mangsir');
  assert.equal(nov17.bsDay, 1);
  assert.equal(nov17.bsDateString, '2083-08-01');
  assert.equal(nov17.weekdayNameEn, 'Tuesday');
  assert.equal(nov17.weekOfMonth, 1);

  // November 18, 2026 AD -> 2083 Mangsir 02 (Wednesday) per Nepali Patro
  const nov18 = adToBs(2026, 11, 18);
  assert.equal(nov18.bsYear, 2083);
  assert.equal(nov18.bsMonth, 8);
  assert.equal(nov18.monthNameEn, 'Mangsir');
  assert.equal(nov18.bsDay, 2);
  assert.equal(nov18.bsDateString, '2083-08-02');
  assert.equal(nov18.weekdayNameEn, 'Wednesday');
  assert.equal(nov18.weekOfMonth, 1);

  // Round-trip verification
  const roundtrip = bsToAd(2083, 8, 2);
  assert.equal(roundtrip.adDateString, '2026-11-18');
  assert.equal(roundtrip.bsDateString, '2083-08-02');
});

test('getTodayNepaliDate uses Nepal local time (UTC+05:45) accurately and matches Nepali Patro', () => {
  // 2026-11-17T21:55:00Z is 2026-11-18T03:40:00+05:45 in Nepal (Mangsir 2, 2083 Wednesday)
  const utcLateNov17 = Date.UTC(2026, 10, 17, 21, 55, 0);
  const nepalToday = getTodayNepaliDate(utcLateNov17);
  assert.equal(nepalToday.adDateString, '2026-11-18');
  assert.equal(nepalToday.bsDateString, '2083-08-02');
  assert.equal(nepalToday.bsDay, 2);
  assert.equal(nepalToday.monthNameEn, 'Mangsir');
  assert.equal(nepalToday.weekdayNameEn, 'Wednesday');
});

test('stepNepaliDay, stepNepaliMonth, and getNepaliMonthCalendar navigate BS months and days cleanly', () => {
  const nextDay = stepNepaliDay('2083-01-31', 1);
  assert.equal(nextDay.bsDateString, '2083-02-01');
  assert.equal(nextDay.monthNameEn, 'Jestha');

  const prevMonth = stepNepaliMonth(2083, 1, -1);
  assert.equal(prevMonth.bsYear, 2082);
  assert.equal(prevMonth.bsMonth, 12);
  assert.equal(prevMonth.monthNameEn, 'Chaitra');

  // Mangsir 2083 has 29 days, starting on Tuesday (weekdayIndex = 2)
  const grid = getNepaliMonthCalendar(2083, 8);
  assert.equal(grid.daysInMonth, 29);
  assert.equal(grid.firstWeekdayIndex, 2);
  assert.equal(grid.days.length, 29);
  assert.equal(grid.days[0].bsDateString, '2083-08-01');
  assert.equal(grid.days[0].adDateString, '2026-11-17');
  assert.equal(grid.days[0].weekdayNameEn, 'Tuesday');
  assert.equal(grid.days[1].bsDateString, '2083-08-02');
  assert.equal(grid.days[1].adDateString, '2026-11-18');
  assert.equal(grid.days[1].weekdayNameEn, 'Wednesday');
  assert.equal(grid.days[28].bsDateString, '2083-08-29');
  assert.equal(grid.days[28].adDateString, '2026-12-15');
  assert.equal(grid.days[28].weekdayNameEn, 'Tuesday');
});

test('reconcileDailyAttendanceRecordWithBsTable repairs mismatched BS dates from adDate', () => {
  const staleRecord = {
    id: 'class_5_2083-08-03',
    classId: 'class_5',
    className: 'Class 5',
    bsDate: '2083-08-03',
    bsMonthKey: '2083-08',
    bsYear: 2083,
    bsMonth: 8,
    bsMonthName: 'Mangsir',
    bsDay: 3,
    weekdayName: 'Wednesday',
    weekOfMonth: 1,
    adDate: '2026-11-18',
    studentRecords: [],
    presentCount: 10,
    absentCount: 0,
    totalCount: 10,
    createdAt: 1000,
    updatedAt: 1000,
  };
  const { record: repaired, changed } = reconcileDailyAttendanceRecordWithBsTable(staleRecord);
  assert.equal(changed, true);
  assert.equal(repaired.id, 'class_5_2083-08-02');
  assert.equal(repaired.bsDate, '2083-08-02');
  assert.equal(repaired.bsDay, 2);
  assert.equal(repaired.weekdayName, 'Wednesday');
});

test('buildDailyAttendanceRecord and groupAttendanceArchive prevent duplicates and organize by Nepali Month -> Class -> Date -> Student Records', () => {
  const cls5: ClassRecord = { id: 'class_5', name: 'Class 5', createdAt: 100, updatedAt: 100 };
  const cls6: ClassRecord = { id: 'class_6', name: 'Class 6', createdAt: 100, updatedAt: 100 };
  const avatarCfg = pickUniqueAvatarConfig('random', []);
  const students: Student[] = [
    {
      id: 's1',
      classId: 'class_5',
      name: 'Aarav Patel',
      rollNumber: '501',
      characterPresentation: 'masculine',
      avatarSource: 'generated',
      avatarConfig: avatarCfg,
      activeStatus: 'active',
      createdAt: 100,
      updatedAt: 100,
    },
    {
      id: 's2',
      classId: 'class_5',
      name: 'Ananya Verma',
      rollNumber: '502',
      characterPresentation: 'feminine',
      avatarSource: 'generated',
      avatarConfig: avatarCfg,
      activeStatus: 'active',
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  const dateInfo = parseBsDateString('2083-08-02')!;
  const rec1 = buildDailyAttendanceRecord({
    classRecord: cls5,
    students,
    absentStudentIds: ['s2'],
    bsDateInfo: dateInfo,
    notes: 'Morning roll call',
    now: 1000,
  });

  assert.equal(rec1.id, makeDailyAttendanceId('class_5', '2083-08-02'));
  assert.equal(rec1.presentCount, 1);
  assert.equal(rec1.absentCount, 1);
  assert.equal(rec1.studentRecords[0].rollNumber, '501');
  assert.equal(rec1.studentRecords[0].status, 'present');
  assert.equal(rec1.studentRecords[1].rollNumber, '502');
  assert.equal(rec1.studentRecords[1].status, 'absent');

  // Re-saving same class and BS date updates existing record ID and preserves createdAt
  const rec1Updated = buildDailyAttendanceRecord({
    classRecord: cls5,
    students,
    absentStudentIds: [],
    bsDateInfo: dateInfo,
    existingRecord: rec1,
    now: 2000,
  });
  assert.equal(rec1Updated.id, rec1.id);
  assert.equal(rec1Updated.createdAt, 1000);
  assert.equal(rec1Updated.updatedAt, 2000);
  assert.equal(rec1Updated.presentCount, 2);
  assert.equal(rec1Updated.absentCount, 0);

  // Add another date in same month and a record in previous month
  const prevMonthDate = parseBsDateString('2083-07-15')!;
  const recKartik = buildDailyAttendanceRecord({
    classRecord: cls6,
    students: [],
    absentStudentIds: [],
    bsDateInfo: prevMonthDate,
    now: 500,
  });

  const archive = groupAttendanceArchive([rec1, rec1Updated, recKartik], [cls5, cls6]);
  assert.equal(archive.length, 2);
  assert.equal(archive[0].bsMonthKey, '2083-08');
  assert.equal(archive[0].bsMonthNameEn, 'Mangsir');
  assert.equal(archive[0].classes.length, 1);
  // Duplicate date entry for 2083-08-02 was deduplicated to the latest update
  assert.equal(archive[0].classes[0].dates.length, 1);
  assert.equal(archive[0].classes[0].dates[0].presentCount, 2);
  assert.equal(archive[1].bsMonthKey, '2083-07');
  assert.equal(archive[1].bsMonthNameEn, 'Kartik');
});
