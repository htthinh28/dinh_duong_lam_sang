// ============================================================================
// HỆ THỐNG QUẢN LÝ DINH DƯỠNG LÂM SÀNG - BACKEND (Google Apps Script)
// Đơn vị: BVQT Phương Châu Sóc Trăng
// Quản lý: BS. Hồ Tấn Thịnh
// Tiêu chuẩn: JCI (MCI.19, COP.3, SQE.8 - Phân quyền & Bảo mật)
// Phiên bản: 5.4 (Module Thư viện — iframe + GitHub Pages)
// ============================================================================

// ============================================================================
// --- 1. CORE: KHỞI TẠO ỨNG DỤNG WEB ---
// ============================================================================

function doGet(e) {
  e = e || {};
  if (String(e.parameter.page || "") === "thuVien") {
    return renderThuVienShellPage_();
  }
  var tpl = HtmlService.createTemplateFromFile('index');
  tpl.THU_VIEN_CDN_URL = getThuVienCdnUrl_();
  tpl.THU_VIEN_SHELL_URL = getThuVienShellUrl_();
  return tpl.evaluate()
    .setTitle('CDSS — Hỗ trợ ra quyết định lâm sàng')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Trang shell text/html: toolbar + iframe CDN (tránh fetch 30MB bằng JS và text/plain trên WebView). */
function renderThuVienShellPage_() {
  var tpl = HtmlService.createTemplateFromFile('thuVienShell');
  tpl.SOURCE_URLS_JSON = JSON.stringify(getThuVienEmbedUrls());
  return tpl.evaluate()
    .setTitle('Thư viện tra cứu — TĐYT Phương Châu')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** URL CDN thư viện (nhánh gh-pages). Lưu ý: statically.io trả text/plain — chỉ dùng qua thuVienShell. */
function getThuVienCdnUrl_() {
  return "https://cdn.statically.io/gh/htthinh28/dinh_duong_lam_sang@gh-pages/index.html";
}

/** URL shell Apps Script (?page=thuVien) — inject vào index, không cần google.script.run khi mở tab Thư viện. */
function getThuVienShellUrl_() {
  try {
    var u = ScriptApp.getService().getUrl();
    if (!u) return "";
    var base = String(u).split("#")[0];
    var q = base.indexOf("?");
    if (q >= 0) base = base.substring(0, q);
    return base + "?page=thuVien";
  } catch (e) {
    return "";
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** URL web app công khai (để hiển thị link đăng nhập). */
function getPublicWebAppUrl() {
  try {
    var u = ScriptApp.getService().getUrl();
    return u ? String(u) : "";
  } catch (e) {
    return "";
  }
}

/** Tự thêm THU_VIEN_URL vào SYS_CONFIG nếu sheet cũ chưa có dòng này. */
function ensureThuVienUrlInSheet_() {
  try {
    var ss = getDatabase();
    var sheet = ss.getSheetByName("SYS_CONFIG");
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    var i;
    for (i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === "THU_VIEN_URL") return;
    }
    sheet.appendRow(["THU_VIEN_URL", getThuVienCdnUrl_(), "URL nhúng thư viện tra cứu", "TEXT"]);
  } catch (e) {
    Logger.log("ensureThuVienUrlInSheet_: " + e);
  }
}

/** Danh sách URL host thư viện (thử lần lượt nếu iframe lỗi). */
function getThuVienEmbedUrls() {
  ensureThuVienUrlInSheet_();
  var defaults = [
    getThuVienCdnUrl_(),
    "https://htthinh28.github.io/dinh_duong_lam_sang/"
  ];
  var urls = [];
  var custom = "";
  try {
    var ss = getDatabase();
    var sheet = ss.getSheetByName("SYS_CONFIG");
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      var i;
      for (i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === "THU_VIEN_URL" && data[i][1]) {
          custom = String(data[i][1]).trim();
          break;
        }
      }
    }
  } catch (e) {
    Logger.log("getThuVienEmbedUrls: " + e);
  }
  if (custom) {
    if (custom.indexOf("github.io") >= 0) {
      custom = custom.replace(/\/thu-vien\/?$/i, "/");
    }
    urls.push(custom);
  }
  defaults.forEach(function (u) {
    if (urls.indexOf(u) < 0) urls.push(u);
  });
  return urls;
}

/** URL trang thư viện (tương thích cũ). */
function getThuVienEmbedUrl() {
  var list = getThuVienEmbedUrls();
  return list.length ? list[0] : getThuVienCdnUrl_();
}

/**
 * Đăng ký tài khoản nhân viên — chờ duyệt (Status PENDING_APPROVAL).
 */
function registerStaffPending(data) {
  if (!data || !data.email || !data.password || !data.fullName) {
    return { error: "Thiếu email, mật khẩu hoặc họ tên." };
  }
  if (!data.jobTitle || !data.phone || !data.practiceCertificate || !data.practiceScope) {
    return { error: "Thiếu chức danh, SĐT, chứng chỉ hoặc phạm vi hành nghề." };
  }
  var sheet = getUsersSheetReady_();
  var all = sheet.getDataRange().getValues();
  var email = String(data.email).trim().toLowerCase();
  var i;
  for (i = 1; i < all.length; i++) {
    if (String(all[i][0]).trim().toLowerCase() === email) {
      return { error: "Email này đã được đăng ký hoặc đang chờ duyệt." };
    }
  }
  var now = new Date();
  sheet.appendRow([
    email,
    String(data.password),
    data.fullName,
    "USER",
    "PENDING_APPROVAL",
    "",
    data.jobTitle,
    data.phone,
    data.practiceCertificate,
    data.practiceScope,
    now,
    now,
    "",
    ""
  ]);
  writeAppLog_("AUTH", "REGISTER_PENDING", email, email, { fullName: data.fullName }, "SUCCESS");
  return { success: true, message: "Đã gửi đăng ký. Tài khoản sẽ hoạt động sau khi quản trị duyệt." };
}

// ============================================================================
// --- 2. DATABASE: KẾT NỐI & CẤU TRÚC DỮ LIỆU ---
// ============================================================================

/**
 * ID Google Sheet trung tâm (từ URL .../d/THIS_ID/edit).
 * Để trống "" để chỉ dùng file tên DB_DinhDuong_PhuongChau trên Drive (hành vi cũ).
 * Ưu tiên: Thuộc tính dự án DB_SPREADSHEET_ID (nếu đặt) > hằng số này.
 */
var DEFAULT_DB_SPREADSHEET_ID = "1wihWezPxcFWhVCOkbhTZMpQ60-J7LfSBZjTF-P80ZNg";

function resolveSpreadsheetDbId_() {
  var prop = PropertiesService.getScriptProperties().getProperty("DB_SPREADSHEET_ID");
  if (prop && String(prop).trim()) return String(prop).trim();
  if (DEFAULT_DB_SPREADSHEET_ID && String(DEFAULT_DB_SPREADSHEET_ID).trim()) {
    return String(DEFAULT_DB_SPREADSHEET_ID).trim();
  }
  return "";
}

/**
 * Mở spreadsheet trung tâm — KHÔNG migrate schema.
 * Dùng cho đăng nhập / ping để tránh timeout hoặc lỗi RESEARCH_NC chặn auth.
 */
function openCentralSpreadsheet_() {
  var id = resolveSpreadsheetDbId_();
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      throw new Error("Không mở được Google Sheet ID đã cấu hình. Kiểm tra quyền tài khoản chạy web app. " + (e.message || e));
    }
  }
  var dbName = "DB_DinhDuong_PhuongChau";
  var files = DriveApp.getFilesByName(dbName);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  // Chưa có DB → khởi tạo đầy đủ một lần
  return getDatabase();
}

/**
 * Kết nối đến File Google Sheet trung tâm.
 * Khi DEFAULT_DB_SPREADSHEET_ID (hoặc DB_SPREADSHEET_ID) được đặt: mọi API (lưu hồ sơ, đăng nhập, CRUD, cấu hình…)
 * đều đọc/ghi trên đúng file đó — có thể coi là cập nhật thẳng lên sheet đã chia sẻ.
 * Nếu không có ID: tìm file tên DB_DinhDuong_PhuongChau trên Drive; không có nữa thì tạo file mới.
 * Tự động bổ sung sheet/cột thiếu (không xóa Sheet1 trên file đã có).
 */
function getDatabase() {
  var id = resolveSpreadsheetDbId_();
  if (id) {
    var ssById;
    try {
      ssById = SpreadsheetApp.openById(id);
    } catch (e) {
      Logger.log("openById: " + e);
      throw new Error("Không mở được Google Sheet (kiểm tra ID và quyền truy cập tài khoản chạy script). " + e.message);
    }
    setupDatabaseStructure(ssById, { preserveSheet1: true });
    migrateDatabaseIfNeeded(ssById);
    return ssById;
  }

  var dbName = "DB_DinhDuong_PhuongChau";
  var files = DriveApp.getFilesByName(dbName);
  var ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
    setupDatabaseStructure(ss, { preserveSheet1: true });
    migrateDatabaseIfNeeded(ss);
    return ss;
  }
  ss = SpreadsheetApp.create(dbName);
  setupDatabaseStructure(ss, { preserveSheet1: false });
  migrateDatabaseIfNeeded(ss);
  return ss;
}

function migrateDatabaseIfNeeded(ss) {
  try {
    var rec = ss.getSheetByName("RECORDS");
    if (rec) ensureRecordsSchema_(rec);
  } catch (e) {
    Logger.log("migrate RECORDS: " + e);
  }
  try {
    ensureResearchNcSheet_(ss);
  } catch (e) {
    // Không để migrate RESEARCH_NC chặn đăng nhập / API khác
    Logger.log("migrate RESEARCH_NC: " + e);
  }
}

/**
 * Chạy thủ công trong Trình soạn Apps Script: kiểm tra/bổ sung sheet RECORDS (cột Diet_Prep), các sheet hệ thống.
 * @returns {string} Báo cáo nhanh
 */
function repairDatabaseSchemaNow() {
  var ss = getDatabase();
  setupDatabaseStructure(ss, { preserveSheet1: true });
  migrateDatabaseIfNeeded(ss);
  var names = ss.getSheets().map(function (s) { return s.getName(); });
  var rec = ss.getSheetByName("RECORDS");
  var hdr = "—";
  if (rec && rec.getLastColumn() > 0) {
    hdr = rec.getRange(1, 1, 1, rec.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); }).join(" | ");
  }
  return "Đã đồng bộ. Sheets: " + names.join(", ") + "\nRECORDS hàng 1: " + hdr;
}

/**
 * Hàm khởi tạo/Kiểm tra cấu trúc bảng (Chạy 1 lần hoặc khi thiếu sheet)
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {{preserveSheet1?: boolean}} options preserveSheet1=false chỉ khi vừa SpreadsheetApp.create (xóa Sheet1 mặc định).
 */
function setupDatabaseStructure(ss, options) {
  if (!ss) ss = getDatabase();
  var preserveSheet1 = !options || options.preserveSheet1 !== false;

  // 1. Sheet USERS (Quản trị người dùng & Bảo mật)
  if (!ss.getSheetByName("USERS")) {
    let s = ss.insertSheet("USERS");
    s.appendRow([
      "Email", "Password", "FullName", "Role", "Status", "LastLogin",
      "JobTitle", "Phone", "PracticeCertificate", "PracticeScope",
      "CreatedAt", "UpdatedAt", "ResetCode", "ResetCodeExpireAt"
    ]);
    // Admin mặc định
    s.appendRow([
      "admin@phuongchau.com", "123456", "BS. Hồ Tấn Thịnh", "ADMIN", "ACTIVE", new Date(),
      "Quản trị hệ thống", "", "", "", new Date(), new Date(), "", ""
    ]);
    // Định dạng cột Password là văn bản để giữ số 0 hoặc chuỗi số
    s.getRange("B:B").setNumberFormat("@"); 
    s.setFrozenRows(1);
  } else {
    ensureUsersSchema_(ss.getSheetByName("USERS"));
  }

  // 2. Sheet RECORDS (Hồ sơ bệnh án dinh dưỡng - MCI.19)
  if (!ss.getSheetByName("RECORDS")) {
    let s = ss.insertSheet("RECORDS");
    s.appendRow([
      "Timestamp", "PatientID", "Name", "DOB", "Gender", 
      "Height_cm", "Weight_kg", "BMI", "Diagnosis",
      "Waist_cm", "Hip_cm", "WHR", "WHR_Class", "GripStrength_kg", "GripStrength_Class",
      "Diet_Code", "Kcal_Target", "Protein_Target", "Menu_JSON", "Doctor", "Diet_Prep",
      "FullSnapshot_JSON"
    ]);
    s.setFrozenRows(1);
  }

  // 3. Sheet FOOD_DB (Kho thực phẩm)
  if (!ss.getSheetByName("FOOD_DB")) {
    let s = ss.insertSheet("FOOD_DB");
    s.appendRow(["ID", "Name", "Unit", "Kcal", "Protein", "Lipid", "Glucid", "Category", "Tag"]);
    // Dữ liệu mẫu
    s.appendRow(["S01", "Cơm trắng", "g", 344, 7.9, 1.0, 76, "STARCH", "NORMAL"]);
    s.setFrozenRows(1);
  }

  // 4. Sheet DISEASE_DB (Danh mục bệnh lý - ICD10)
  if (!ss.getSheetByName("DISEASE_DB")) {
    let s = ss.insertSheet("DISEASE_DB");
    s.appendRow(["Code", "Name", "Group_Code"]);
    s.appendRow(["E11", "Đái tháo đường Type 2", "DM"]);
    s.setFrozenRows(1);
  }

  // 5. Sheet SYS_CONFIG (Cấu hình hệ thống động)
  if (!ss.getSheetByName("SYS_CONFIG")) {
    let s = ss.insertSheet("SYS_CONFIG");
    s.appendRow(["Key", "Value", "Description", "Type"]);
    s.appendRow(["HOSPITAL_NAME", "ỨNG DỤNG HỖ TRỢ RA QUYẾT ĐỊNH LÂM SÀNG (CDSS)", "Tên hiển thị", "TEXT"]);
    s.appendRow(["THU_VIEN_URL", getThuVienCdnUrl_(), "URL nhúng thư viện tra cứu", "TEXT"]);
    s.appendRow(["MODULE_1_ACTIVE", "TRUE", "Bật module Tiếp nhận", "BOOLEAN"]);
    s.setFrozenRows(1);
  }

  // 6. Sheet DB_REFERENCES (Tài liệu tham khảo & Knowledge Base) - NEW
  if (!ss.getSheetByName("DB_REFERENCES")) {
    let s = ss.insertSheet("DB_REFERENCES");
    // ID | Category | Title | Type (LINK/TEXT/FILE) | Content (URL or Text) | Tags | AddedBy | Time
    s.appendRow(["RefID", "Category", "Title", "Type", "Content", "Tags", "AddedBy", "Timestamp"]);
    s.setFrozenRows(1);
  }

  // 7. Sheet DOCTORS (Danh sách bác sĩ khám bệnh)
  if (!ss.getSheetByName("DOCTORS")) {
    let s = ss.insertSheet("DOCTORS");
    s.appendRow(["DoctorID", "FullName", "Specialty", "AccountEmail", "Status", "CreatedAt"]);
    s.appendRow(["DR001", "BS. Hồ Tấn Thịnh", "Dinh dưỡng lâm sàng", "admin@phuongchau.com", "ACTIVE", new Date()]);
    s.setFrozenRows(1);
  }

  // 8. Sheet APP_LOGS (Nhật ký hệ thống)
  if (!ss.getSheetByName("APP_LOGS")) {
    let s = ss.insertSheet("APP_LOGS");
    s.appendRow(["Timestamp", "EventType", "Action", "Actor", "Target", "Status", "Details_JSON"]);
    s.setFrozenRows(1);
  }

  // 9. Sheet RECORDS_AUDIT_ALL (Lưu toàn bộ snapshot nhập liệu 1-5)
  if (!ss.getSheetByName("RECORDS_AUDIT_ALL")) {
    let s = ss.insertSheet("RECORDS_AUDIT_ALL");
    s.appendRow(["Timestamp", "PatientID", "PatientName", "Doctor", "DietCode", "Snapshot_JSON"]);
    s.setFrozenRows(1);
  }

  // 10. Sheet RESEARCH_NC — Phiếu thu thập số liệu nghiên cứu (mã phẳng)
  if (!ss.getSheetByName("RESEARCH_NC")) {
    var sNc = ss.insertSheet("RESEARCH_NC");
    sNc.appendRow(getResearchNcHeaders_());
    sNc.setFrozenRows(1);
  }

  // 11. Sheet RESEARCH_COLLECT (Phiếu thu thập số liệu nghiên cứu - CRF)
  if (!ss.getSheetByName("RESEARCH_COLLECT")) {
    let s = ss.insertSheet("RESEARCH_COLLECT");
    s.appendRow([
      "Timestamp", "NguoiNhap", "PatientID", "PatientName", "NgayNhap",
      "StopBang", "PHQ9", "PhacDoThuoc", "Form_JSON"
    ]);
    s.setFrozenRows(1);
  }

  if (!preserveSheet1) {
    var sheet1 = ss.getSheetByName("Sheet1");
    if (sheet1) ss.deleteSheet(sheet1);
  }
}

function writeAppLog_(eventType, action, actor, target, details, status, ssOpt) {
  try {
    var ss = ssOpt || getDatabase();
    var sheet = ss.getSheetByName("APP_LOGS");
    if (!sheet) {
      setupDatabaseStructure(ss, { preserveSheet1: true });
      sheet = ss.getSheetByName("APP_LOGS");
    }
    if (!sheet) return;
    var detailsJson = "";
    try {
      detailsJson = JSON.stringify(details || {});
    } catch (_) {
      detailsJson = String(details || "");
    }
    sheet.appendRow([
      new Date(),
      String(eventType || "SYSTEM"),
      String(action || ""),
      String(actor || "SYSTEM"),
      String(target || ""),
      String(status || "INFO"),
      detailsJson
    ]);
  } catch (e) {
    Logger.log("writeAppLog_ failed: " + e);
  }
}

function writeRecordAuditAll_(data, ssOpt) {
  try {
    var ss = ssOpt || getDatabase();
    var sheet = ss.getSheetByName("RECORDS_AUDIT_ALL");
    if (!sheet) {
      setupDatabaseStructure(ss, { preserveSheet1: true });
      sheet = ss.getSheetByName("RECORDS_AUDIT_ALL");
    }
    if (!sheet) return;
    sheet.appendRow([
      new Date(),
      (data && data.id) ? ("'" + data.id) : "",
      (data && data.name) || "",
      (data && data.doctor) || "",
      (data && data.dietCode) || "",
      (data && data.fullSnapshotJson) || ""
    ]);
  } catch (e) {
    Logger.log("writeRecordAuditAll_ failed: " + e);
  }
}

function ensureUsersSchema_(sheet) {
  if (!sheet) return;
  var requiredHeaders = [
    "Email", "Password", "FullName", "Role", "Status", "LastLogin",
    "JobTitle", "Phone", "PracticeCertificate", "PracticeScope",
    "CreatedAt", "UpdatedAt", "ResetCode", "ResetCodeExpireAt"
  ];
  var lc = sheet.getLastColumn();
  if (lc < 1) {
    sheet.appendRow(requiredHeaders);
    try { sheet.getRange(1, 2, Math.max(2, sheet.getMaxRows()), 2).setNumberFormat("@"); } catch (_) {}
    return;
  }
  var headers = sheet.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim(); });
  // Chỉ sửa header lệch phổ biến khi đúng vị trí cột 9–10 (index 8–9) và giá trị rõ ràng sai.
  if (headers[7] === "JobTitle" && headers[8] === "Phone" && headers[9] === "Phone") {
    sheet.getRange(1, 10).setValue("PracticeScope");
  }
  requiredHeaders.forEach(function (header) {
    if (headers.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headers.push(header);
    }
  });
  try {
    var passIdx = headers.indexOf("Password");
    if (passIdx >= 0) sheet.getRange(1, passIdx + 1, Math.max(2, sheet.getMaxRows()), passIdx + 1).setNumberFormat("@");
  } catch (_) {}
}

/** Chuẩn hóa mật khẩu đọc từ ô Sheets (số / ngày / chuỗi). */
function normalizePasswordValue_(value, displayOpt) {
  var disp = displayOpt != null ? String(displayOpt).trim() : "";
  if (value == null || value === "") return disp;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return disp || Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyyMMdd");
  }
  if (typeof value === "number") {
    if (!isFinite(value)) return disp;
    // Tránh 1.23456E+10 — dùng display nếu có và hợp lý
    if (disp && disp.indexOf("E") < 0 && disp.indexOf("e") < 0) return disp;
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    return String(value);
  }
  var s = String(value).trim();
  // Sheets đôi khi thêm dấu ' đầu chuỗi văn bản
  if (s.charAt(0) === "'") s = s.substring(1);
  return s;
}

function normalizeEmailValue_(value) {
  return String(value == null ? "" : value).trim().toLowerCase();
}

function normalizeHeaderKey_(value) {
  return String(value == null ? "" : value)
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeUserStatus_(value) {
  var status = String(value == null ? "" : value).trim().toUpperCase();
  if (!status) return "ACTIVE";
  if (status === "1" || status === "YES" || status === "Y" || status === "OK" || status === "ENABLED") return "ACTIVE";
  return status;
}

/** So khớp mật khẩu — thử mọi biến thể Sheets hay gặp (số, display, dấu '). */
function passwordsMatch_(rawValue, displayValue, inputPass) {
  var passIn = String(inputPass == null ? "" : inputPass).trim();
  if (!passIn) return false;

  var candidates = [];
  function pushCandidate(v) {
    if (v == null || v === "") return;
    var s = String(v).trim();
    if (!s) return;
    if (candidates.indexOf(s) < 0) candidates.push(s);
    if (s.charAt(0) === "'") {
      var stripped = s.substring(1);
      if (stripped && candidates.indexOf(stripped) < 0) candidates.push(stripped);
    }
  }

  pushCandidate(normalizePasswordValue_(rawValue, displayValue));
  pushCandidate(displayValue);
  pushCandidate(rawValue);
  if (typeof rawValue === "number" && isFinite(rawValue)) {
    pushCandidate(String(rawValue));
    if (Math.abs(rawValue - Math.round(rawValue)) < 1e-9) pushCandidate(String(Math.round(rawValue)));
  }

  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i] === passIn) return true;
  }
  return false;
}

/** Ghi log auth nhẹ — không tạo sheet / migrate khi đăng nhập. */
function writeAuthLogLite_(ss, eventType, action, actor, target, details, status) {
  try {
    if (!ss) return;
    var sheet = ss.getSheetByName("APP_LOGS");
    if (!sheet) return;
    var detailsJson = "";
    try { detailsJson = JSON.stringify(details || {}); } catch (_) { detailsJson = String(details || ""); }
    sheet.appendRow([
      new Date(),
      String(eventType || "AUTH"),
      String(action || ""),
      String(actor || ""),
      String(target || ""),
      String(status || "INFO"),
      detailsJson
    ]);
  } catch (e) {
    Logger.log("writeAuthLogLite_ failed: " + e);
  }
}

/**
 * RPC siêu nhẹ — không đụng Spreadsheet.
 * Dùng để phân biệt: google.script.run bị treo vs lỗi Database.
 */
function rpcEcho() {
  return {
    ok: true,
    echo: true,
    t: Date.now(),
    release: "5.8.7"
  };
}

/**
 * API Đăng nhập hệ thống — read-only, không migrate/format sheet (tránh timeout).
 */
function loginUser(email, password) {
  try {
    var emailIn = normalizeEmailValue_(email);
    var passIn = String(password == null ? "" : password).trim();
    if (!emailIn || !passIn) return { error: "Vui lòng nhập email và mật khẩu.", code: "MISSING_INPUT" };

    var ss = openCentralSpreadsheet_();
    var sheet = ss.getSheetByName("USERS");
    if (!sheet) return { error: "Không tìm thấy bảng USERS trong Database.", code: "NO_USERS_SHEET" };

    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2 || lastCol < 1) return { error: "Chưa có tài khoản trong hệ thống.", code: "NO_USERS" };

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var idxMap = getUsersColumnIndexMap_(headers);
    var cEmail = resolveUsersColumnIndex_(headers, idxMap, "Email", 0);
    var cPass = resolveUsersColumnIndex_(headers, idxMap, "Password", 1);
    var cName = resolveUsersColumnIndex_(headers, idxMap, "FullName", 2);
    var cRole = resolveUsersColumnIndex_(headers, idxMap, "Role", 3);
    var cStatus = resolveUsersColumnIndex_(headers, idxMap, "Status", 4);
    var cLast = resolveUsersColumnIndex_(headers, idxMap, "LastLogin", 5);

    if (cEmail < 0 || cPass < 0) {
      return {
        error: "Bảng USERS thiếu cột Email hoặc Password. Header dòng 1: " + headers.join(" | "),
        code: "BAD_HEADERS"
      };
    }

    var values = sheet.getRange(2, 1, lastRow, lastCol).getValues();
    var displays = sheet.getRange(2, 1, lastRow, lastCol).getDisplayValues();

    for (var i = 0; i < values.length; i++) {
      var rowEmail = normalizeEmailValue_(values[i][cEmail]);
      if (!rowEmail) continue;
      if (rowEmail !== emailIn) continue;

      if (!passwordsMatch_(values[i][cPass], displays[i][cPass], passIn)) continue;

      var status = normalizeUserStatus_(getCellSafe_(values[i], cStatus));

      if (status === "PENDING_APPROVAL") {
        writeAuthLogLite_(ss, "AUTH", "LOGIN", emailIn, emailIn, { reason: "PENDING_APPROVAL" }, "FAILED");
        return { error: "Tài khoản đang chờ quản trị duyệt. Vui lòng liên hệ quản trị.", code: "PENDING" };
      }
      if (status !== "ACTIVE") {
        writeAuthLogLite_(ss, "AUTH", "LOGIN", emailIn, emailIn, { reason: "INACTIVE", status: status }, "FAILED");
        return { error: "Tài khoản đã bị KHÓA hoặc chưa kích hoạt (Status=" + status + ").", code: "INACTIVE" };
      }

      try {
        if (cLast >= 0) sheet.getRange(i + 2, cLast + 1).setValue(new Date());
      } catch (_) {}
      writeAuthLogLite_(ss, "AUTH", "LOGIN", emailIn, emailIn, { role: getCellSafe_(values[i], cRole) }, "SUCCESS");

      return {
        success: true,
        user: {
          email: String(getCellSafe_(values[i], cEmail)).trim(),
          name: String(getCellSafe_(values[i], cName) || "").trim(),
          role: String(getCellSafe_(values[i], cRole) || "USER").trim()
        }
      };
    }

    writeAuthLogLite_(ss, "AUTH", "LOGIN", emailIn, emailIn, { reason: "INVALID_CREDENTIALS" }, "FAILED");
    return { error: "Sai Email hoặc Mật khẩu!", code: "BAD_CREDENTIALS" };
  } catch (e) {
    Logger.log("loginUser error: " + e);
    return { error: "Lỗi đăng nhập: " + (e.message || String(e)), code: "SERVER_ERROR" };
  }
}

/**
 * Kiểm tra nhanh đường ống auth (gọi từ màn login).
 * Giữ nhẹ: chỉ đọc header + đếm dòng, không migrate.
 */
function pingAuth() {
  try {
    var ss = openCentralSpreadsheet_();
    var sheet = ss.getSheetByName("USERS");
    var userCount = 0;
    var activeCount = 0;
    var headers = [];
    var columns = { email: -1, password: -1, status: -1 };
    if (sheet) {
      var lastCol = sheet.getLastColumn();
      var lastRow = sheet.getLastRow();
      if (lastCol > 0 && lastRow > 0) {
        headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
          return String(h || "").replace(/^\uFEFF/, "").trim();
        });
        var idxMap = getUsersColumnIndexMap_(headers);
        columns.email = resolveUsersColumnIndex_(headers, idxMap, "Email", 0);
        columns.password = resolveUsersColumnIndex_(headers, idxMap, "Password", 1);
        columns.status = resolveUsersColumnIndex_(headers, idxMap, "Status", 4);
        if (lastRow >= 2) {
          userCount = lastRow - 1;
          // Đếm ACTIVE tối đa 200 dòng đầu để tránh chậm
          var scanTo = Math.min(lastRow, 201);
          var statusCol = columns.status;
          if (statusCol >= 0) {
            var statuses = sheet.getRange(2, statusCol + 1, scanTo, statusCol + 1).getValues();
            for (var i = 0; i < statuses.length; i++) {
              if (normalizeUserStatus_(statuses[i][0]) === "ACTIVE") activeCount++;
            }
          } else {
            activeCount = userCount;
          }
        }
      }
    }
    // Không đọc email người chạy ở đây: API đó thêm scope OAuth 'userinfo.email',
    // khiến web app (executeAs USER_DEPLOYING) hỏng uỷ quyền và google.script.run
    // treo -> đăng nhập lỗi (regression từ v70). Giữ scope tối thiểu như bản v69.
    var eff = "";
    return {
      ok: true,
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      usersSheet: !!sheet,
      userCount: userCount,
      activeCount: activeCount,
      columns: columns,
      headers: headers.slice(0, 10),
      effectiveUser: eff,
      release: "5.8.7"
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e), release: "5.8.7" };
  }
}

/**
 * API Tạo User mới (Dành cho Admin Panel)
 */
function createNewUser(data) {
  // Validate Domain (Tùy chọn)
  if (!data.email.endsWith("@phuongchau.com")) {
    // return { error: "Email phải có đuôi @phuongchau.com" }; // Bỏ comment nếu muốn bắt buộc
  }
  
  const ss = getDatabase();
  const sheet = ss.getSheetByName("USERS");
  ensureUsersSchema_(sheet);
  const now = new Date();
  const users = sheet.getDataRange().getValues();
  
  // Check trùng
  for(let i=1; i<users.length; i++) {
    if(users[i][0] == data.email) return { error: "Email này đã tồn tại!" };
  }

  sheet.appendRow([
    data.email, 
    data.password, 
    data.fullname, 
    data.role, 
    "ACTIVE", 
    now,
    data.jobTitle || "",
    data.phone || "",
    data.practiceCertificate || "",
    data.practiceScope || "",
    now,
    now,
    "",
    ""
  ]);
  return { success: true, message: "Tạo user thành công!" };
}

/**
 * API Đổi mật khẩu
 */
function changeUserPassword(email, oldPass, newPass) {
  try {
    var ss = openCentralSpreadsheet_();
    var sheet = ss.getSheetByName("USERS");
    if (!sheet) return { error: "Không tìm thấy bảng USERS." };

    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { error: "Chưa có tài khoản." };

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var idxMap = getUsersColumnIndexMap_(headers);
    var cEmail = resolveUsersColumnIndex_(headers, idxMap, "Email", 0);
    var cPass = resolveUsersColumnIndex_(headers, idxMap, "Password", 1);
    if (cEmail < 0 || cPass < 0) return { error: "Sheet USERS thiếu cột Email hoặc Password." };

    var emailIn = normalizeEmailValue_(email);
    var oldIn = String(oldPass == null ? "" : oldPass).trim();
    var newIn = String(newPass == null ? "" : newPass).trim();
    if (!emailIn || !oldIn || !newIn) return { error: "Thiếu thông tin đổi mật khẩu." };

    var values = sheet.getRange(2, 1, lastRow, lastCol).getValues();
    var displays = sheet.getRange(2, 1, lastRow, lastCol).getDisplayValues();

    for (var i = 0; i < values.length; i++) {
      if (normalizeEmailValue_(values[i][cEmail]) !== emailIn) continue;
      if (!passwordsMatch_(values[i][cPass], displays[i][cPass], oldIn)) {
        return { error: "Mật khẩu cũ không đúng!" };
      }
      sheet.getRange(i + 2, cPass + 1).setValue(newIn);
      writeAuthLogLite_(ss, "USER", "CHANGE_PASSWORD", emailIn, emailIn, {}, "SUCCESS");
      return { success: true, message: "Đổi mật khẩu thành công!" };
    }
    writeAuthLogLite_(ss, "USER", "CHANGE_PASSWORD", emailIn, emailIn, { reason: "ACCOUNT_NOT_FOUND" }, "FAILED");
    return { error: "Không tìm thấy tài khoản." };
  } catch (e) {
    return { error: "Lỗi đổi mật khẩu: " + (e.message || String(e)) };
  }
}

/**
 * API Admin Action: Khóa/Mở/Reset
 */
function adminUserAction(targetEmail, action) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("USERS");
  ensureUsersSchema_(sheet);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == targetEmail) {
      if (action === 'LOCK') sheet.getRange(i + 1, 5).setValue('LOCKED');
      if (action === 'UNLOCK') sheet.getRange(i + 1, 5).setValue('ACTIVE');
      if (action === 'RESET_PASS') sheet.getRange(i + 1, 2).setValue('123456');
      sheet.getRange(i + 1, 12).setValue(new Date()); // UpdatedAt
      return { success: true };
    }
  }
  return { error: "User not found" };
}

// ============================================================================
// --- 3.1 MODULE QUẢN TRỊ: PHÂN QUYỀN & QUẢN LÝ USER ---
// ============================================================================

function getUsersColumnIndexMap_(headers) {
  var map = {};
  headers.forEach(function (h, i) {
    var raw = String(h == null ? "" : h).replace(/^\uFEFF/, "").trim();
    if (raw) map[raw] = i;
    var nk = normalizeHeaderKey_(h);
    if (nk) map[nk] = i;
  });
  return map;
}

function resolveUsersColumnIndex_(headers, map, key, fallbackIndex) {
  var aliases = {
    Email: ["Email", "E-mail", "Mail", "Username", "TaiKhoan", "User"],
    Password: ["Password", "Pass", "MatKhau", "Mat khau"],
    FullName: ["FullName", "Full Name", "HoTen", "Ho ten", "Name"],
    Role: ["Role", "VaiTro", "Quyen"],
    Status: ["Status", "TrangThai", "Trang thai", "State"],
    LastLogin: ["LastLogin", "Last Login", "DangNhapCuoi"],
    JobTitle: ["JobTitle", "Job Title", "ChucDanh", "Chuc danh"],
    Phone: ["Phone", "PhoneNumber", "SoDienThoai", "So dien thoai", "SDT"],
    PracticeCertificate: ["PracticeCertificate", "PracticeCertifica", "Certificate", "ChungChiHanhNghe"],
    PracticeScope: ["PracticeScope", "Practice Scope", "PhamViHanhNghe"],
    CreatedAt: ["CreatedAt", "Created At"],
    UpdatedAt: ["UpdatedAt", "Updated At"],
    ResetCode: ["ResetCode", "Reset Code"],
    ResetCodeExpireAt: ["ResetCodeExpireAt", "ResetCodeExpire", "Reset Expire"]
  };
  var names = aliases[key] || [key];
  for (var i = 0; i < names.length; i++) {
    if (map[names[i]] != null) return map[names[i]];
    var nk = normalizeHeaderKey_(names[i]);
    if (map[nk] != null) return map[nk];
  }
  // Fallback theo vị trí chuẩn khi header bị lỗi.
  if (fallbackIndex != null && fallbackIndex < headers.length) return fallbackIndex;
  return -1;
}

function getCellSafe_(row, index) {
  if (index < 0 || index >= row.length) return "";
  return row[index];
}

function toClientText_(value) {
  if (value == null) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  }
  return String(value);
}

function getUsersSheetReady_() {
  var ss = getDatabase();
  var sheet = ss.getSheetByName("USERS");
  if (!sheet) {
    setupDatabaseStructure(ss);
    sheet = ss.getSheetByName("USERS");
  }
  ensureUsersSchema_(sheet);
  return sheet;
}

function quanTriTaoUser(data) {
  if (!data || !data.email || !data.password || !data.fullName) {
    return { error: "Thiếu thông tin bắt buộc: email, password, fullName." };
  }
  if (!data.jobTitle || !data.phone || !data.practiceCertificate || !data.practiceScope) {
    return { error: "Thiếu thông tin bắt buộc: chức danh, số điện thoại, chứng chỉ hành nghề, phạm vi hành nghề." };
  }
  var sheet = getUsersSheetReady_();
  var all = sheet.getDataRange().getValues();
  var email = String(data.email).trim().toLowerCase();

  for (var i = 1; i < all.length; i++) {
    if (String(all[i][0]).trim().toLowerCase() === email) {
      return { error: "Email đã tồn tại." };
    }
  }

  var now = new Date();
  sheet.appendRow([
    email,
    String(data.password),
    data.fullName,
    data.role || "USER",
    "ACTIVE",
    "",
    data.jobTitle,
    data.phone,
    data.practiceCertificate,
    data.practiceScope,
    now,
    now,
    "",
    ""
  ]);
  writeAppLog_("ADMIN", "CREATE_USER", "ADMIN_PANEL", email, {
    fullName: data.fullName,
    role: data.role || "USER",
    jobTitle: data.jobTitle
  }, "SUCCESS");
  return { success: true, message: "Đã tạo user mới thành công." };
}

function quanTriQuanLyUser(action, data) {
  var sheet = getUsersSheetReady_();
  var raw = sheet.getDataRange().getValues();
  if (!raw || raw.length === 0) return { error: "Không đọc được dữ liệu USERS." };
  var headers = raw[0];
  var rows = raw.slice(1);
  var idx = getUsersColumnIndexMap_(headers);
  var c = {
    Email: resolveUsersColumnIndex_(headers, idx, "Email", 0),
    FullName: resolveUsersColumnIndex_(headers, idx, "FullName", 2),
    Role: resolveUsersColumnIndex_(headers, idx, "Role", 3),
    Status: resolveUsersColumnIndex_(headers, idx, "Status", 4),
    LastLogin: resolveUsersColumnIndex_(headers, idx, "LastLogin", 5),
    JobTitle: resolveUsersColumnIndex_(headers, idx, "JobTitle", 6),
    Phone: resolveUsersColumnIndex_(headers, idx, "Phone", 7),
    PracticeCertificate: resolveUsersColumnIndex_(headers, idx, "PracticeCertificate", 8),
    PracticeScope: resolveUsersColumnIndex_(headers, idx, "PracticeScope", 9),
    CreatedAt: resolveUsersColumnIndex_(headers, idx, "CreatedAt", 10),
    UpdatedAt: resolveUsersColumnIndex_(headers, idx, "UpdatedAt", 11)
  };

  if (action === "LIST") {
    var list = rows.map(function (row, r) {
      return {
        _rowIndex: r + 2,
        Email: toClientText_(getCellSafe_(row, c.Email)),
        FullName: toClientText_(getCellSafe_(row, c.FullName)),
        Role: toClientText_(getCellSafe_(row, c.Role)),
        Status: toClientText_(getCellSafe_(row, c.Status)),
        LastLogin: toClientText_(getCellSafe_(row, c.LastLogin)),
        JobTitle: toClientText_(getCellSafe_(row, c.JobTitle)),
        Phone: toClientText_(getCellSafe_(row, c.Phone)),
        PracticeCertificate: toClientText_(getCellSafe_(row, c.PracticeCertificate)),
        PracticeScope: toClientText_(getCellSafe_(row, c.PracticeScope)),
        CreatedAt: toClientText_(getCellSafe_(row, c.CreatedAt)),
        UpdatedAt: toClientText_(getCellSafe_(row, c.UpdatedAt))
      };
    });
    return { success: true, data: list };
  }

  if (!data || !data.email) return { error: "Thiếu email user cần thao tác." };
  var target = String(data.email).trim().toLowerCase();

  for (var i = 1; i < raw.length; i++) {
    var mail = String(raw[i][c.Email]).trim().toLowerCase();
    if (mail === target) {
      if (action === "UPDATE_PROFILE") {
        if (data.fullName != null && c.FullName >= 0) sheet.getRange(i + 1, c.FullName + 1).setValue(data.fullName);
        if (data.jobTitle != null && c.JobTitle >= 0) sheet.getRange(i + 1, c.JobTitle + 1).setValue(data.jobTitle);
        if (data.phone != null && c.Phone >= 0) sheet.getRange(i + 1, c.Phone + 1).setValue(data.phone);
        if (data.practiceCertificate != null && c.PracticeCertificate >= 0) sheet.getRange(i + 1, c.PracticeCertificate + 1).setValue(data.practiceCertificate);
        if (data.practiceScope != null && c.PracticeScope >= 0) sheet.getRange(i + 1, c.PracticeScope + 1).setValue(data.practiceScope);
        if (c.UpdatedAt >= 0) sheet.getRange(i + 1, c.UpdatedAt + 1).setValue(new Date());
        writeAppLog_("ADMIN", "UPDATE_PROFILE", "ADMIN_PANEL", target, data, "SUCCESS");
        return { success: true, message: "Đã cập nhật hồ sơ user." };
      }
      if (action === "LOCK") {
        if (c.Status >= 0) sheet.getRange(i + 1, c.Status + 1).setValue("LOCKED");
        if (c.UpdatedAt >= 0) sheet.getRange(i + 1, c.UpdatedAt + 1).setValue(new Date());
        writeAppLog_("ADMIN", "LOCK_USER", "ADMIN_PANEL", target, {}, "SUCCESS");
        return { success: true, message: "Đã khóa user." };
      }
      if (action === "UNLOCK") {
        if (c.Status >= 0) sheet.getRange(i + 1, c.Status + 1).setValue("ACTIVE");
        if (c.UpdatedAt >= 0) sheet.getRange(i + 1, c.UpdatedAt + 1).setValue(new Date());
        writeAppLog_("ADMIN", "UNLOCK_USER", "ADMIN_PANEL", target, {}, "SUCCESS");
        return { success: true, message: "Đã mở khóa user." };
      }
      if (action === "DELETE") {
        sheet.deleteRow(i + 1);
        writeAppLog_("ADMIN", "DELETE_USER", "ADMIN_PANEL", target, {}, "SUCCESS");
        return { success: true, message: "Đã xóa user." };
      }
      if (action === "APPROVE_PENDING") {
        if (c.Status >= 0) {
          var st = String(getCellSafe_(raw[i], c.Status)).trim().toUpperCase();
          if (st !== "PENDING_APPROVAL") {
            return { error: "Chỉ duyệt được tài khoản đang ở trạng thái chờ duyệt." };
          }
          sheet.getRange(i + 1, c.Status + 1).setValue("ACTIVE");
        }
        if (c.UpdatedAt >= 0) sheet.getRange(i + 1, c.UpdatedAt + 1).setValue(new Date());
        writeAppLog_("ADMIN", "APPROVE_USER", "ADMIN_PANEL", target, {}, "SUCCESS");
        return { success: true, message: "Đã duyệt và kích hoạt tài khoản." };
      }
      return { error: "Action không hợp lệ." };
    }
  }
  return { error: "Không tìm thấy user." };
}

function quanTriPhanQuyen(email, role) {
  if (!email || !role) return { error: "Thiếu email hoặc role." };
  var validRoles = ["ADMIN", "MANAGER", "DOCTOR", "DIETITIAN", "NURSE", "USER"];
  var roleUpper = String(role).trim().toUpperCase();
  if (validRoles.indexOf(roleUpper) === -1) {
    return { error: "Role không hợp lệ. Hỗ trợ: " + validRoles.join(", ") };
  }

  var sheet = getUsersSheetReady_();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx = getUsersColumnIndexMap_(headers);
  var target = String(email).trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.Email]).trim().toLowerCase() === target) {
      sheet.getRange(i + 1, idx.Role + 1).setValue(roleUpper);
      sheet.getRange(i + 1, idx.UpdatedAt + 1).setValue(new Date());
      writeAppLog_("ADMIN", "SET_ROLE", "ADMIN_PANEL", target, { role: roleUpper }, "SUCCESS");
      return { success: true, message: "Đã cập nhật phân quyền.", role: roleUpper };
    }
  }
  return { error: "Không tìm thấy user." };
}

function quanTriDoiMatKhau(email, oldPass, newPass) {
  if (!email || !oldPass || !newPass) return { error: "Thiếu tham số đổi mật khẩu." };
  var sheet = getUsersSheetReady_();
  var data = sheet.getDataRange().getValues();
  var idx = getUsersColumnIndexMap_(data[0]);
  var target = String(email).trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.Email]).trim().toLowerCase() === target) {
      if (String(data[i][idx.Password]) !== String(oldPass)) return { error: "Mật khẩu cũ không đúng." };
      sheet.getRange(i + 1, idx.Password + 1).setValue(String(newPass));
      sheet.getRange(i + 1, idx.UpdatedAt + 1).setValue(new Date());
      return { success: true, message: "Đổi mật khẩu thành công." };
    }
  }
  return { error: "Không tìm thấy user." };
}

function quanTriYeuCauPhucHoiMatKhau(email) {
  if (!email) return { error: "Thiếu email." };
  var sheet = getUsersSheetReady_();
  var data = sheet.getDataRange().getValues();
  var idx = getUsersColumnIndexMap_(data[0]);
  var target = String(email).trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.Email]).trim().toLowerCase() === target) {
      var code = String(Math.floor(100000 + Math.random() * 900000));
      var expire = new Date(Date.now() + 15 * 60 * 1000);
      sheet.getRange(i + 1, idx.ResetCode + 1).setValue(code);
      sheet.getRange(i + 1, idx.ResetCodeExpireAt + 1).setValue(expire);
      sheet.getRange(i + 1, idx.UpdatedAt + 1).setValue(new Date());
      return { success: true, message: "Đã tạo mã phục hồi mật khẩu (15 phút).", resetCode: code };
    }
  }
  return { error: "Không tìm thấy user." };
}

function quanTriPhucHoiMatKhau(email, resetCode, newPass) {
  if (!email || !resetCode || !newPass) return { error: "Thiếu tham số phục hồi mật khẩu." };
  var sheet = getUsersSheetReady_();
  var data = sheet.getDataRange().getValues();
  var idx = getUsersColumnIndexMap_(data[0]);
  var target = String(email).trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.Email]).trim().toLowerCase() === target) {
      var currentCode = String(data[i][idx.ResetCode] || "");
      var expireAt = data[i][idx.ResetCodeExpireAt];
      if (!currentCode || currentCode !== String(resetCode)) return { error: "Mã phục hồi không đúng." };
      if (!expireAt || new Date(expireAt).getTime() < Date.now()) return { error: "Mã phục hồi đã hết hạn." };

      sheet.getRange(i + 1, idx.Password + 1).setValue(String(newPass));
      sheet.getRange(i + 1, idx.ResetCode + 1).setValue("");
      sheet.getRange(i + 1, idx.ResetCodeExpireAt + 1).setValue("");
      sheet.getRange(i + 1, idx.UpdatedAt + 1).setValue(new Date());
      return { success: true, message: "Phục hồi mật khẩu thành công." };
    }
  }
  return { error: "Không tìm thấy user." };
}

// ============================================================================
// --- 4. CLINICAL: API NGHIỆP VỤ LÂM SÀNG ---
// ============================================================================

function ensureRecordsDietPrepColumn(sheet) {
  var nc = sheet.getLastColumn();
  if (nc < 1) return;
  var headers = sheet.getRange(1, 1, 1, nc).getValues()[0];
  var labels = headers.map(function (h) { return String(h).trim(); });
  if (labels.indexOf("Diet_Prep") !== -1) return;
  sheet.getRange(1, nc + 1).setValue("Diet_Prep");
}

function ensureRecordsSchema_(sheet) {
  if (!sheet) return;
  ensureRecordsDietPrepColumn(sheet);
  var nc = sheet.getLastColumn();
  if (nc < 1) return;
  var labels = sheet.getRange(1, 1, 1, nc).getValues()[0].map(function (h) { return String(h).trim(); });
  var required = [
    "Waist_cm", "Hip_cm", "WHR", "WHR_Class", "GripStrength_kg", "GripStrength_Class",
    "FullSnapshot_JSON"
  ];
  required.forEach(function (name) {
    if (labels.indexOf(name) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(name);
    }
  });
}

/**
 * Lưu hồ sơ bệnh án dinh dưỡng
 */
function savePatientRecord(data) {
  try {
    const ss = getDatabase();
    let sheet = ss.getSheetByName("RECORDS");
    if (!sheet) {
      setupDatabaseStructure(ss);
      sheet = ss.getSheetByName("RECORDS");
    }
    if (!sheet) return "Error: Không tìm thấy bảng RECORDS.";
    
    if (!data.id || !data.name) return "Error: Thiếu thông tin định danh bệnh nhân.";

    ensureRecordsSchema_(sheet);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    var row = new Array(headers.length).fill("");
    var idx = {};
    headers.forEach(function (h, i) { idx[h] = i; });

    function setField(name, value) {
      if (idx[name] == null) return;
      row[idx[name]] = value == null ? "" : value;
    }

    setField("Timestamp", new Date());
    setField("PatientID", "'" + data.id); // Giữ số 0 đầu
    setField("Name", data.name);
    setField("DOB", data.dob);
    setField("Gender", data.gender);
    setField("Height_cm", data.height);
    setField("Weight_kg", data.weight);
    setField("BMI", data.bmi);
    setField("Waist_cm", data.waist);
    setField("Hip_cm", data.hip);
    setField("WHR", data.whr);
    setField("WHR_Class", data.whrClass);
    setField("GripStrength_kg", data.gripStrength);
    setField("GripStrength_Class", data.gripClass);
    setField("Diagnosis", data.diagnosis);
    setField("Diet_Code", data.dietCode);
    setField("Kcal_Target", data.kcalTarget);
    setField("Protein_Target", data.proteinTarget);
    setField("Menu_JSON", data.menuJson || "");
    setField("Doctor", data.doctor || "System");
    setField("Diet_Prep", data.dietPrep || "COM");
    setField("FullSnapshot_JSON", data.fullSnapshotJson || "");

    sheet.appendRow(row);
    writeRecordAuditAll_(data, ss);
    writeAppLog_("CLINICAL", "SAVE_RECORD", data.doctor || "System", data.id || "", {
      patientName: data.name,
      dietCode: data.dietCode || "",
      hasSnapshot: !!data.fullSnapshotJson
    }, "SUCCESS", ss);
    
    return "OK";
  } catch (e) {
    Logger.log(e.toString());
    writeAppLog_("CLINICAL", "SAVE_RECORD", (data && data.doctor) || "System", (data && data.id) || "", { error: e.toString() }, "FAILED");
    return "Error: " + e.toString();
  }
}

/**
 * Tra cứu lịch sử khám (Trả về 10 lần gần nhất)
 */
function searchPatientHistory(keyword) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("RECORDS");
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);
  const records = data.slice(1); // Bỏ Header
  const searchLower = String(keyword).toLowerCase();
  
  const results = records
    .map((row, rowIdx) => ({ row: row, rowIndex: rowIdx + 2 }))
    .filter(item => {
      const row = item.row;
      const id = String(row[idx.PatientID != null ? idx.PatientID : 1]).replace("'", "").toLowerCase();
      const name = String(row[idx.Name != null ? idx.Name : 2]).toLowerCase();
      return id.includes(searchLower) || name.includes(searchLower);
    })
    .sort((a, b) => new Date(b.row[idx.Timestamp != null ? idx.Timestamp : 0]) - new Date(a.row[idx.Timestamp != null ? idx.Timestamp : 0])) // Mới nhất lên đầu
    .slice(0, 10);

  return results.map(item => {
    const row = item.row;
    return {
      rowIndex: item.rowIndex,
      date: new Date(row[idx.Timestamp != null ? idx.Timestamp : 0]).toLocaleString("vi-VN"),
      patientId: String(row[idx.PatientID != null ? idx.PatientID : 1]).replace("'", ""),
      name: row[idx.Name != null ? idx.Name : 2] || "",
      weight: row[idx.Weight_kg != null ? idx.Weight_kg : 6] || "",
      bmi: row[idx.BMI != null ? idx.BMI : 7] || "",
      diagnosis: row[idx.Diagnosis != null ? idx.Diagnosis : 8] || "",
      diet: row[idx.Diet_Code != null ? idx.Diet_Code : 9] || "",
      doctor: row[idx.Doctor != null ? idx.Doctor : 13] || "",
      fullSnapshotJson: row[idx.FullSnapshot_JSON != null ? idx.FullSnapshot_JSON : -1] || ""
    };
  });
}

/**
 * Danh sách cột phẳng sheet RESEARCH_NC (mã trường = header).
 */
function getResearchNcHeaders_() {
  return [
    "Timestamp", "RecordID", "SavedBy", "SavedByEmail",
    "nc_id_nghien_cuu", "nc_ngay_thu_thap", "nc_nguoi_thu_thap", "nc_dong_thuan",
    "nc_ho_ten_viet_tat", "nc_nam_sinh", "nc_gioi_tinh", "nc_hoc_van", "nc_nghe_nghiep",
    "nc_mach", "nc_ha_tam_thu", "nc_ha_tam_truong", "nc_tha_nhom",
    "nc_chieu_cao_cm", "nc_can_nang_kg", "nc_bmi", "nc_bmi_nhom",
    "nc_thoi_gian_pt_dtd2_y",
    "nc_tx_oad", "nc_tx_oad_su", "nc_tx_oad_met", "nc_tx_oad_dpp4", "nc_tx_oad_glp1_uong", "nc_tx_oad_glp1_tiem", "nc_tx_oad_sglt2", "nc_tx_oad_acarbose",
    "nc_tx_insulin", "nc_tx_ins_nen", "nc_tx_ins_tron", "nc_tx_ins_basal_bolus", "nc_tx_phoi_hop",
    "nc_bc_than_man", "nc_bc_vong_mac", "nc_bc_than_kinh", "nc_bc_tim_mach", "nc_bc_chua_ghi_nhan",
    "nc_fpg_mmol", "nc_hba1c_pct",
    "nc_cholesterol", "nc_triglyceride", "nc_hdl_c", "nc_ldl_c", "nc_hba1c_dat_muc_tieu",
    "nc_stop_bang_tong", "nc_stop_bang_nhom",
    "nc_stop_s", "nc_stop_t", "nc_stop_o", "nc_stop_p", "nc_stop_b", "nc_stop_a", "nc_stop_n", "nc_stop_g",
    "nc_phq9_tong", "nc_phq9_nhom",
    "nc_phq9_1", "nc_phq9_2", "nc_phq9_3", "nc_phq9_4", "nc_phq9_5", "nc_phq9_6", "nc_phq9_7", "nc_phq9_8", "nc_phq9_9",
    "nc_psqi_q1_gio_len_giuong", "nc_psqi_q2_phut_chim_ngu", "nc_psqi_q3_gio_thuc_day", "nc_psqi_q4_gio_ngu",
    "nc_psqi_q5a", "nc_psqi_q5b", "nc_psqi_q5c", "nc_psqi_q5d", "nc_psqi_q5e",
    "nc_psqi_q5f", "nc_psqi_q5g", "nc_psqi_q5h", "nc_psqi_q5i", "nc_psqi_q5j", "nc_psqi_q5j_ly_do",
    "nc_psqi_q6", "nc_psqi_q7", "nc_psqi_q8", "nc_psqi_q9",
    "nc_psqi_c1", "nc_psqi_c2", "nc_psqi_c3", "nc_psqi_c4", "nc_psqi_c5", "nc_psqi_c6", "nc_psqi_c7",
    "nc_psqi_tong", "nc_psqi_hieu_suat", "nc_psqi_ket_luan"
  ];
}

function ensureResearchNcSheet_(ssOpt) {
  var ss = ssOpt || getDatabase();
  var sheet = ss.getSheetByName("RESEARCH_NC");
  var headers = getResearchNcHeaders_();
  if (!sheet) {
    sheet = ss.insertSheet("RESEARCH_NC");
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return sheet;
  }
  var lastCol = sheet.getLastColumn();
  var cur = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); })
    : [];
  var missing = [];
  headers.forEach(function (h) {
    if (cur.indexOf(h) === -1) missing.push(h);
  });
  if (missing.length) {
    // Ghi một lần thay vì từng cột — tránh timeout khi đăng nhập
    var startCol = Math.max(1, sheet.getLastColumn() + 1);
    sheet.getRange(1, startCol, 1, startCol + missing.length - 1).setValues([missing]);
  }
  return sheet;
}

/**
 * Lưu phiếu thu thập NC — 1 dòng phẳng trên RESEARCH_NC.
 * @param {string} flatJson object mã phẳng nc_*
 */
function saveResearchNcForm(flatJson) {
  try {
    var data = {};
    try { data = JSON.parse(flatJson || "{}"); } catch (_) { return { error: "Dữ liệu không hợp lệ." }; }
    if (!data.nc_id_nghien_cuu && !data.nc_ho_ten_viet_tat) {
      return { error: "Thiếu Mã ID nghiên cứu hoặc họ tên." };
    }
    var ss = getDatabase();
    var sheet = ensureResearchNcSheet_(ss);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    var recordId = data.RecordID || data.nc_record_id || ("NC" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss"));
    var row = headers.map(function (h) {
      if (h === "Timestamp") return new Date();
      if (h === "RecordID") return recordId;
      if (h === "SavedBy") return data.SavedBy || "";
      if (h === "SavedByEmail") return data.SavedByEmail || "";
      if (h === "nc_id_nghien_cuu" && data[h]) return "'" + String(data[h]).replace(/'/g, "");
      return data[h] != null ? data[h] : "";
    });
    sheet.appendRow(row);
    writeAppLog_("RESEARCH", "SAVE_NC_FORM", data.SavedBy || "System", data.nc_id_nghien_cuu || "", { recordId: recordId }, "SUCCESS", ss);
    return { ok: true, recordId: recordId };
  } catch (e) {
    writeAppLog_("RESEARCH", "SAVE_NC_FORM", "System", "", { error: e.toString() }, "FAILED");
    return { error: e.toString() };
  }
}

/* ============================================================
 * TỰ ĐỘNG LƯU (AUTOSAVE DRAFT) — GENERIC
 * Lưu nháp thẳng lên Google Sheet "DRAFTS" theo (Context + UserEmail).
 * QUAN TRỌNG: KHÔNG dùng Session.getEffectiveUser()/getActiveUser() để
 * tránh thêm scope OAuth 'userinfo.email' (bài học regression đăng nhập v70).
 * Email người dùng do client (CURRENT_USER) truyền xuống.
 * ============================================================ */
var DRAFTS_SHEET_NAME_ = "DRAFTS";
var DRAFTS_HEADERS_ = ["DraftKey", "Context", "EntityId", "UserEmail", "DataJson", "UpdatedAt", "UpdatedAtIso"];

function ensureDraftsSheet_(ssOpt) {
  var ss = ssOpt || openCentralSpreadsheet_();
  var sheet = ss.getSheetByName(DRAFTS_SHEET_NAME_);
  if (!sheet) {
    sheet = ss.insertSheet(DRAFTS_SHEET_NAME_);
    sheet.appendRow(DRAFTS_HEADERS_);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function draftKey_(context, userEmail) {
  return String(context || "").trim() + "|" + String(userEmail || "").trim().toLowerCase();
}

/**
 * Ghi/ghi đè bản nháp của một biểu mẫu lên sheet DRAFTS.
 * @param {string} context     Định danh biểu mẫu (vd: 'dd_workflow', 'nc_form').
 * @param {string} dataJson    Chuỗi JSON nội dung form.
 * @param {string} userEmail   Email người dùng (từ client, không đọc từ Session).
 * @param {string} entityId    (tuỳ chọn) mã bản ghi đang soạn (CCCD, ID NC…).
 */
function autosaveDraft(context, dataJson, userEmail, entityId) {
  var lock = LockService.getScriptLock();
  try {
    context = String(context || "").trim();
    if (!context) return { error: "Thiếu context." };
    if (typeof dataJson !== "string") {
      try { dataJson = JSON.stringify(dataJson); } catch (_) { dataJson = ""; }
    }
    if (dataJson.length > 45000) return { error: "Bản nháp quá lớn để tự lưu." };
    lock.waitLock(8000);
    var ss = openCentralSpreadsheet_();
    var sheet = ensureDraftsSheet_(ss);
    var key = draftKey_(context, userEmail);
    var now = new Date();
    var iso = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    var lastRow = sheet.getLastRow();
    var rowIndex = -1;
    if (lastRow >= 2) {
      var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i][0]) === key) { rowIndex = i + 2; break; }
      }
    }
    var rowValues = [key, context, String(entityId || ""), String(userEmail || ""), dataJson, now, iso];
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, DRAFTS_HEADERS_.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    return { ok: true, updatedAtIso: iso };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * Đọc bản nháp gần nhất của (context, user).
 * @return {{ok:boolean, hasDraft:boolean, data?:Object, entityId?:string, updatedAtIso?:string, error?:string}}
 */
function loadDraft(context, userEmail) {
  try {
    context = String(context || "").trim();
    if (!context) return { error: "Thiếu context." };
    var ss = openCentralSpreadsheet_();
    var sheet = ss.getSheetByName(DRAFTS_SHEET_NAME_);
    if (!sheet) return { ok: true, hasDraft: false };
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: true, hasDraft: false };
    var key = draftKey_(context, userEmail);
    var values = sheet.getRange(2, 1, lastRow - 1, DRAFTS_HEADERS_.length).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]) === key) {
        var data = {};
        try { data = JSON.parse(values[i][4] || "{}"); } catch (_) { data = {}; }
        return {
          ok: true,
          hasDraft: true,
          data: data,
          entityId: String(values[i][2] || ""),
          updatedAtIso: String(values[i][6] || "")
        };
      }
    }
    return { ok: true, hasDraft: false };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Xoá bản nháp sau khi đã Lưu chính thức thành công.
 */
function clearDraft(context, userEmail) {
  var lock = LockService.getScriptLock();
  try {
    context = String(context || "").trim();
    if (!context) return { error: "Thiếu context." };
    lock.waitLock(8000);
    var ss = openCentralSpreadsheet_();
    var sheet = ss.getSheetByName(DRAFTS_SHEET_NAME_);
    if (!sheet) return { ok: true };
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: true };
    var key = draftKey_(context, userEmail);
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = keys.length - 1; i >= 0; i--) {
      if (String(keys[i][0]) === key) sheet.deleteRow(i + 2);
    }
    return { ok: true };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * Thống kê nhanh sheet RECORDS (màn Thu thập số liệu nghiên cứu).
 */
function getResearchRecordsStats() {
  try {
    const ss = getDatabase();
    ensureResearchNcSheet_(ss);
    const sheet = ss.getSheetByName("RESEARCH_NC");
    if (!sheet) return { total: 0 };
    const last = sheet.getLastRow();
    return { total: Math.max(0, last - 1) };
  } catch (e) {
    return { error: e.toString(), total: 0 };
  }
}

/**
 * Truy vấn hồ sơ RECORDS để xuất nghiên cứu (lọc ngày / từ khóa / giới hạn dòng).
 * @param {string} optionsJson { fromDate, toDate, keyword, limit }
 */
function getResearchRecordsForExport(optionsJson) {
  try {
    var opts = {};
    try { opts = JSON.parse(optionsJson || "{}"); } catch (_) {}
    var fromDate = opts.fromDate ? new Date(String(opts.fromDate) + "T00:00:00") : null;
    var toDate = opts.toDate ? new Date(String(opts.toDate) + "T23:59:59.999") : null;
    var keyword = String(opts.keyword || "").trim().toLowerCase();
    var limit = Math.min(Math.max(parseInt(opts.limit, 10) || 500, 1), 2000);

    const ss = getDatabase();
    ensureResearchNcSheet_(ss);
    const sheet = ss.getSheetByName("RESEARCH_NC");
    if (!sheet) return { error: "Không tìm thấy bảng RESEARCH_NC.", rows: [], total: 0 };

    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return { rows: [], total: 0 };

    const headers = data[0].map(function (h) { return String(h).trim(); });
    const idx = {};
    headers.forEach(function (h, i) { idx[h] = i; });

    var matched = data.slice(1).filter(function (row) {
      var ts = row[idx.Timestamp != null ? idx.Timestamp : 0];
      var d = ts ? new Date(ts) : null;
      if (fromDate && d && !isNaN(d.getTime()) && d < fromDate) return false;
      if (toDate && d && !isNaN(d.getTime()) && d > toDate) return false;
      if (keyword) {
        var id = String(row[idx.nc_id_nghien_cuu != null ? idx.nc_id_nghien_cuu : 4]).replace(/'/g, "").toLowerCase();
        var name = String(row[idx.nc_ho_ten_viet_tat != null ? idx.nc_ho_ten_viet_tat : 8] || "").toLowerCase();
        if (id.indexOf(keyword) === -1 && name.indexOf(keyword) === -1) return false;
      }
      return true;
    });

    matched.sort(function (a, b) {
      var da = new Date(a[idx.Timestamp != null ? idx.Timestamp : 0]);
      var db = new Date(b[idx.Timestamp != null ? idx.Timestamp : 0]);
      return db - da;
    });

    var total = matched.length;
    matched = matched.slice(0, limit);
    var rows = matched.map(function (row) { return researchNcRowToExportObject_(headers, row, idx); });
    return { rows: rows, total: total };
  } catch (e) {
    return { error: e.toString(), rows: [], total: 0 };
  }
}

function researchNcRowToExportObject_(headers, row, idx) {
  var obj = {};
  headers.forEach(function (h, i) {
    var v = row[i];
    if (h === "nc_id_nghien_cuu") v = String(v).replace(/'/g, "");
    if (h === "Timestamp" && v) {
      try { v = new Date(v).toISOString(); } catch (_) {}
    }
    obj[h] = v == null ? "" : v;
  });
  return obj;
}

function researchRowToExportObject_(headers, row, idx) {
  var obj = {};
  headers.forEach(function (h, i) {
    if (h === "FullSnapshot_JSON") return;
    var v = row[i];
    if (h === "PatientID") v = String(v).replace(/'/g, "");
    if (h === "Timestamp" && v) {
      try { v = new Date(v).toISOString(); } catch (_) {}
    }
    obj[h] = v == null ? "" : v;
  });

  var snapCol = idx["FullSnapshot_JSON"];
  if (snapCol != null && row[snapCol]) {
    try {
      var snap = JSON.parse(String(row[snapCol]));
      if (snap.fields) {
        Object.keys(snap.fields).forEach(function (k) {
          var fv = snap.fields[k];
          obj[k] = (typeof fv === "boolean") ? (fv ? "1" : "0") : fv;
        });
      }
      if (snap.computedIndicators) {
        Object.keys(snap.computedIndicators).forEach(function (k) {
          obj["calc_" + k] = snap.computedIndicators[k];
        });
      }
      if (snap.selectedDiagnosisList && snap.selectedDiagnosisList.length) {
        obj["ICD10_snapshot"] = snap.selectedDiagnosisList.map(function (d) {
          return (d.code || "") + " — " + (d.name || "");
        }).join("; ");
      }
    } catch (_) {}
  }
  return obj;
}

function getLatestPatientIntakeById(patientId) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("RECORDS");
  if (!sheet) return { error: "Không tìm thấy bảng RECORDS." };
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return { error: "Chưa có dữ liệu hồ sơ." };

  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);
  const idTarget = String(patientId || "").replace(/'/g, "").trim().toLowerCase();
  if (!idTarget) return { error: "Thiếu ID/CCCD bệnh nhân." };

  const tsIdx = idx.Timestamp != null ? idx.Timestamp : 0;
  const idIdx = idx.PatientID != null ? idx.PatientID : 1;
  const snapIdx = idx.FullSnapshot_JSON != null ? idx.FullSnapshot_JSON : -1;

  const matched = data.slice(1)
    .filter(row => String(row[idIdx] || "").replace(/'/g, "").trim().toLowerCase() === idTarget)
    .sort((a, b) => new Date(b[tsIdx]) - new Date(a[tsIdx]));

  if (!matched.length) return { error: "Không tìm thấy hồ sơ cũ theo ID này." };
  const latest = matched[0];
  return {
    success: true,
    snapshotJson: snapIdx >= 0 ? (latest[snapIdx] || "") : "",
    basic: {
      id: String(latest[idIdx] || "").replace(/'/g, ""),
      name: latest[idx.Name != null ? idx.Name : 2] || "",
      dob: latest[idx.DOB != null ? idx.DOB : 3] || "",
      gender: latest[idx.Gender != null ? idx.Gender : 4] || ""
    }
  };
}

/**
 * Lưu phiếu thu thập số liệu nghiên cứu (tab Thu thập số liệu).
 */
function saveResearchCollectRecord(data) {
  try {
    data = data || {};
    if (!data.nguoiNhap) return { error: "Thiếu Người nhập liệu." };
    var ss = getDatabase();
    var sheet = ss.getSheetByName("RESEARCH_COLLECT");
    if (!sheet) {
      setupDatabaseStructure(ss, { preserveSheet1: true });
      sheet = ss.getSheetByName("RESEARCH_COLLECT");
    }
    if (!sheet) return { error: "Không tạo được sheet RESEARCH_COLLECT." };
    var rx = Array.isArray(data.phacDoThuoc) ? data.phacDoThuoc.join("; ") : String(data.phacDoThuoc || "");
    var json = "";
    try { json = JSON.stringify(data); } catch (e) { json = ""; }
    sheet.appendRow([
      new Date(),
      String(data.nguoiNhap || ""),
      data.maBN ? ("'" + String(data.maBN).replace(/'/g, "")) : "",
      String(data.hoTen || ""),
      data.ngayNhap ? new Date(data.ngayNhap) : "",
      data.stopBang != null ? String(data.stopBang) : "",
      data.phq9 != null ? String(data.phq9) : "",
      rx,
      json
    ]);
    return { success: true };
  } catch (e) {
    return { error: "Lỗi lưu RESEARCH_COLLECT: " + (e && e.message ? e.message : e) };
  }
}

/**
 * Xuất CSV RESEARCH_COLLECT (tạo file tạm trên Drive, trả URL).
 */
function exportResearchCollectCsv() {
  try {
    var ss = getDatabase();
    var sheet = ss.getSheetByName("RESEARCH_COLLECT");
    if (!sheet) return { error: "Chưa có dữ liệu RESEARCH_COLLECT." };
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return { error: "Chưa có phiếu thu thập nào." };
    var csv = data.map(function (row) {
      return row.map(function (cell) {
        var s = cell == null ? "" : String(cell);
        if (s.indexOf(",") >= 0 || s.indexOf('"') >= 0 || s.indexOf("\n") >= 0) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(",");
    }).join("\n");
    var blob = Utilities.newBlob(csv, "text/csv", "research_collect_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm") + ".csv");
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, count: data.length - 1, url: file.getUrl() };
  } catch (e) {
    return { error: "Lỗi xuất CSV: " + (e && e.message ? e.message : e) };
  }
}

/**
 * Tổng hợp số liệu hồ sơ dinh dưỡng (module Thu thập số liệu).
 */
function getRecordsDataSummary() {
  try {
    var ss = getDatabase();
    var sheet = ss.getSheetByName("RECORDS");
    if (!sheet) return { error: "Không có sheet RECORDS.", total: 0, thisMonth: 0, recent: [] };
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      var rc0 = getResearchCollectCount_();
      return { success: true, total: 0, thisMonth: 0, recent: [], researchTotal: rc0.total, researchMonth: rc0.thisMonth };
    }
    var headers = data[0].map(function (h) { return String(h).trim(); });
    var idx = {};
    headers.forEach(function (h, i) { idx[h] = i; });
    var rows = data.slice(1);
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var tsIdx = idx.Timestamp != null ? idx.Timestamp : 0;
    var thisMonth = 0;
    rows.forEach(function (row) {
      var ts = row[tsIdx];
      if (ts && new Date(ts) >= monthStart) thisMonth++;
    });
    var recent = rows.slice().sort(function (a, b) {
      return new Date(b[tsIdx]) - new Date(a[tsIdx]);
    }).slice(0, 25).map(function (row) {
      return {
        date: new Date(row[tsIdx]).toLocaleString("vi-VN"),
        patientId: String(row[idx.PatientID != null ? idx.PatientID : 1] || "").replace(/'/g, ""),
        name: row[idx.Name != null ? idx.Name : 2] || "",
        bmi: row[idx.BMI != null ? idx.BMI : 7] || "",
        diagnosis: row[idx.Diagnosis != null ? idx.Diagnosis : 8] || "",
        doctor: row[idx.Doctor != null ? idx.Doctor : 13] || ""
      };
    });
    var rc = getResearchCollectCount_();
    return {
      success: true,
      total: rows.length,
      thisMonth: thisMonth,
      recent: recent,
      researchTotal: rc.total,
      researchMonth: rc.thisMonth
    };
  } catch (e) {
    return { error: "Lỗi đọc RECORDS: " + (e && e.message ? e.message : e), total: 0, thisMonth: 0, recent: [] };
  }
}

/** Đếm phiếu RESEARCH_COLLECT (thu thập số liệu nghiên cứu). */
function getResearchCollectCount_() {
  try {
    var ss = getDatabase();
    var sheet = ss.getSheetByName("RESEARCH_COLLECT");
    if (!sheet) return { total: 0, thisMonth: 0 };
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return { total: 0, thisMonth: 0 };
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var thisMonth = 0;
    for (var i = 1; i < data.length; i++) {
      var ts = data[i][0];
      if (ts && new Date(ts) >= monthStart) thisMonth++;
    }
    return { total: data.length - 1, thisMonth: thisMonth };
  } catch (e) {
    return { total: 0, thisMonth: 0 };
  }
}

/**
 * Lấy dữ liệu khởi tạo (Load Data Cache cho App)
 */
function getInitialData() {
  const ss = getDatabase();
  
  const readSheetToJSON = (sheetName) => {
    const s = ss.getSheetByName(sheetName);
    if (!s) return [];
    const d = s.getDataRange().getValues();
    const h = d[0]; 
    return d.slice(1).map(r => {
      let obj = {};
      h.forEach((k, i) => obj[k.toLowerCase()] = r[i]);
      return obj;
    });
  };

  return {
    foods: readSheetToJSON("FOOD_DB"),
    diseases: readSheetToJSON("DISEASE_DB")
  };
}

// ============================================================================
// --- 5. ADMIN: API QUẢN TRỊ HỆ THỐNG ---
// ============================================================================

/**
 * API CRUD Đa năng cho Admin
 */
function adminGenericCRUD(table, action, data) {
  const ss = getDatabase();
  let sheet = ss.getSheetByName(table);
  if (!sheet) {
    setupDatabaseStructure(ss);
    sheet = ss.getSheetByName(table);
  }
  if (!sheet) return { error: "Bảng dữ liệu không tồn tại: " + table };

  // --- READ ---
  if (action === 'READ') {
    const rawData = sheet.getDataRange().getValues();
    const headers = rawData[0];
    const rows = rawData.slice(1);
    
    const result = rows.map((row, rIndex) => {
      let obj = { _rowIndex: rIndex + 2 }; 
      headers.forEach((h, cIndex) => {
        // SECURITY: Ẩn mật khẩu nếu đọc bảng USERS
        if (table === 'USERS' && h === 'Password') obj[h] = "***"; 
        else obj[h] = row[cIndex];
      });
      return obj;
    });
    return { status: 'success', data: result, schema: headers };
  }

  // --- DELETE ---
  if (action === 'DELETE') {
    if(data.rowIndex > 1) {
      sheet.deleteRow(data.rowIndex);
      return { status: 'success', message: "Đã xóa thành công!" };
    }
    return { error: "Không thể xóa dòng tiêu đề." };
  }

  // --- CREATE ---
  if (action === 'CREATE') {
    const headers = sheet.getDataRange().getValues()[0];
    let newRow = [];
    
    // Validate đặc biệt cho USERS
    if(table === 'USERS') {
      const existing = sheet.getDataRange().getValues();
      for(let i=1; i<existing.length; i++) {
        if(existing[i][0] == data['Email']) return { error: "Email này đã tồn tại!" };
      }
    }

    if(table === 'DOCTORS') {
      if(!data['DoctorID']) data['DoctorID'] = "DR" + new Date().getTime();
      if(!data['Status']) data['Status'] = "ACTIVE";
      if(!data['CreatedAt']) data['CreatedAt'] = new Date();
    }

    headers.forEach(h => newRow.push(data[h] || ""));
    sheet.appendRow(newRow);
    return { status: 'success', message: "Thêm mới thành công!" };
  }

  // --- UPDATE ---
  if (action === 'UPDATE') {
    if(!data._rowIndex) return { error: "Thiếu chỉ số dòng (RowIndex)." };
    const headers = sheet.getDataRange().getValues()[0];
    let updateRow = [];
    
    headers.forEach(h => {
      // Nếu là bảng Users và field Password là '***', giữ nguyên pass cũ
      if (table === 'USERS' && h === 'Password' && data[h] === '***') {
         const oldPass = sheet.getRange(data._rowIndex, headers.indexOf('Password') + 1).getValue();
         updateRow.push(oldPass);
      } else {
         updateRow.push(data[h]);
      }
    });
    
    sheet.getRange(data._rowIndex, 1, 1, headers.length).setValues([updateRow]);
    return { status: 'success', message: "Cập nhật thành công!" };
  }
}

/**
 * Lấy cấu hình hệ thống
 */
function getSystemConfig() {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("SYS_CONFIG");
  if(!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  let config = {};
  for(let i=1; i<data.length; i++) {
    config[data[i][0]] = data[i][1];
  }
  return config;
}

// =======================================================
// --- 6. EMERGENCY: HÀM CẤP CỨU HỆ THỐNG ---
// =======================================================

/**
 * Hàm này dùng để RESET lại bảng Users nếu lỡ quên mật khẩu Admin
 * Cách dùng: Chọn hàm này trong trình biên tập App Script và bấm "Run"
 * Luôn thao tác trên cùng file với getDatabase() (DEFAULT_DB_SPREADSHEET_ID / DB_SPREADSHEET_ID).
 */
function RESET_SYSTEM_ACCOUNTS() {
  var ss;
  try {
    ss = getDatabase();
  } catch (e) {
    Logger.log("Không mở được Database: " + e);
    return;
  }
  let sheet = ss.getSheetByName("USERS");
  
  // 1. XÓA BẢNG CŨ
  if (sheet) {
    ss.deleteSheet(sheet);
    Logger.log("Đã xóa bảng USERS cũ.");
  }
  
  // 2. TẠO BẢNG MỚI ĐÚNG CHUẨN
  sheet = ss.insertSheet("USERS");
  
  // Header chuẩn
  sheet.appendRow(["Email", "Password", "FullName", "Role", "Status", "LastLogin"]);
  
  // Admin mặc định
  sheet.appendRow([
    "admin@phuongchau.com", 
    "123456", 
    "Hồ Tấn Thịnh", 
    "ADMIN", 
    "ACTIVE", 
    new Date()
  ]);
  
  // Format văn bản cho cột Password
  sheet.getRange("B2:B").setNumberFormat("@"); 
  
  Logger.log("---------------------------------------------");
  Logger.log("ĐÃ KHÔI PHỤC THÀNH CÔNG!");
  Logger.log("Tài khoản: admin@phuongchau.com");
  Logger.log("Mật khẩu: 123456");
  Logger.log("---------------------------------------------");
}

// ============================================================================
// --- 7. MODULE 7: TÀI LIỆU & AI (KNOWLEDGE BASE & GEMINI) ---
// ============================================================================

/**
 * Lấy danh sách tài liệu từ DB_REFERENCES
 */
function getReferenceList() {
  // Kiểm tra bảng tồn tại thông qua hàm setupDatabaseStructure
  const ss = getDatabase();
  if(!ss.getSheetByName("DB_REFERENCES")) setupDatabaseStructure(ss);

  const sheet = ss.getSheetByName("DB_REFERENCES");
  if (!sheet) return [];
  ensureDefaultReferencesImported_(sheet);
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];
  const headers = data[0].map(h => String(h || "").trim());
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);
  const pick = (row, key, fallbackIdx) => {
    const i = (idx[key] != null) ? idx[key] : fallbackIdx;
    return i != null && i >= 0 && i < row.length ? row[i] : "";
  };

  // Đọc theo header trước, fallback vị trí để chịu lỗi lệch cột.
  const records = data.slice(1)
    .map(r => ({
      RefID: String(pick(r, "RefID", 0) || "").trim(),
      Category: String(pick(r, "Category", 1) || "Chưa phân loại").trim() || "Chưa phân loại",
      Title: String(pick(r, "Title", 2) || "").trim(),
      Type: String(pick(r, "Type", 3) || "TEXT").trim().toUpperCase(),
      Content: String(pick(r, "Content", 4) || "").trim(),
      Tags: String(pick(r, "Tags", 5) || "").trim(),
      AddedBy: String(pick(r, "AddedBy", 6) || "Unknown").trim() || "Unknown",
      Timestamp: pick(r, "Timestamp", 7) || ""
    }))
    // Chỉ bỏ các dòng thật sự trống hoàn toàn
    .filter(item => item.RefID || item.Title || item.Content);

  return records.reverse(); // Mới nhất lên đầu
}

function parseDateTimeVi_(text) {
  const raw = String(text || "").trim();
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return new Date();
  return new Date(
    parseInt(m[3], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[1], 10),
    parseInt(m[4], 10),
    parseInt(m[5], 10),
    parseInt(m[6], 10)
  );
}

function ensureDefaultReferencesImported_(sheet) {
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const existed = new Set((data || []).slice(1).map(r => String(r[0] || "").trim()).filter(Boolean));
  const defaults = [
    {
      refId: "REF_1767963042173",
      category: "",
      title: "Các chỉ số dinh dưỡng trẻ em",
      type: "LINK",
      content: "https://phuongchauhospital-my.sharepoint.com/:x:/g/personal/hieuph_phuongchau_com/IQBR-WDAwwhxR7hoY_ynP6HMAbUxThD7jP-vJc6dL1zVTlU",
      tags: "",
      addedBy: "Hồ Tấn Thịnh",
      timestamp: "09/01/2026 19:50:42"
    },
    {
      refId: "REF_1767963091378",
      category: "Phác đồ điều trị",
      title: "Phác đồ điều trị Phương Châu 2025",
      type: "LINK",
      content: "https://phuongchauhospital-my.sharepoint.com/:x:/g/personal/hieuph_phuongchau_com/IQBR-WDAwwhxR7hoY_ynP6HMAbUxThD7jP-vJc6dL1zVTlU",
      tags: "",
      addedBy: "Hồ Tấn Thịnh",
      timestamp: "09/01/2026 19:51:31"
    },
    {
      refId: "REF_1778073420058",
      category: "Dinh dưỡng lâm sàng",
      title: "Bảng tóm tắt chế độ ăn",
      type: "LINK",
      content: "https://drive.google.com/file/d/1iPvty3wq86p2b7QIeCaJbDd_rg17ZCF9/view?pli=1",
      tags: "",
      addedBy: "Hồ Tấn Thịnh",
      timestamp: "06/05/2026 20:17:00"
    }
  ];

  defaults.forEach(item => {
    if (existed.has(item.refId)) return;
    sheet.appendRow([
      item.refId,
      item.category,
      item.title,
      item.type,
      item.content,
      item.tags,
      item.addedBy,
      parseDateTimeVi_(item.timestamp)
    ]);
  });
}

/**
 * Lưu tài liệu mới
 */
function saveReferenceItem(data) {
  const ss = getDatabase();
  let sheet = ss.getSheetByName("DB_REFERENCES"); // Đã sửa: Khai báo bằng let để gán lại giá trị
  
  if(!sheet) {
    setupDatabaseStructure(ss);
    sheet = ss.getSheetByName("DB_REFERENCES"); // Đã sửa: Gán lại sheet sau khi khởi tạo DB
  }

  if (!data || !data.title || !data.content) {
    return { error: "Thiếu tiêu đề hoặc nội dung tài liệu." };
  }
  const id = "REF_" + new Date().getTime();
  
  sheet.appendRow([
    id,
    data.category || "Chưa phân loại",
    data.title,
    data.type || "TEXT",
    data.content,
    data.tags || "",
    data.user || "Unknown",
    new Date()
  ]);
  return { success: true, message: "Đã lưu tài liệu thành công!" };
}

/**
 * Xóa tài liệu
 */
function deleteReferenceItem(refId) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName("DB_REFERENCES");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == refId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: "Không tìm thấy tài liệu" };
}

/**
 * API Gemini: ưu tiên Script property GEMINI_API_KEY (Project settings → Script properties).
 * Nếu chưa đặt, dùng khóa mặc định trong mã (khuyến nghị chuyển hết sang Script properties).
 */
function getGeminiApiKey_() {
  var k = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (k && String(k).trim().length > 10) return String(k).trim();
  return "AIzaSyANybUFdPh3Ww6Y7Sn4c8m-SxbRAUrC8ac";
}

/**
 * Gemini — chế độ JSON (responseMimeType), dùng cho thực đơn 7 ngày có cấu trúc.
 * @param {string} fullTextPrompt toàn bộ prompt (system + nhiệm vụ + dữ liệu)
 * @returns {string} chuỗi JSON thuần
 */
function callGeminiAIJson_(fullTextPrompt) {
  var API_KEY = getGeminiApiKey_();
  var MODEL_NAME = "gemini-flash-latest";
  var API_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL_NAME + ":generateContent?key=" + API_KEY;
  var payload = {
    contents: [{ parts: [{ text: fullTextPrompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 8192,
      responseMimeType: "application/json"
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };
  var response = UrlFetchApp.fetch(API_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var json = JSON.parse(response.getContentText());
  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error));
  }
  if (json.candidates && json.candidates.length > 0 && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0]) {
    return json.candidates[0].content.parts[0].text;
  }
  throw new Error("AI không trả nội dung (candidates rỗng).");
}

/**
 * Module 4: Sinh thực đơn mẫu 7 ngày bằng Gemini theo kê đơn Mod 3 (payload từ client).
 * @param {string|Object} payloadJson JSON.stringify hoặc object đã parse
 * @returns {{ok:boolean, plan?:Object, error?:string, raw?:string}}
 */
function generateSevenDayMenuAI(payloadJson) {
  try {
    var payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
    if (!payload || !payload.targets || payload.targets.dailyKcal == null) {
      return { ok: false, error: "Thiếu payload.targets.dailyKcal" };
    }
    var lines = [];
    lines.push("Vai trò: Bạn là cử nhân dinh dưỡng lâm sàng tại bệnh viện Việt Nam.");
    lines.push("Nhiệm vụ: Lập THỰC ĐƠN MẪU 7 NGÀY khớp kê đơn dinh dưỡng (Mod 3), đa dạng món giữa các bữa và các ngày.");
    lines.push("Đầu ra: CHỈ một đối tượng JSON hợp lệ, không markdown, không text ngoài JSON.");
    lines.push('Schema: {"meta":{"disclaimer":"string"},"days":[{"dayIndex":1,"meals":{"breakfast":{"items":[{"foodId":"S01","nameVi":"","qty":150,"unit":"g"}],"exchanges":[{"group":"string","detail":"string"}],"recipe":"string","totals":{"kcal":0,"p":0,"l":0,"g":0}},"snack1":{},"lunch":{},"snack2":{},"dinner":{},"snack3":{}}}]}');
    lines.push("Ràng buộc:");
    lines.push("- Đúng 7 phần tử trong days; dayIndex từ 1 đến 7.");
    lines.push("- Mỗi meals phải có đủ 6 khóa: breakfast, snack1, lunch, snack2, dinner, snack3.");
    lines.push("- items: ưu tiên foodId trùng catalog; qty và unit khớp đơn vị trong catalog (g, ml, qua, hop, bat_nho...).");
    lines.push("- Đa dạng: không lặp lại cùng một món đạm chính (ví dụ cùng một loại cá/thịt chế biến giống hệt) trong trưa và tối của một ngày; cả tuần đổi món liên tục.");
    lines.push("- Chia năng lượng cả ngày gần với mục tiêu: ~" + payload.targets.dailyKcal + " kcal; đạm ~" + payload.targets.proteinG + " g; lipid ~" + payload.targets.lipidG + " g; glucid ~" + payload.targets.glucidG + " g.");
    lines.push("- recipe: tiếng Việt, 4–10 bước, an toàn với dietPrep kiêng/dị ứng trong prescription.");
    lines.push("- exchanges: mỗi bữa 2–5 dòng quy đổi KP hoặc gram tương đương cho đúng khối lượng bữa đó.");
    lines.push("- totals mỗi bữa: tổng kcal, P, L, G (số) ước lượng nhất quán với items.");
    lines.push("");
    lines.push("=== prescription (JSON kê đơn / bối cảnh lâm sàng) ===");
    lines.push(JSON.stringify(payload.prescription || {}));
    lines.push("");
    lines.push("=== foodCatalog: mỗi dòng id|name|unit|kcalPer100|p|l|g|cat|tag ===");
    var cat = payload.foodCatalog || [];
    for (var i = 0; i < cat.length; i++) {
      var f = cat[i];
      lines.push([f.id, f.name, f.unit, f.kcal, f.p, f.l, f.g, f.cat, f.tag].join("|"));
    }
    var raw = callGeminiAIJson_(lines.join("\n"));
    var plan = JSON.parse(raw);
    if (!plan.days || plan.days.length < 7) {
      return { ok: false, error: "AI không trả đủ 7 ngày (nhận được " + (plan.days ? plan.days.length : 0) + " ngày).", raw: raw };
    }
    return { ok: true, plan: plan };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * BRIDGE: KẾT NỐI GEMINI FLASH LATEST (Auto Stable Version)
 * Cập nhật: Sử dụng 'gemini-flash-latest' để tự động trỏ tới bản Flash ổn định nhất
 */
function callGeminiAI(userPrompt, contextData) {
  // 1. CẤU HÌNH API
  const API_KEY = getGeminiApiKey_();
  
  // SỬ DỤNG MODEL FLASH LATEST (Khắc phục triệt để lỗi version/quota)
  const MODEL_NAME = "gemini-flash-latest"; 
  
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  if (!API_KEY || API_KEY.length < 10) {
    return "⚠️ Lỗi: API Key chưa hợp lệ.";
  }

  // 2. PROMPT Y KHOA (SYSTEM INSTRUCTION)
  let systemInstruction = "Vai trò: Bạn là trợ lý AI chuyên gia về Dinh dưỡng lâm sàng trong ứng dụng CDSS (hỗ trợ ra quyết định lâm sàng).\n" +
                          "Nguyên tắc: Trả lời chính xác, dựa trên y học chứng cứ (Evidence-based Medicine).\n" + 
                          "Nhiệm vụ: Phân tích dữ liệu bệnh nhân và đưa ra gợi ý thực đơn hoặc cảnh báo dinh dưỡng.";
   
  if (contextData) {
    systemInstruction += `\n--- HỒ SƠ BỆNH ÁN / DỮ LIỆU --- \n${contextData}\n-------------------------------\n`;
  }

  // 3. PAYLOAD (Temperature thấp để giữ độ chính xác y khoa)
  const payload = {
    "contents": [{
      "parts": [{
        "text": systemInstruction + "\nCâu hỏi của Bác sĩ: " + userPrompt
      }]
    }],
    "generationConfig": {
      "temperature": 0.3, 
      "maxOutputTokens": 2048 
    },
    "safetySettings": [
      { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
      { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
      { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
      { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }
    ]
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  // 4. THỰC THI
  try {
    const response = UrlFetchApp.fetch(API_URL, options);
    const json = JSON.parse(response.getContentText());
    
    // Xử lý lỗi chi tiết từ Google trả về
    if (json.error) {
      Logger.log("LỖI API (" + MODEL_NAME + "): " + json.error.message);
      return `🛑 LỖI API: ${json.error.message}`;
    }

    if (json.candidates && json.candidates.length > 0) {
      return json.candidates[0].content.parts[0].text;
    } else {
      return "⚠️ AI không phản hồi nội dung (Empty response).";
    }

  } catch (e) {
    return "❌ Lỗi kết nối hệ thống: " + e.toString();
  }
}

/**
 * Hàm hỗ trợ kiểm tra danh sách Model (Utility)
 */
function checkAvailableModels() {
  const API_KEY = getGeminiApiKey_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    Logger.log("--- DANH SÁCH MODEL KHẢ DỤNG ---");
    if (data.models) {
        data.models.forEach(model => {
        // Chỉ hiện các model tạo nội dung (generateContent)
        if(model.supportedGenerationMethods && model.supportedGenerationMethods.includes("generateContent")) {
            Logger.log("Tên: " + model.name + " | Phiên bản: " + model.version);
        }
        });
    } else {
        Logger.log("Không lấy được danh sách model. Lỗi: " + JSON.stringify(data));
    }
  } catch (e) {
    Logger.log("Lỗi kiểm tra: " + e.toString());
  }
}

function setupAdminDatabase() {
  setupDatabaseStructure(getDatabase());
  return { success: true };
}

// ============================================================================
// XUẤT PHIẾU TƯ VẤN RA PDF + QR CODE
// ============================================================================

/** Tìm hoặc tạo thư mục lưu PDF phiếu tư vấn dinh dưỡng. */
function getOrCreatePdfFolder_() {
  var name = "DinhDuong_PDF_PhuongChau";
  var iter = DriveApp.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return DriveApp.createFolder(name);
}

/**
 * Sinh PDF từ HTML (toàn bộ #print_area) đã render ở client, lưu vào Drive,
 * trả về URL xem + URL tải về để client dựng QR.
 *
 * @param {string|Object} payloadJson { html, patientName, patientId }
 * @returns {{ok:boolean, viewUrl?:string, downloadUrl?:string, qrUrl?:string, id?:string, name?:string, error?:string}}
 */
function exportPrintAreaAsPdf(payloadJson) {
  try {
    var p = (typeof payloadJson === 'string') ? JSON.parse(payloadJson) : (payloadJson || {});
    var body = p.html || '';
    if (!body || !body.length) {
      return { ok: false, error: 'Không có nội dung HTML để xuất.' };
    }

    var safe = function (s, max) {
      return String(s || '').trim().replace(/[\\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, max || 60);
    };
    var pname = safe(p.patientName, 50) || 'BenhNhan';
    var pid = safe(p.patientId, 30);
    var ts = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmmss');
    var baseName = ['PhieuTuVanDD', pname, pid, ts].filter(function (x) { return !!x; }).join('_');

    var html = ''
      + '<!doctype html><html lang="vi"><head><meta charset="UTF-8"><title>' + baseName + '</title>'
      + '<style>'
      + '@page { size: A4; margin: 12mm; }'
      + 'body { font-family: Arial, "Times New Roman", sans-serif; color: #1a1a1a; font-size: 10.5pt; line-height: 1.4; }'
      + 'h2, h3, h4, h5, h6 { margin: 6px 0; }'
      + 'table { border-collapse: collapse; }'
      + 'td, th { vertical-align: top; }'
      + '.text-uppercase { text-transform: uppercase; }'
      + '.text-center { text-align: center; }'
      + '.text-end { text-align: right; }'
      + '.fw-bold { font-weight: bold; }'
      + '.text-muted { color: #666; }'
      + '.fst-italic { font-style: italic; }'
      + 'img { max-width: 100%; height: auto; }'
      + '</style></head><body>'
      + body
      + '</body></html>';

    var blob = Utilities.newBlob(html, 'text/html', baseName + '.html');
    var pdfBlob = blob.getAs('application/pdf').setName(baseName + '.pdf');
    var folder = getOrCreatePdfFolder_();
    var file = folder.createFile(pdfBlob);

    var sharingOk = false;
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      sharingOk = true;
    } catch (e1) {
      try {
        file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
        sharingOk = true;
      } catch (e2) {
        sharingOk = false;
      }
    }

    var id = file.getId();
    var view = 'https://drive.google.com/file/d/' + id + '/view';
    var download = 'https://drive.google.com/uc?export=download&id=' + id;
    var qr = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=' + encodeURIComponent(view);

    return {
      ok: true,
      id: id,
      name: file.getName(),
      viewUrl: view,
      downloadUrl: download,
      qrUrl: qr,
      sharing: sharingOk ? 'ANYONE_WITH_LINK' : 'PRIVATE'
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * Chạy thủ công 1 lần trong Apps Script Editor để đảm bảo có sheet APP_LOGS.
 * @returns {string}
 */
function setupAppLogsNow() {
  var ss = getDatabase();
  setupDatabaseStructure(ss, { preserveSheet1: true });
  var hasLogs = !!ss.getSheetByName("APP_LOGS");
  var names = ss.getSheets().map(function (s) { return s.getName(); }).join(", ");
  return hasLogs
    ? "Đã sẵn sàng APP_LOGS. Danh sách sheet: " + names
    : "Chưa tạo được APP_LOGS. Kiểm tra quyền file. Danh sách sheet: " + names;
}

function ensureDoctorsSheet_() {
  const ss = getDatabase();
  let sheet = ss.getSheetByName("DOCTORS");
  if (!sheet) {
    setupDatabaseStructure(ss);
    sheet = ss.getSheetByName("DOCTORS");
  }
  return sheet;
}

function getDoctorList() {
  // Bước 1: Danh sách bác sĩ lấy trực tiếp từ USERS (module quản trị user).
  const usersSheet = getUsersSheetReady_();
  const raw = usersSheet.getDataRange().getValues();
  if (!raw || raw.length < 2) return [];
  const headers = raw[0];
  const idxMap = getUsersColumnIndexMap_(headers);
  const c = {
    Email: resolveUsersColumnIndex_(headers, idxMap, "Email", 0),
    FullName: resolveUsersColumnIndex_(headers, idxMap, "FullName", 2),
    Role: resolveUsersColumnIndex_(headers, idxMap, "Role", 3),
    Status: resolveUsersColumnIndex_(headers, idxMap, "Status", 4),
    JobTitle: resolveUsersColumnIndex_(headers, idxMap, "JobTitle", 6)
  };

  return raw.slice(1)
    .map((row, index) => {
      const role = String(getCellSafe_(row, c.Role) || "").toUpperCase();
      const status = String(getCellSafe_(row, c.Status) || "ACTIVE").toUpperCase();
      const fullName = toClientText_(getCellSafe_(row, c.FullName)).trim();
      const jobTitle = toClientText_(getCellSafe_(row, c.JobTitle)).trim();
      const displayName = [jobTitle, fullName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      return {
        _rowIndex: index + 2,
        DoctorID: "USR_" + (index + 2),
        FullName: displayName || fullName,
        Specialty: role || "DOCTOR",
        AccountEmail: toClientText_(getCellSafe_(row, c.Email)).trim(),
        Status: status
      };
    })
    .filter(item =>
      item.AccountEmail &&
      item.FullName &&
      item.Status === "ACTIVE"
    );
}


// ============================================================================
// --- 3.2 MA TRẬN PHÂN QUYỀN (ROLE × MODULE × ACTION) ---
// ============================================================================
/**
 * Cấu trúc lưu trên sheet ROLE_PERMISSIONS:
 *   Role | Module | View | Edit | Delete | Export | UpdatedAt | UpdatedBy
 * - Role:      ADMIN | MANAGER | DOCTOR | DIETITIAN | NURSE | USER
 * - Module:    1..7 (Mod 1..Mod 7)
 * - View/Edit/Delete/Export: 1 = cho phép, 0 = cấm
 *
 * Phân nhóm:
 *   Nhân viên y tế: ADMIN, MANAGER, DOCTOR, DIETITIAN, NURSE
 *   Khách hàng:     USER
 */

var PERM_VALID_ROLES_   = ["ADMIN", "MANAGER", "DOCTOR", "DIETITIAN", "NURSE", "USER"];
var PERM_VALID_MODULES_ = [1, 2, 3, 4, 5, 6, 7];
var PERM_ACTIONS_       = ["View", "Edit", "Delete", "Export"];

function getRoleGroupsCatalog_() {
  return [
    {
      key: "MEDICAL",
      label: "Nhân viên y tế",
      icon: "fa-user-doctor",
      roles: [
        { id: "ADMIN",     label: "Quản trị hệ thống" },
        { id: "MANAGER",   label: "Trưởng khoa / Điều hành" },
        { id: "DOCTOR",    label: "Bác sĩ điều trị" },
        { id: "DIETITIAN", label: "Cử nhân dinh dưỡng" },
        { id: "NURSE",     label: "Điều dưỡng" }
      ]
    },
    {
      key: "CUSTOMER",
      label: "Khách hàng / Bệnh nhân",
      icon: "fa-user",
      roles: [
        { id: "USER", label: "Khách hàng (bệnh nhân)" }
      ]
    }
  ];
}

function getModuleCatalog_() {
  return [
    { id: 1, label: "Hồ sơ bệnh nhân" },
    { id: 2, label: "Đánh giá lâm sàng" },
    { id: 3, label: "Y lệnh & Thực đơn" },
    { id: 4, label: "Quản lý thực đơn" },
    { id: 5, label: "Phiếu tư vấn" },
    { id: 6, label: "Tra cứu kiến thức & AI" },
    { id: 7, label: "Quản trị hệ thống" }
  ];
}

/** Ma trận mặc định khi chưa có sheet hoặc khi nhấn “Khôi phục mặc định”. */
function getDefaultPermissionMatrix_() {
  // [V, E, D, X]
  var FULL = [1, 1, 1, 1];
  var VEX  = [1, 1, 0, 1];
  var VE   = [1, 1, 0, 0];
  var V    = [1, 0, 0, 0];
  var VX   = [1, 0, 0, 1];
  var NONE = [0, 0, 0, 0];

  return {
    ADMIN:     { 1: FULL, 2: FULL, 3: FULL, 4: FULL, 5: FULL, 6: FULL, 7: FULL },
    MANAGER:   { 1: VEX,  2: VEX,  3: VEX,  4: VEX,  5: VEX,  6: V,    7: V    },
    DOCTOR:    { 1: VEX,  2: VEX,  3: VEX,  4: VEX,  5: VEX,  6: V,    7: NONE },
    DIETITIAN: { 1: VEX,  2: VEX,  3: VEX,  4: VEX,  5: VEX,  6: V,    7: NONE },
    NURSE:     { 1: VE,   2: VE,   3: V,    4: V,    5: VX,   6: V,    7: NONE },
    USER:      { 1: V,    2: NONE, 3: NONE, 4: NONE, 5: VX,   6: V,    7: NONE }
  };
}

function getPermissionsSheetReady_() {
  var ss = getDatabase();
  var sheet = ss.getSheetByName("ROLE_PERMISSIONS");
  if (!sheet) {
    sheet = ss.insertSheet("ROLE_PERMISSIONS");
    sheet.appendRow(["Role", "Module", "View", "Edit", "Delete", "Export", "UpdatedAt", "UpdatedBy"]);
    sheet.setFrozenRows(1);
    seedPermissionMatrix_(sheet, getDefaultPermissionMatrix_(), "SYSTEM");
  } else {
    var rng = sheet.getDataRange().getValues();
    if (!rng || rng.length < 2) {
      sheet.clear();
      sheet.appendRow(["Role", "Module", "View", "Edit", "Delete", "Export", "UpdatedAt", "UpdatedBy"]);
      sheet.setFrozenRows(1);
      seedPermissionMatrix_(sheet, getDefaultPermissionMatrix_(), "SYSTEM");
    }
  }
  return sheet;
}

function seedPermissionMatrix_(sheet, matrix, updatedBy) {
  var rows = [];
  var now = new Date();
  PERM_VALID_ROLES_.forEach(function (role) {
    PERM_VALID_MODULES_.forEach(function (mod) {
      var arr = (matrix[role] && matrix[role][mod]) || [0, 0, 0, 0];
      rows.push([role, mod, arr[0] ? 1 : 0, arr[1] ? 1 : 0, arr[2] ? 1 : 0, arr[3] ? 1 : 0, now, updatedBy || "SYSTEM"]);
    });
  });
  if (rows.length) sheet.getRange(2, 1, rows.length, 8).setValues(rows);
}

function readPermissionMatrixFromSheet_(sheet) {
  var data = sheet.getDataRange().getValues();
  var matrix = {};
  PERM_VALID_ROLES_.forEach(function (r) {
    matrix[r] = {};
    PERM_VALID_MODULES_.forEach(function (m) { matrix[r][m] = [0, 0, 0, 0]; });
  });
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var role = String(row[0] || "").trim().toUpperCase();
    var mod  = parseInt(row[1], 10);
    if (!role || !mod) continue;
    if (!matrix[role]) continue;
    if (PERM_VALID_MODULES_.indexOf(mod) === -1) continue;
    matrix[role][mod] = [
      Number(row[2]) ? 1 : 0,
      Number(row[3]) ? 1 : 0,
      Number(row[4]) ? 1 : 0,
      Number(row[5]) ? 1 : 0
    ];
  }
  return matrix;
}

/** Trả về toàn bộ ma trận để hiển thị Mod 7. */
function quanTriLayMaTranPhanQuyen() {
  try {
    var sheet = getPermissionsSheetReady_();
    return {
      success: true,
      groups: getRoleGroupsCatalog_(),
      modules: getModuleCatalog_(),
      actions: PERM_ACTIONS_,
      matrix: readPermissionMatrixFromSheet_(sheet)
    };
  } catch (e) {
    return { error: "Không lấy được ma trận phân quyền: " + (e && e.message ? e.message : e) };
  }
}

/** Lưu ma trận mới (do ADMIN bấm Lưu). */
function quanTriLuuMaTranPhanQuyen(matrixObj, currentEmail) {
  if (!matrixObj || typeof matrixObj !== "object") return { error: "Dữ liệu ma trận không hợp lệ." };
  try {
    var sheet = getPermissionsSheetReady_();
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
    seedPermissionMatrix_(sheet, matrixObj, currentEmail || "ADMIN_PANEL");
    writeAppLog_("ADMIN", "SAVE_PERMISSION_MATRIX", currentEmail || "ADMIN_PANEL", "ALL", { roles: PERM_VALID_ROLES_.length }, "SUCCESS");
    return { success: true, message: "Đã lưu ma trận phân quyền." };
  } catch (e) {
    return { error: "Lỗi lưu ma trận phân quyền: " + (e && e.message ? e.message : e) };
  }
}

/** Khôi phục ma trận về mặc định. */
function quanTriResetMaTranPhanQuyen(currentEmail) {
  try {
    var sheet = getPermissionsSheetReady_();
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
    seedPermissionMatrix_(sheet, getDefaultPermissionMatrix_(), currentEmail || "ADMIN_PANEL");
    writeAppLog_("ADMIN", "RESET_PERMISSION_MATRIX", currentEmail || "ADMIN_PANEL", "ALL", {}, "SUCCESS");
    return { success: true, message: "Đã khôi phục ma trận phân quyền mặc định.", matrix: readPermissionMatrixFromSheet_(sheet) };
  } catch (e) {
    return { error: "Lỗi reset ma trận: " + (e && e.message ? e.message : e) };
  }
}

/**
 * Lấy quyền của user hiện tại (dùng cho client áp UI restriction).
 * Trả về { role, perms: { 1: {view,edit,delete,export}, ..., 7: {...} } }
 */
function quanTriLayQuyenCuaToi(email) {
  try {
    if (!email) return { error: "Thiếu email." };
    var users = getUsersSheetReady_();
    var data = users.getDataRange().getValues();
    var idx = getUsersColumnIndexMap_(data[0]);
    var role = "USER";
    var target = String(email).trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idx.Email]).trim().toLowerCase() === target) {
        role = String(data[i][idx.Role] || "USER").toUpperCase();
        break;
      }
    }
    if (PERM_VALID_ROLES_.indexOf(role) === -1) role = "USER";

    var matrix = readPermissionMatrixFromSheet_(getPermissionsSheetReady_());
    var perms = {};
    PERM_VALID_MODULES_.forEach(function (m) {
      var arr = (matrix[role] && matrix[role][m]) || [0, 0, 0, 0];
      perms[m] = { view: !!arr[0], edit: !!arr[1], delete: !!arr[2], export: !!arr[3] };
    });
    return { success: true, role: role, perms: perms };
  } catch (e) {
    return { error: "Không lấy được quyền: " + (e && e.message ? e.message : e) };
  }
}

/** Chạy 1 lần trong Trình chỉnh sửa Apps Script: cập nhật THU_VIEN_URL sang CDN gh-pages. */
function fixThuVienUrlConfig() {
  var ss = getDatabase();
  var sheet = ss.getSheetByName("SYS_CONFIG");
  if (!sheet) throw new Error("Không có sheet SYS_CONFIG");
  var data = sheet.getDataRange().getValues();
  var url = getThuVienCdnUrl_();
  var found = false;
  var i;
  for (i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === "THU_VIEN_URL") {
      sheet.getRange(i + 1, 2).setValue(url);
      found = true;
      break;
    }
  }
  if (!found) sheet.appendRow(["THU_VIEN_URL", url, "URL nhúng thư viện tra cứu", "TEXT"]);
  Logger.log("Đã đặt THU_VIEN_URL = " + url);
  return url;
}

// sync 2026-06-09 thu-vien fix
