// =========================
// 설정 상수 (여기를 수정하세요)
// =========================

const STUDENT_SHEET_NAME = '학생명단';
const DATA_START_ROW = 5;
const NOTICE_SHEET_NAME = '공지사항';
const DISTRIBUTION_SHEET_NAME = '자료배부기록';
const DISTRIBUTION_START_ROW = 2;
const DISTRIBUTION_ID_COL = 1; // A: 수험번호

const DISTRIBUTION_SUBJECT_COLUMNS = {
  CRIM: { startCol: 3, count: 6 },     // C~H
  CRIMPROC: { startCol: 9, count: 6 }, // I~N
  POLICE: { startCol: 15, count: 8 },  // O~V
  CONST: { startCol: 23, count: 6 }    // W~AB
};

// 시험일 설정 (YYYY-MM-DD)
const EXAM_DATE = '2026-03-14'; 

const TIMEZONE = 'Asia/Seoul';
const ATTENDANCE_START_HOUR = 7;
const ATTENDANCE_START_MINUTE = 0;
const ATTENDANCE_END_HOUR = 23;
const ATTENDANCE_END_MINUTE = 59;

// 열 인덱스 (0-based)
const COL_ID = 0;             // A: 수험번호
const COL_NAME = 1;           // B: 이름

const COL_SEAT_CRIM     = 2;  // C: 형법 좌석
const COL_SEAT_CRIMPROC = 3;  // D: 형소법 좌석
const COL_SEAT_POLICE   = 4;  // E: 경찰학 좌석
const COL_SEAT_CONST    = 5;  // F: 헌법 좌석


// =========================
// 캐시 설정 및 유틸리티
// =========================

const CACHE_KEY_STUDENTS = 'student_data_map';
const CACHE_KEY_NOTICE = 'latest_notice';
const CACHE_DURATION_STUDENTS = 3600; // 1시간 (3600초)
const CACHE_DURATION_NOTICE = 600; // 10분 (600초)

/**
 * 학생 데이터를 캐시에서 조회하거나, 캐시 미스 시 스프레드시트에서 읽어 캐싱
 * @returns {Map|null} 학생 ID_이름을 키로 하는 Map
 */
function getCachedStudentMap() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_STUDENTS);
  
  // 캐시 히트
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return new Map(Object.entries(parsed));
    } catch (e) {
      Logger.log('캐시 파싱 오류: ' + e);
    }
  }
  
  // 캐시 미스 - 스프레드시트에서 읽기
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STUDENT_SHEET_NAME);
    if (!sheet) return null;
    
    const lastRow = sheet.getLastRow();
    if (lastRow < DATA_START_ROW) return null;
    
    const data = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 6).getValues();
    const studentMap = new Map();
    
    data.forEach((row, index) => {
      const id = (row[COL_ID] || '').toString().trim();
      const name = (row[COL_NAME] || '').toString().trim();
      
      if (id && name) {
        const key = `${id}_${name}`;
        studentMap.set(key, {
          rowIndex: index + DATA_START_ROW,
          id: id,
          name: name,
          seatCrim: (row[COL_SEAT_CRIM] || '').toString().trim(),
          seatCrimProc: (row[COL_SEAT_CRIMPROC] || '').toString().trim(),
          seatPolice: (row[COL_SEAT_POLICE] || '').toString().trim(),
          seatConst: (row[COL_SEAT_CONST] || '').toString().trim()
        });
      }
    });
    
    // Map을 Object로 변환하여 캐싱
    const obj = Object.fromEntries(studentMap);
    cache.put(CACHE_KEY_STUDENTS, JSON.stringify(obj), CACHE_DURATION_STUDENTS);
    Logger.log(`학생 데이터 캐싱 완료: ${studentMap.size}명`);
    
    return studentMap;
  } catch (err) {
    Logger.log('getCachedStudentMap error: ' + err);
    return null;
  }
}

/**
 * 공지사항을 캐시에서 조회하거나, 캐시 미스 시 스프레드시트에서 읽어 캐싱
 * @returns {Object|null} 공지사항 객체 또는 null
 */
function getCachedNotice() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_NOTICE);
  
  // 캐시 히트
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      Logger.log('공지사항 캐시 파싱 오류: ' + e);
    }
  }
  
  // 캐시 미스 - 스프레드시트에서 읽기
  const notice = getLatestNotice();
  if (notice) {
    cache.put(CACHE_KEY_NOTICE, JSON.stringify(notice), CACHE_DURATION_NOTICE);
    Logger.log('공지사항 캐싱 완료');
  }
  
  return notice;
}

/**
 * 캐시 수동 초기화 (학생명단이나 공지사항 변경 시 사용)
 * Google Apps Script 편집기에서 이 함수를 직접 실행하거나,
 * 트리거를 설정하여 주기적으로 실행할 수 있습니다.
 */
function clearCache() {
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEY_STUDENTS);
  cache.remove(CACHE_KEY_NOTICE);
  Logger.log('✅ 캐시가 초기화되었습니다.');
}

// =========================
// 공통 유틸 함수
// =========================

function getDayIndexByTimezone(date, tz) {
  const isoDay = parseInt(Utilities.formatDate(date, tz, 'u'), 10);
  return isoDay === 7 ? 0 : isoDay;
}

function getTodaySubjectCode(date, tz) {
  const dayIndex = getDayIndexByTimezone(date, tz);
  if (dayIndex === 1) return 'CRIMPROC';
  if (dayIndex === 2) return 'CONST';
  if (dayIndex === 3) return 'CRIM';
  if (dayIndex === 4 || dayIndex === 5) return 'POLICE';
  return null;
}

function getSubjectColumnInfo(subjectCode) {
  switch (subjectCode) {
    case 'CRIM': return { seatColIndex: COL_SEAT_CRIM, subjectLabel: '형법' };
    case 'CRIMPROC': return { seatColIndex: COL_SEAT_CRIMPROC, subjectLabel: '형소법' };
    case 'POLICE': return { seatColIndex: COL_SEAT_POLICE, subjectLabel: '경찰학' };
    case 'CONST': return { seatColIndex: COL_SEAT_CONST, subjectLabel: '헌법' };
    default: return null;
  }
}

function escapeHtml_(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isNoticePosted_(value) {
  if (value === true) return true;
  if (typeof value === 'string') {
    return value.trim().toUpperCase() === 'TRUE';
  }
  return false;
}

function getLatestNotice() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOTICE_SHEET_NAME);
    if (!sheet) return null;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null; // 헤더 제외 데이터 없음
    
    // 데이터 전체 가져오기 (성능 최적화를 위해 필요한 만큼만 읽는게 좋지만, 간단히 구현)
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    
    // 아래에서부터 위로 탐색 (최신 공지 우선)
    for (let i = data.length - 1; i >= 0; i--) {
      if (isNoticePosted_(data[i][3])) { // D열(인덱스 3) 체크 확인
        const rawDate = data[i][0];
        const dateStr = rawDate instanceof Date ? Utilities.formatDate(rawDate, TIMEZONE, 'yyyy-MM-dd') : String(rawDate || '').trim();
        return {
          date: dateStr,
          title: String(data[i][1] || '').trim(),
          content: String(data[i][2] || '').trim()
        };
      }
    }
    return null;
  } catch (err) {
    Logger.log('getLatestNotice error: ' + err);
    return null;
  }
}

function getExamDdayText() {
  if (!EXAM_DATE) return '';
  const todayStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const todayDate = new Date(`${todayStr}T00:00:00`);
  const examDate = new Date(`${EXAM_DATE}T00:00:00`);
  
  if (isNaN(examDate.getTime()) || isNaN(todayDate.getTime())) return '';
  
  const diffDays = Math.floor((examDate.getTime() - todayDate.getTime()) / 86400000);
  
  if (diffDays > 0) return `👮 1차 시험까지 D-${diffDays}`;
  if (diffDays === 0) return '👮 1차 시험 D-DAY';
  return `👮 1차 시험 D+${Math.abs(diffDays)}`;
}

function getTodayDateInfo_() {
  const now = new Date();
  const todayStr = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');
  const todayDate = new Date(`${todayStr}T00:00:00`);
  const todayMmdd = Utilities.formatDate(now, TIMEZONE, 'MM/dd');
  const dayIndex = getDayIndexByTimezone(now, TIMEZONE);
  return { todayDate, todayMmdd, dayIndex };
}

function startOfDay_(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getMostRecentThursday_(todayDate, dayIndex) {
  const diff = (dayIndex - 4 + 7) % 7;
  const lastThursday = new Date(todayDate);
  lastThursday.setDate(lastThursday.getDate() - diff);
  lastThursday.setHours(0, 0, 0, 0);
  return lastThursday;
}

function parseStampDate_(value, referenceDate) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  const raw = String(value).trim();
  const match = raw.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  let hours = 0;
  let minutes = 0;
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
  }
  const year = referenceDate.getFullYear();
  let parsed = new Date(year, month - 1, day, hours, minutes);
  if (startOfDay_(parsed).getTime() > startOfDay_(referenceDate).getTime()) {
    parsed = new Date(year - 1, month - 1, day, hours, minutes);
  }
  return parsed;
}

function hasTodayStamp_(values, todayMmdd) {
  return values.some((value) => {
    if (!value) return false;
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, TIMEZONE, 'MM/dd') === todayMmdd;
    }
    return String(value).includes(todayMmdd);
  });
}

function hasStampSince_(values, startDate, referenceDate) {
  const start = startOfDay_(startDate);
  return values.some((value) => {
    const parsed = parseStampDate_(value, referenceDate);
    if (!parsed) return false;
    return startOfDay_(parsed).getTime() >= start.getTime();
  });
}

function recordDistribution(studentId) {
  if (!studentId) {
    return { status: 'error', message: '학생 정보 없음' };
  }

  // 캐시된 학생 데이터 사용 (성능 개선)
  const studentMap = getCachedStudentMap();
  if (!studentMap) {
    return { status: 'error', message: '학생 정보 없음' };
  }

  // 학생 정보 조회
  const subjectCodes = ['CRIM', 'CRIMPROC', 'POLICE', 'CONST'];
  const enrolledSubjects = [];
  let studentFound = null;

  // ID로만 검색 (이름은 모르므로)
  for (const [key, student] of studentMap) {
    if (student.id === studentId) {
      studentFound = student;
      subjectCodes.forEach((code) => {
        const info = getSubjectColumnInfo(code);
        if (!info) return;
        
        let seatValue = '';
        if (code === 'CRIM') seatValue = student.seatCrim;
        else if (code === 'CRIMPROC') seatValue = student.seatCrimProc;
        else if (code === 'POLICE') seatValue = student.seatPolice;
        else if (code === 'CONST') seatValue = student.seatConst;
        
        if (seatValue) {
          enrolledSubjects.push({ code, label: info.subjectLabel });
        }
      });
      break;
    }
  }

  if (!studentFound) {
    return { status: 'error', message: '학생 정보 없음' };
  }

  if (enrolledSubjects.length === 0) {
    return { status: 'error', message: '미수강생 (좌석 없음)' };
  }

  const distSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DISTRIBUTION_SHEET_NAME);
  if (!distSheet) {
    return { status: 'error', message: '학생 정보 없음' };
  }

  const distLastRow = distSheet.getLastRow();
  if (distLastRow < DISTRIBUTION_START_ROW) {
    return { status: 'error', message: '학생 정보 없음' };
  }

  const idValues = distSheet
    .getRange(DISTRIBUTION_START_ROW, DISTRIBUTION_ID_COL, distLastRow - DISTRIBUTION_START_ROW + 1, 1)
    .getValues();

  let targetRow = -1;
  for (let i = 0; i < idValues.length; i++) {
    const idInSheet = (idValues[i][0] || '').toString().trim();
    if (idInSheet === studentId) {
      targetRow = i + DISTRIBUTION_START_ROW;
      break;
    }
  }

  if (targetRow === -1) {
    return { status: 'error', message: '학생 정보 없음' };
  }

  const { todayDate, todayMmdd, dayIndex } = getTodayDateInfo_();
  
  // 배치 처리: 전체 행을 한 번에 읽기 (성능 개선)
  // C~AB 컬럼 (3~28번, 총 26개 컬럼)을 한 번에 읽음
  const entireRow = distSheet.getRange(targetRow, 3, 1, 26).getValues()[0];
  
  const subjectRecords = [];

  for (let i = 0; i < enrolledSubjects.length; i++) {
    const subject = enrolledSubjects[i];
    const config = DISTRIBUTION_SUBJECT_COLUMNS[subject.code];
    if (!config) continue;
    
    // 전체 행에서 해당 과목 데이터만 추출
    const startIdx = config.startCol - 3; // 3번 컬럼부터 시작했으므로
    const rowValues = entireRow.slice(startIdx, startIdx + config.count);
    
    if (hasTodayStamp_(rowValues, todayMmdd)) {
      return { status: 'warning', message: '금일 이미 수령했습니다' };
    }
    subjectRecords.push({ subject, config, rowValues });
  }

  if (subjectRecords.length === 0) {
    return { status: 'error', message: '학생 정보 없음' };
  }

  const hasNonPolice = subjectRecords.some((record) => record.subject.code !== 'POLICE');
  if (hasNonPolice) {
    const lastThursday = getMostRecentThursday_(todayDate, dayIndex);
    for (let i = 0; i < subjectRecords.length; i++) {
      const record = subjectRecords[i];
      if (record.subject.code === 'POLICE') continue;
      if (hasStampSince_(record.rowValues, lastThursday, todayDate)) {
        return { status: 'warning', message: '이번 주차 자료를 이미 수령했습니다' };
      }
    }
  }

  const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'MM/dd HH:mm');
  const updates = [];
  const labels = [];

  for (let i = 0; i < subjectRecords.length; i++) {
    const { subject, config, rowValues } = subjectRecords[i];
    let emptyIndex = -1;
    for (let j = 0; j < rowValues.length; j++) {
      if (String(rowValues[j] || '').trim() === '') {
        emptyIndex = j;
        break;
      }
    }
    if (emptyIndex === -1) {
      continue;
    }
    updates.push(config.startCol + emptyIndex);
    labels.push(subject.label);
  }

  if (updates.length === 0) {
    return { status: 'warning', message: '이미 모두 수령함' };
  }

  updates.forEach((col) => {
    distSheet.getRange(targetRow, col, 1, 1).setValue(stamp);
  });

  return { 
    status: 'success', 
    message: labels.join(','),  // 과목명만 쉼표로 구분
    subjectCount: enrolledSubjects.length 
  };
}

function createDistributionResultHtml(status, message, subjectCount) {
  const theme = {
    success: { bg: '#28a745', text: '#ffffff' },
    warning: { bg: '#ffc107', text: '#111111' },
    error: { bg: '#dc3545', text: '#ffffff' }
  };
  
  // 수강 과목 수에 따른 배경색 설정
  const subjectTheme = {
    4: { bg: '#28a745', text: '#ffffff' }, // 4과목: 초록색
    3: { bg: '#007bff', text: '#ffffff' }, // 3과목: 파란색
    2: { bg: '#6f42c1', text: '#ffffff' }, // 2과목: 보라색
    1: { bg: '#fd7e14', text: '#ffffff' }  // 1과목: 주황색
  };
  
  let colors;
  if (status === 'success' && subjectCount) {
    colors = subjectTheme[subjectCount] || theme.success;
  } else {
    colors = theme[status] || theme.error;
  }
  
  // 과목명을 2줄로 나누기
  let displayContent = '';
  if (status === 'success' && message) {
    const subjects = message.split(',');
    const line1 = [];
    const line2 = [];
    
    // 과목 수에 따라 줄 나누기
    if (subjects.length === 4) {
      // 4과목: 형법 / 형소법 \n 경찰학 / 헌법
      line1.push(subjects[0], subjects[1]);
      line2.push(subjects[2], subjects[3]);
    } else if (subjects.length === 3) {
      // 3과목: 형법 / 형소법 \n 경찰학
      line1.push(subjects[0], subjects[1]);
      line2.push(subjects[2]);
    } else if (subjects.length === 2) {
      // 2과목: 형법 / 형소법
      line1.push(subjects[0], subjects[1]);
    } else if (subjects.length === 1) {
      // 1과목: 형법
      line1.push(subjects[0]);
    }
    
    const line1Text = line1.join(' / ');
    const line2Text = line2.length > 0 ? line2.join(' / ') : '';
    
    const subjectLines = line2Text 
      ? `<div class="subject-line">${escapeHtml_(line1Text)}</div><div class="subject-line">${escapeHtml_(line2Text)}</div>`
      : `<div class="subject-line">${escapeHtml_(line1Text)}</div>`;
    
    displayContent = `<div class="title">수강과목</div>${subjectLines}`;
  } else {
    displayContent = `<div class="message">${escapeHtml_(message)}</div>`;
  }
  
  const html = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><base target="_top">
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; min-height: 100dvh; }
        body { display: flex; align-items: center; justify-content: center; background: ${colors.bg}; color: ${colors.text}; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; text-align: center; }
        .card { padding: 6vmin; }
        .title { font-size: 7vmin; font-weight: 700; margin-bottom: 4vmin; opacity: 0.95; letter-spacing: 0.5px; }
        .subject-line { font-size: 9vmin; font-weight: 800; line-height: 1.4; word-break: keep-all; margin: 1vmin 0; }
        .message { font-size: 9vmin; font-weight: 800; line-height: 1.3; word-break: keep-all; }
      </style>
    </head><body>
      <div class="card">${displayContent}</div>
    </body></html>
  `;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const studentId = (params.studentId || '').trim();
  const studentName = (params.studentName || '').trim();
  const url = ScriptApp.getService().getUrl();
  const mode = (params.mode || '').trim();

  if (mode === 'check') {
    const checkId = (params.id || params.studentId || '').trim();
    const result = recordDistribution(checkId);
    return createDistributionResultHtml(result.status, result.message, result.subjectCount);
  }

  if (!studentId || !studentName) {
    return renderForm(url);
  }

  // 3. 학생 정보 조회
  const studentInfo = getStudentInfo(studentId, studentName);
  if (!studentInfo) { return createFailureHtml(url, 'INVALID_ID'); }

  // 4. 수강 자격 확인
  const isAnyEnrolled = Boolean(
    studentInfo.seatCrim ||
    studentInfo.seatCrimProc ||
    studentInfo.seatPolice ||
    studentInfo.seatConst
  );

  if (!isAnyEnrolled) { return createFailureHtml(url, 'NOT_ELIGIBLE'); }

  const noticeData = getCachedNotice(); // 캐시된 공지사항 사용

  // 5. 쓰기 작업 (Lock 생략 가능하나 유지)
  return createSuccessHtml(url, studentInfo.id, studentInfo.name, studentInfo.seatCrim, studentInfo.seatCrimProc, studentInfo.seatPolice, studentInfo.seatConst, noticeData);
}

function getStudentInfo(studentId, studentName) {
  try {
    const studentMap = getCachedStudentMap();
    if (!studentMap) {
      Logger.log('getStudentInfo: 학생 데이터를 로드할 수 없습니다.');
      return null;
    }
    
    const key = `${studentId}_${studentName}`;
    const studentInfo = studentMap.get(key);
    
    if (!studentInfo) {
      Logger.log(`getStudentInfo: 학생 정보를 찾을 수 없음 - ID: ${studentId}, 이름: ${studentName}`);
    }
    
    return studentInfo || null;
  } catch (err) {
    Logger.log('getStudentInfo error: ' + err);
    return null;
  }
}

function renderForm(url) {
  const html = `
    <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"><base target="_top">
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        body { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); display: flex; justify-content: center; align-items: center; }
        .wrapper { width: 95%; max-width: 600px; padding: 0; }
        .card { background: transparent; border: none; text-align: center; color: #fff; padding: 2vmin; }
        .icon-circle { width: 20vmin; height: 20vmin; max-width: 100px; max-height: 100px; border: 2px solid #fff; border-radius: 50%; margin: 0 auto 4vmin auto; display: flex; justify-content: center; align-items: center; }
        .icon-circle svg { width: 50%; height: 50%; fill: #fff; }
        .title { font-size: 6vmin; font-weight: 700; color: #fff; margin: 0 0 6vmin 0; letter-spacing: -0.5px; }
        .form-group { margin-bottom: 4vmin; position: relative; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 4vmin; width: 5vmin; height: 5vmin; fill: #666; z-index: 10; }
        .input { width: 100%; padding: 4vmin 4vmin 4vmin 12vmin; font-size: 4.5vmin; border: none; border-radius: 1vmin; outline: none; background-color: #fff; color: #333; }
        .button { width: 100%; padding: 4vmin; font-size: 5vmin; font-weight: 700; color: #fff; background-color: #0d6efd; border: none; border-radius: 1vmin; cursor: pointer; margin-top: 4vmin; box-shadow: 0 4px 15px rgba(13, 110, 253, 0.4); }
        .button:active { background-color: #0b5ed7; transform: scale(0.98); }
        .remember-box { margin-top: 4vmin; text-align: center; }
        .remember-button { padding: 2.5vmin 4vmin; width: 100%; font-size: 4vmin; font-weight: 600; border: 2px solid rgba(255,255,255,0.6); color: #fff; background: transparent; border-radius: 1.5vmin; cursor: pointer; }
        .remember-button:disabled { opacity: 0.35; cursor: not-allowed; }
        .remember-hint { margin-top: 1.5vmin; font-size: 3.5vmin; color: rgba(255,255,255,0.75); }
        .footer { margin-top: 5vmin; text-align: center; font-size: 3.5vmin; color: rgba(255,255,255,0.6); }
        .loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: none; flex-direction: column; justify-content: center; align-items: center; z-index: 9999; color: #fff; }
        .loader { border: 5px solid #f3f3f3; border-top: 5px solid #0d6efd; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </head><body>
      <div class="wrapper">
        <div class="card">
          <div class="icon-circle">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <h1 class="title">알짜 진도별 문제풀이 인증</h1>
          <form id="authForm" method="get" action="${url}">
            <div class="form-group">
              <div class="input-wrapper">
                <svg class="input-icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/></svg>
                <input class="input" type="text" name="studentId" inputmode="numeric" pattern="[0-9]*" placeholder="수험번호" required>
              </div>
            </div>
            <div class="form-group">
              <div class="input-wrapper">
                <svg class="input-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                <input class="input" type="text" name="studentName" placeholder="이름" required>
              </div>
            </div>
            <button class="button" type="submit">인증하기</button>
            <div class="remember-box">
              <button type="button" class="remember-button" id="loadSavedButton">저장된 정보 불러오기</button>
              <div class="remember-hint" id="rememberHint">이전에 저장된 정보가 없습니다.</div>
            </div>
          </form>
        </div>
        <div class="footer">한국경찰학원</div>
      </div>
      <div id="loadingOverlay" class="loading-overlay">
        <div class="loader"></div>
        <div class="loading-text">인증 중입니다...</div>
      </div>
      <script> 
        document.getElementById('authForm').addEventListener('submit', function(e) { 
          const idInput = document.querySelector('input[name="studentId"]');
          const nameInput = document.querySelector('input[name="studentName"]');
          localStorage.setItem('studentId', idInput.value);
          localStorage.setItem('studentName', nameInput.value);
          document.getElementById('loadingOverlay').style.display = 'flex';
        }); 
        
        window.addEventListener('DOMContentLoaded', function() {
          const idInput = document.querySelector('input[name="studentId"]');
          const nameInput = document.querySelector('input[name="studentName"]');
          const loadButton = document.getElementById('loadSavedButton');
          const hint = document.getElementById('rememberHint');
          
          function refreshSavedState() {
            const savedId = localStorage.getItem('studentId');
            const savedName = localStorage.getItem('studentName');
            const hasSaved = !!(savedId || savedName);
            loadButton.disabled = !hasSaved;
            hint.textContent = hasSaved ? '버튼을 누르면 이전 정보가 입력됩니다.' : '이전에 저장된 정보가 없습니다.';
          }
          
          loadButton.addEventListener('click', function() {
            const savedId = localStorage.getItem('studentId');
            const savedName = localStorage.getItem('studentName');
            if (savedId) { idInput.value = savedId; }
            if (savedName) { nameInput.value = savedName; }
          });
          
          refreshSavedState();
        });
      </script>
    </body></html>
  `;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function createSuccessHtml(url, studentId, name, seatCrim, seatCrimProc, seatPolice, seatConst, noticeData) {
  const today = new Date(); const tz = TIMEZONE;
  const dayIndex = getDayIndexByTimezone(today, tz);
  const koreanDays = ['일', '월', '화', '수', '목', '금', '토'];
  const formattedDate = `${Utilities.formatDate(today, tz, 'M월 d일')}(${koreanDays[dayIndex] || ''})`;
  const safeName = escapeHtml_(name);
  const safeStudentId = escapeHtml_(studentId);
  const dayStyles = [{bg:'#3a0a5e',text:'#ffffff'},{bg:'#007bff',text:'#ffffff'},{bg:'#28a745',text:'#ffffff'},{bg:'#ffc107',text:'#000000'},{bg:'#6f42c1',text:'#ffffff'},{bg:'#e83e8c',text:'#ffffff'},{bg:'#0b1f4e',text:'#ffffff'}];
  const style = dayStyles[dayIndex] || dayStyles[0];
  
  const hasNotice = !!noticeData;
  const noticeTitle = hasNotice ? escapeHtml_(noticeData.title) : '';
  const noticeContentText = hasNotice ? escapeHtml_(noticeData.content) : '';
  const noticeButtonHtml = hasNotice ? '<button type="button" class="rules-button" data-modal-target="noticeModal">공지사항</button>' : '';
  
  const examDdayText = getExamDdayText();
  const examDdayHtml = examDdayText ? `<div class="exam-dday">${escapeHtml_(examDdayText)}</div>` : '';
  const securityClockHtml = '<div class="security-clock" id="securityClock">--:--:--</div>';
  const qrPayloadUrl = `${url}?mode=check&id=${encodeURIComponent(studentId)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(qrPayloadUrl)}`;
  const qrButtonHtml = '<button type="button" class="rules-button" data-modal-target="qrModal">&#127903; 교재/자료 수령 QR</button>';
  
  const noticeModalHtml = hasNotice ? `
      <div id="noticeModal" class="modal-overlay">
        <div class="modal-card">
          <h2>📢 공지사항</h2>
          <div class="modal-body">
            ${noticeTitle ? `<div class="notice-title">${noticeTitle}</div>` : ''}
            <div class="notice-content">${noticeContentText}</div>
          </div>
          <button type="button" class="modal-close" data-close-target="noticeModal">닫기</button>
        </div>
      </div>
  ` : '';
  
  const noticeAutoOpenScript = hasNotice ? "var noticeEl = document.getElementById('noticeModal'); if (noticeEl) { noticeEl.classList.add('visible'); }" : '';
  const qrModalHtml = `
      <div id="qrModal" class="modal-overlay">
        <div class="modal-card">
          <h2>교재/자료 수령 QR</h2>
          <div class="modal-body qr-modal-body">
            <img class="qr-image" src="${qrImageUrl}" alt="QR code">
            <div class="qr-info">수험번호: ${safeStudentId}</div>
            <div class="qr-name">이름: ${safeName}</div>
          </div>
          <button type="button" class="modal-close" data-close-target="qrModal">닫기</button>
        </div>
      </div>
  `;
  
  const html = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"><base target="_top">
      <style>
        * { box-sizing: border-box; } 
        html, body { margin: 0; padding: 0; width: 100%; min-height: 100dvh; }
        body { display: flex; flex-direction: column; justify-content: flex-start; align-items: center; background-color: ${style.bg}; color: ${style.text}; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; text-align: center; animation: blinkBackground 1s ease-in-out infinite; }
        
        .content-wrapper { position: relative; z-index: 1; width: 100%; min-height: 100dvh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 6vmin; }
        
        .title { font-size: 9vmin; font-weight: 900; margin-bottom: 2vmin; letter-spacing: -1px; word-break: keep-all; line-height: 1.2; }
        .info { font-size: 6.2vmin; font-weight: 700; margin-bottom: 2vmin; opacity: 0.9; }
        .meta-row { display: flex; flex-direction: column; align-items: center; gap: 1.5vmin; margin-bottom: 4vmin; }
        .exam-dday { font-size: 4.4vmin; font-weight: 800; color: #dc3545; margin: 0; }
        
        .rules-buttons { display: flex; gap: 3vmin; flex-direction: column; align-items: stretch; width: 100%; margin-bottom: 4vmin; }
        .rules-button {
          width: 100%; padding: 2.2vmin 4.5vmin; border-radius: 30px; border: none; background: #000000; color: #ffffff;
          font-size: 3.6vmin; font-weight: 700; display: flex; align-items: center; justify-content: center; text-align: center; cursor: pointer; text-decoration: none;
        }
        .rules-button:active { transform: scale(0.96); }

        .security-clock {
          font-size: 6.5vmin; font-weight: 800; font-family: "Courier New", Courier, monospace; letter-spacing: 0.2vmin;
          min-width: 26vmin; text-align: center; opacity: 0.85; margin: 0;
        }
        
        /* Table Styles */
        .seat-table { display: grid; grid-template-columns: 1fr 1fr; gap: 3vmin; width: 100%; margin-bottom: 3vmin; }
        .seat-column { border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 10px; padding: 2vmin; background: rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .seat-header { font-size: 3.6vmin; font-weight: bold; margin-bottom: 1vmin; }
        .seat-value { font-size: 4.5vmin; font-weight: 900; }

        .exit-button { margin-top: 2.5vmin; padding: 1.5vmin 6vmin; font-size: 3.8vmin; border: 0.5vmin solid currentColor; color: inherit; background-color: transparent; border-radius: 50px; text-decoration: none; font-weight: bold; flex-shrink: 1; }
        
        /* Modals */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: none; align-items: center; justify-content: center; padding: 5vmin; z-index: 9999; overflow: hidden; }
        .modal-overlay.visible { display: flex; }
        .modal-card { width: 95%; max-width: 680px; max-height: 85dvh; background: #ffffff; color: #111; border-radius: 2vmin; padding: 4vmin; display: flex; flex-direction: column; margin: 2vmin; box-shadow: 0 1.5vmin 4vmin rgba(0,0,0,0.35); }
        .modal-card h2 { font-size: 5vmin; margin-bottom: 2vmin; color: #111; }
        .modal-body { flex: 1; overflow-y: auto; font-size: 3.8vmin; line-height: 1.5; padding: 20px; text-align: left; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
        .modal-body p { margin: 0 0 1.5vmin 0; }
        .notice-title { font-size: 4.2vmin; font-weight: 700; margin-bottom: 2vmin; }
        .notice-content { font-size: 3.8vmin; line-height: 1.5; white-space: pre-wrap; }
        .modal-close { margin-top: 3vmin; padding: 2vmin; font-size: 4vmin; font-weight: 700; border: none; background: #111; color: #fff; border-radius: 1.5vmin; }
        .qr-modal-body { display: flex; flex-direction: column; align-items: center; gap: 3vmin; text-align: center; }
        .qr-image { width: 60vmin; max-width: 320px; height: auto; border-radius: 2vmin; background: #ffffff; padding: 2vmin; }
        .qr-info { font-size: 4.6vmin; font-weight: 800; }
        .qr-name { font-size: 4.6vmin; font-weight: 800; }
        
        /* Landscape Force & Mobile Adjustments */
        @media (max-width: 480px) {
          .title { font-size: 8.5vmin; }
          .info { font-size: 6vmin; }
          .rules-button { font-size: 3.4vmin; }
          .seat-header { font-size: 3.4vmin; }
          .seat-value { font-size: 4.2vmin; }
        }
        
        @keyframes blinkBackground { 
          0%, 100% { background-color: ${style.bg}; color: ${style.text}; }
          50% { background-color: #ffffff; color: #111111; }
        }
      </style>
    </head><body>
      <div class="content-wrapper">
        <div class="title">알짜 진도별 문제풀이</div>
        <div class="info">${formattedDate} : ${safeName}</div>
        <div class="meta-row">
          ${examDdayHtml}
          ${securityClockHtml}
        </div>
        <div class="rules-buttons">
          ${noticeButtonHtml}
          ${qrButtonHtml}
          <button type="button" class="rules-button" data-modal-target="studyRulesModal">알짜 문제풀이 규정</button>
          <button type="button" class="rules-button" data-modal-target="refundRulesModal">환불규정</button>
          <a class="rules-button" href="https://daegu.koreapolice.co.kr/seat/" target="_blank" rel="noopener">좌석배치도</a>
        </div>
        
        <div class="seat-table">
          <div class="seat-column"><div class="seat-header">형법</div><div class="seat-value">${seatCrim}</div></div>
          <div class="seat-column"><div class="seat-header">형소법</div><div class="seat-value">${seatCrimProc}</div></div>
          <div class="seat-column"><div class="seat-header">경찰학</div><div class="seat-value">${seatPolice}</div></div>
          <div class="seat-column"><div class="seat-header">헌법</div><div class="seat-value">${seatConst}</div></div>
        </div>

        <a href="${url}" class="exit-button">확인</a>
      </div>

      ${qrModalHtml}
      ${noticeModalHtml}

      <div id="studyRulesModal" class="modal-overlay">
        <div class="modal-card">
          <h2>알짜 문제풀이 규정</h2>
          <div class="modal-body">
            <p>1. 매주 선행학습(배부자료)은 목요일 오전 10시부터 배부를 시작 합니다.</p>
            <p>2. 선행학습(배부자료)은 각 과목별 약 60~70문제 내외로, 수업 전 미리 풀어보시고 수업 전까지 복습하세요.</p>
            <p>3. 알짜 특강 모의고사는 전 과목 18시 시험시간(약 20분)동안에만 배부합니다. 시험 시작 5분 전 반드시 접수증을 지참하여 지정좌석에 착석해주세요. 해설강의가 시작되고 나면 당일 시험 자료를 받을 수 없으니 반드시 시간 엄수하여 시험에 참여 하시기 바랍니다.</p>
            <p>4. 알짜 진도별 모의고사는 "해설지"가 없으니 강의를 꼭 참여해주시기 바랍니다.</p>
            <p>5. 수업시간에 선행학습(배부자료)도 함께 지참하여 참여하여 주시기 바랍니다.</p>
            <p>6. 수업종료 후 선행학습(배부자료) 해설지가 배부됩니다.</p>
          </div>
          <button type="button" class="modal-close" data-close-target="studyRulesModal">닫기</button>
        </div>
      </div>
      
      <div id="refundRulesModal" class="modal-overlay">
        <div class="modal-card">
          <h2>환불규정</h2>
          <div class="modal-body">
            <p>[알짜 진도별 문제풀이 환불 규정]</p>
            <p>- 환불 시에는 과목별 원 수강료 기준으로 책정되며, 과목당 총 6주 기준으로 2주 이내 환불 시 1/3 금액 공제 후 환불, 3주 이내 환불 시 1/2 금액 공제 후 환불됩니다. 3주(3회차) 초과 시 환불이 불가합니다.</p>
            <p>- (경찰학은 총 8회차 기준 2회 이내 수강시 1/3 공제, 4회 이내 수강시 1/2 공제, 5회 이상 수강 시 환불 불가)</p>
            <p>- 동형 특강 동시 수강자에겐 알짜 6주차 진행시에 동형 접수증이 발급됩니다.</p>
          </div>
          <button type="button" class="modal-close" data-close-target="refundRulesModal">닫기</button>
        </div>
      </div>
      
      <script>
        (function() {
          function openModal(id) {
            var overlay = document.getElementById(id);
            if (overlay) { overlay.classList.add('visible'); }
          }
          function closeModal(id) {
            var overlay = document.getElementById(id);
            if (overlay) { overlay.classList.remove('visible'); }
          }
          document.querySelectorAll('[data-modal-target]').forEach(function(btn) {
            btn.addEventListener('click', function() {
              openModal(btn.getAttribute('data-modal-target'));
            });
          });
          document.querySelectorAll('.modal-close').forEach(function(btn) {
            btn.addEventListener('click', function() {
              closeModal(btn.getAttribute('data-close-target'));
            });
          });
          document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
            overlay.addEventListener('click', function(e) {
              if (e.target === overlay) { overlay.classList.remove('visible'); }
            });
          });
          function updateSecurityClock() {
            var clockEl = document.getElementById('securityClock');
            if (!clockEl) return;
            var now = new Date();
            var hh = String(now.getHours()).padStart(2, '0');
            var mm = String(now.getMinutes()).padStart(2, '0');
            var ss = String(now.getSeconds()).padStart(2, '0');
            clockEl.textContent = hh + ':' + mm + ':' + ss;
          }
          updateSecurityClock();
          setInterval(updateSecurityClock, 1000);
          ${noticeAutoOpenScript}
        })();
      </script>
    </body></html>
  `;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function createFailureHtml(url, failureType) {
  let title = '인증 실패'; let message;
  if (failureType === 'INVALID_ID') { message = '수험번호 또는 이름이 일치하지 않습니다.<br>다시 확인해 주세요.'; }
  else if (failureType === 'NOT_ELIGIBLE') { message = '응시 자격이 없습니다.<br>데스크에 문의해 주세요.'; }
  else if (failureType === 'TIMEOUT') { message = '접속자가 많아 지연되고 있습니다.<br>잠시 후 다시 시도해 주세요.'; }
  else { message = '시스템 오류가 발생했습니다.'; }
  const html = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"><base target="_top">
      <style>
        * { box-sizing: border-box; } html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
        body { display: flex; justify-content: center; align-items: center; background-color: #dc3545; color: #ffc107; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; text-align: center; }
        .content-wrapper { padding: 4vmin; }
        h1 { font-size: 18vmin; font-weight: 900; line-height: 1.2; margin-bottom: 2vmin; }
        p { font-size: 7vmin; line-height: 1.5; font-weight: 500; }
        .exit-button { margin-top: 4vmin; padding: 1.5vmin 4vmin; font-size: 3.5vmin; border: 2px solid #ffc107; color: #ffc107; background-color: transparent; border-radius: 50px; text-decoration: none; }
        @media (orientation: portrait) { body { position: fixed; top: 50%; left: 50%; width: 100vh; height: 100vw; transform: translate(-50%, -50%) rotate(90deg); transform-origin: center center; } }
      </style>
    </head><body>
      <div class="content-wrapper"><div><h1>${title}</h1><p>${message}</p></div><a href="${url}" class="exit-button">다시 시도</a></div>
    </body></html>
  `;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function createTimeUpHtml(url, now) {
  const startTime = `${ATTENDANCE_START_HOUR.toString().padStart(2, '0')}:${ATTENDANCE_START_MINUTE.toString().padStart(2, '0')}`;
  const endTime = `${ATTENDANCE_END_HOUR.toString().padStart(2, '0')}:${ATTENDANCE_END_MINUTE.toString().padStart(2, '0')}`;
  
  const nowStr = Utilities.formatDate(now, TIMEZONE, 'HH:mm');
  
  const html = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"><base target="_top">
      <style>
        * { box-sizing: border-box; } html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
        body { display: flex; justify-content: center; align-items: center; background-color: #343a40; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; text-align: center; }
        .content-wrapper { padding: 4vmin; }
        h1 { font-size: 10vmin; font-weight: 700; line-height: 1.2; margin-bottom: 2vmin; }
        p { font-size: 5vmin; line-height: 1.5; font-weight: 500; opacity: 0.9; margin-bottom: 4vmin; }
        .time-box { background: rgba(255,255,255,0.1); padding: 3vmin; border-radius: 2vmin; margin-bottom: 4vmin; }
        .time-label { font-size: 3.5vmin; opacity: 0.7; margin-bottom: 1vmin; }
        .time-value { font-size: 6vmin; font-weight: bold; color: #ffc107; }
        .exit-button { display: inline-block; margin-top: 2vmin; padding: 1.5vmin 4vmin; font-size: 4vmin; border: 2px solid #ffffff; color: #ffffff; background-color: transparent; border-radius: 50px; text-decoration: none; }
      </style>
    </head><body>
      <div class="content-wrapper">
        <div>
          <h1>인증 시간이 아닙니다</h1>
          <p>출석 인증은 오전 ${startTime} ~ ${endTime} 사이에만 가능합니다.</p>
          <div class="time-box">
            <div class="time-label">현재 서버 시간</div>
            <div class="time-value">${nowStr}</div>
          </div>
        </div>
        <a href="${url}" class="exit-button">새로고침</a>
      </div>
    </body></html>
  `;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}



