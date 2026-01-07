# Project Handoff: QR Attendance System (알짜수강 인증 QR)

## 1. Project Overview
This project is a Google Apps Script (GAS) web application designed to manage student attendance via QR codes for "한국경찰학원". It allows students to check in using their Student ID and Name, verifies their enrollment, records their attendance in a Google Sheet, and displays their assigned seat number.

## 2. Current Status
The system is fully functional with the following features:
- **Web Interface**: Mobile-responsive web app for student check-in.
- **Authentication**: Validates Student ID and Name against a Google Sheet.
- **Subject Logic**: Automatically determines the subject based on the day of the week (Mon: CrimProc, Tue: Const, Wed: Crim, Thu/Fri: Police).
- **Enrollment Check**: Checks if the student is enrolled in *any* of the subjects to allow access (Relaxed Eligibility).
- **Seat Display**: Shows the student's assigned seat for the day's subject.
- **Attendance Logging**: Records timestamp, student info, and subject code to the '출석로그' sheet.
- **Consecutive Absence Tracking**: Updates absence counts automatically (via `updateConsecutiveAbsencesForToday` function).
- **UI/UX**:
    - "Remember Me" feature using LocalStorage for ID/Name.
    - Day-specific color coding for success screens.
    - Landscape mode enforcement (visual only) for success screens.
    - Watermark background.
    - Loading overlay during processing.
- **Removed Features**: Location-based authentication has been completely removed.

## 3. Technical Architecture
- **Platform**: Google Apps Script (Standalone or Container-bound).
- **Database**: Google Sheets.
    - **Sheet 1: `학생명단` (Student List)**
        - Data starts at Row 5.
        - **Columns**:
            - A: Student ID (수험번호)
            - B: Name (이름)
            - C-F: Seat Numbers (형소, 헌법, 형법, 경찰)
            - G-J: Enrollment Status (O/X)
            - K-N: Consecutive Absences (Count)
    - **Sheet 2: `출석로그` (Attendance Log)**
        - Columns: Date, Time, Student ID, Name, Subject Code.

## 4. Key Files & Functions
### `Code.gs`
The main server-side script containing all logic.

- **Constants**:
    - `STUDENT_SHEET_NAME`: '학생명단'
    - `LOG_SHEET_NAME`: '출석로그'
    - `ATTENDANCE_START_HOUR` / `END_HOUR`: 07:00 ~ 22:00
- **`doGet(e)`**:
    - Handles the HTTP GET request.
    - Checks operating hours.
    - Determines the daily subject.
    - Validates student credentials.
    - Checks enrollment (at least one subject must be 'O').
    - Updates the sheet (resets daily absence count, logs attendance).
    - Returns appropriate HTML (Success, Failure, TimeUp).
- **`getStudentInfo(id, name)`**:
    - Scans `학생명단` to find the student.
    - Returns an object with seat numbers and enrollment status.
    - *Note*: Hides seat numbers for non-enrolled subjects.
- **`updateConsecutiveAbsencesForToday()`**:
    - Intended to be run by a time-driven trigger (e.g., at night).
    - Compares daily logs with the student list to increment absence counts for those who didn't attend.
- **HTML Generators**:
    - `renderForm(url)`: Login page.
    - `createSuccessHtml(...)`: Success page with seat info.
    - `createFailureHtml(...)`: Error page.
    - `createAlreadyCheckedInHtml(...)`: Page for repeat scans.
    - `createTimeUpHtml(...)`: Page for out-of-hours access.

## 5. Recent Changes
- **Location Authentication Removed**: All code related to Geolocation API and distance calculation has been deleted.
- **UI Refinement**:
    - Font sizes increased for better visibility on mobile.
    - `vmin` units used for responsive scaling.
    - Success screen layout optimized.
- **Logic Update**:
    - Enrollment check relaxed: A student enrolled in *any* subject can check in, even if it's not the subject of the day (to allow picking up materials).

## 6. How to Continue
1.  **Open `Code.gs`**: This is the single source of truth for the application logic.
2.  **Deploy**: Remember to deploy as a Web App (Execute as: Me, Access: Anyone) after making changes.
3.  **Triggers**: Ensure a time-driven trigger is set for `updateConsecutiveAbsencesForToday` if automatic absence tracking is needed.

## 7. Future Tasks / Known Issues
-   **Trigger Setup**: Verify if the nightly trigger is actually set up in the GAS editor.
-   **Performance**: `getStudentInfo` performs a linear scan. For very large datasets, this might need optimization (e.g., using a Map or Cache).
