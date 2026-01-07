// =========================
// 성능 측정 도구
// =========================

/**
 * 성능 측정을 위한 유틸리티 클래스
 */
class PerformanceMonitor {
  constructor() {
    this.measurements = {};
  }
  
  start(label) {
    this.measurements[label] = new Date().getTime();
  }
  
  end(label) {
    const startTime = this.measurements[label];
    if (!startTime) {
      Logger.log(`[WARNING] No start time for: ${label}`);
      return null;
    }
    const endTime = new Date().getTime();
    const duration = endTime - startTime;
    Logger.log(`[PERF] ${label}: ${duration}ms`);
    return duration;
  }
  
  measure(label, fn) {
    this.start(label);
    const result = fn();
    this.end(label);
    return result;
  }
}

/**
 * 로그인 성능 테스트 함수
 */
function testLoginPerformance() {
  const monitor = new PerformanceMonitor();
  
  // 테스트용 학생 정보 (실제 데이터로 변경 필요)
  const testStudentId = '1001'; // 실제 수험번호로 변경
  const testStudentName = '홍길동'; // 실제 이름으로 변경
  
  Logger.log('===== 로그인 성능 테스트 시작 =====');
  
  // 1. 전체 로그인 프로세스 시간
  monitor.start('total_login');
  
  // 2. 학생 정보 조회 시간
  monitor.start('get_student_info');
  const studentInfo = getStudentInfo(testStudentId, testStudentName);
  const studentInfoTime = monitor.end('get_student_info');
  
  if (!studentInfo) {
    Logger.log('[ERROR] 학생 정보를 찾을 수 없습니다. 테스트 데이터를 확인하세요.');
    return;
  }
  
  // 3. 공지사항 조회 시간
  monitor.start('get_notice');
  const noticeData = getLatestNotice();
  const noticeTime = monitor.end('get_notice');
  
  // 4. HTML 생성 시간
  monitor.start('create_html');
  const url = ScriptApp.getService().getUrl();
  const html = createSuccessHtml(
    url, 
    studentInfo.id, 
    studentInfo.name, 
    studentInfo.seatCrim, 
    studentInfo.seatCrimProc, 
    studentInfo.seatPolice, 
    studentInfo.seatConst, 
    noticeData
  );
  const htmlTime = monitor.end('create_html');
  
  const totalTime = monitor.end('total_login');
  
  // 결과 요약
  Logger.log('\n===== 성능 테스트 결과 =====');
  Logger.log(`총 로그인 시간: ${totalTime}ms`);
  Logger.log(`- 학생 정보 조회: ${studentInfoTime}ms (${((studentInfoTime/totalTime)*100).toFixed(1)}%)`);
  Logger.log(`- 공지사항 조회: ${noticeTime}ms (${((noticeTime/totalTime)*100).toFixed(1)}%)`);
  Logger.log(`- HTML 생성: ${htmlTime}ms (${((htmlTime/totalTime)*100).toFixed(1)}%)`);
  Logger.log('===========================\n');
  
  return {
    total: totalTime,
    studentInfo: studentInfoTime,
    notice: noticeTime,
    html: htmlTime
  };
}

/**
 * 학생 정보 조회 세부 분석
 */
function analyzeStudentInfoQuery() {
  const monitor = new PerformanceMonitor();
  
  Logger.log('===== 학생 정보 조회 세부 분석 =====');
  
  // 1. 시트 접근 시간
  monitor.start('sheet_access');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STUDENT_SHEET_NAME);
  monitor.end('sheet_access');
  
  if (!sheet) {
    Logger.log('[ERROR] 학생명단 시트를 찾을 수 없습니다.');
    return;
  }
  
  // 2. 행 수 확인 시간
  monitor.start('get_last_row');
  const lastRow = sheet.getLastRow();
  monitor.end('get_last_row');
  
  Logger.log(`총 데이터 행 수: ${lastRow - DATA_START_ROW + 1}`);
  
  // 3. 데이터 읽기 시간
  monitor.start('read_data');
  const data = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 6).getValues();
  const readTime = monitor.end('read_data');
  
  Logger.log(`데이터 크기: ${data.length} 행 x 6 열`);
  Logger.log(`평균 행당 읽기 시간: ${(readTime / data.length).toFixed(2)}ms`);
  
  // 4. 데이터 탐색 시간
  monitor.start('search_data');
  const testId = data[0] ? data[0][COL_ID].toString().trim() : '';
  let found = false;
  for (let i = 0; i < data.length; i++) {
    const idInSheet = (data[i][COL_ID] || '').toString().trim();
    if (idInSheet === testId) {
      found = true;
      break;
    }
  }
  const searchTime = monitor.end('search_data');
  
  Logger.log(`순차 탐색 시간: ${searchTime}ms`);
  Logger.log(`평균 행당 비교 시간: ${(searchTime / data.length).toFixed(3)}ms`);
  Logger.log('=====================================\n');
}

/**
 * QR 스캔 저장 성능 테스트
 */
function testQRScanPerformance() {
  const monitor = new PerformanceMonitor();
  
  // 테스트용 학생 ID (실제 데이터로 변경 필요)
  const testStudentId = '1001'; // 실제 수험번호로 변경
  
  Logger.log('===== QR 스캔 저장 성능 테스트 시작 =====');
  
  monitor.start('total_qr_scan');
  
  // 주의: 실제 데이터를 저장하므로 테스트 후 원복 필요
  // const result = recordDistribution(testStudentId);
  
  // 대신 각 단계별 시간만 측정
  
  // 1. 학생명단 시트 읽기
  monitor.start('read_student_sheet');
  const studentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STUDENT_SHEET_NAME);
  const studentLastRow = studentSheet.getLastRow();
  const studentData = studentSheet.getRange(DATA_START_ROW, 1, studentLastRow - DATA_START_ROW + 1, 6).getValues();
  monitor.end('read_student_sheet');
  
  // 2. 자료배부기록 시트 읽기
  monitor.start('read_distribution_sheet');
  const distSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DISTRIBUTION_SHEET_NAME);
  const distLastRow = distSheet.getLastRow();
  const idValues = distSheet.getRange(DISTRIBUTION_START_ROW, DISTRIBUTION_ID_COL, distLastRow - DISTRIBUTION_START_ROW + 1, 1).getValues();
  monitor.end('read_distribution_sheet');
  
  // 3. 학생 찾기
  monitor.start('find_student');
  let targetRow = -1;
  for (let i = 0; i < idValues.length; i++) {
    const idInSheet = (idValues[i][0] || '').toString().trim();
    if (idInSheet === testStudentId) {
      targetRow = i + DISTRIBUTION_START_ROW;
      break;
    }
  }
  monitor.end('find_student');
  
  if (targetRow === -1) {
    Logger.log('[WARNING] 테스트 학생 ID를 찾을 수 없습니다.');
    return;
  }
  
  // 4. 각 과목별 데이터 읽기 (여러 번 읽기 - 병목!)
  const subjectCodes = ['CRIM', 'CRIMPROC', 'POLICE', 'CONST'];
  monitor.start('read_subject_data');
  for (let code of subjectCodes) {
    const config = DISTRIBUTION_SUBJECT_COLUMNS[code];
    if (config) {
      const rowValues = distSheet.getRange(targetRow, config.startCol, 1, config.count).getValues()[0];
    }
  }
  const subjectReadTime = monitor.end('read_subject_data');
  
  Logger.log(`과목별 개별 읽기 시간: ${subjectReadTime}ms (${subjectCodes.length}회 읽기)`);
  Logger.log(`평균 읽기당 시간: ${(subjectReadTime / subjectCodes.length).toFixed(2)}ms`);
  
  const totalTime = monitor.end('total_qr_scan');
  
  Logger.log('\n===== QR 스캔 성능 테스트 결과 =====');
  Logger.log(`총 처리 시간: ${totalTime}ms`);
  Logger.log('====================================\n');
}

/**
 * 데이터 크기 분석
 */
function analyzeDataSize() {
  Logger.log('===== 데이터 크기 분석 =====');
  
  const studentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STUDENT_SHEET_NAME);
  const distSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DISTRIBUTION_SHEET_NAME);
  const noticeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOTICE_SHEET_NAME);
  
  Logger.log(`학생명단 총 행수: ${studentSheet.getLastRow()}`);
  Logger.log(`학생명단 데이터 행수: ${studentSheet.getLastRow() - DATA_START_ROW + 1}`);
  Logger.log(`자료배부기록 총 행수: ${distSheet.getLastRow()}`);
  Logger.log(`자료배부기록 데이터 행수: ${distSheet.getLastRow() - DISTRIBUTION_START_ROW + 1}`);
  Logger.log(`공지사항 총 행수: ${noticeSheet ? noticeSheet.getLastRow() : 0}`);
  Logger.log('===========================\n');
}

/**
 * 전체 성능 테스트 실행
 */
function runAllPerformanceTests() {
  Logger.log('\n\n========================================');
  Logger.log('     전체 성능 테스트 실행');
  Logger.log('========================================\n');
  
  analyzeDataSize();
  analyzeStudentInfoQuery();
  testLoginPerformance();
  testQRScanPerformance();
  
  Logger.log('\n========================================');
  Logger.log('     성능 테스트 완료');
  Logger.log('========================================\n');
  
  Logger.log('\n추천 사항:');
  Logger.log('1. Apps Script 편집기에서 "보기 > 로그" 메뉴를 열어 결과를 확인하세요.');
  Logger.log('2. testLoginPerformance() 함수의 testStudentId와 testStudentName을 실제 데이터로 수정하세요.');
  Logger.log('3. 각 단계별 실행 시간을 확인하여 병목 지점을 파악하세요.');
}
