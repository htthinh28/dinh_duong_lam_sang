#!/usr/bin/env python3
"""Patch thu-vien index files for clinical pathway JCI template integration."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    ROOT / "thu-vien" / "index.html",
    ROOT / "thu-vien" / "index-thu-vien-source.txt",
    ROOT / "thu-vien" / "Dược thư Phương Châu - CHỈ MỞ FILE NÀY.html",
]

PROMPT_ENTRY = r"""            { id: 'phacdo-11-clinical-pathway-jci', cat: 'phacdo', title: "11. Phác đồ điều trị JCI (Clinical Pathway) — 7 phần", tags: ["phác đồ", "JCI", "CDSS", "ICD-10", "TT23", "TT37", "ban soạn thảo"],
              desc: "Mẫu chuẩn soạn phác đồ điều trị JCI cho bệnh lý làm mã bệnh chính ICD-10.",
              text: "Vai trò: Bạn là một Chuyên gia Y tế cấp cao và Nhà quản lý chất lượng bệnh viện theo tiêu chuẩn quốc tế JCI.\n\nNhiệm vụ: Hãy xây dựng Phác đồ điều trị (Clinical Pathway) chi tiết cho bệnh lý: {{ten_benh_ly}} — Mã ICD-10: {{ma_icd10}}.\n\nYÊU CẦU VỀ CẤU TRÚC PHÁC ĐỒ (Bắt buộc 7 phần):\n\nHành chính: Ghi rõ mã số phác đồ và phiên bản.\n\nĐại cương: Trình bày định nghĩa, tổng quan bệnh lý và định danh chính xác mã ICD-10.\n\nChẩn đoán:\nLâm sàng: Triệu chứng, hội chứng kinh điển điển hình.\nCận lâm sàng: Ghi tên chỉ định theo đúng danh mục tại Thông tư 23/2024/TT-BYT.\nTiêu chuẩn chẩn đoán xác định và chẩn đoán phân biệt.\n\nĐiều trị:\nĐiều trị bằng thuốc: Ghi tên nhóm thuốc chung quốc tế, hoạt chất (ngăn cách bằng dấu phẩy), kèm liều dùng tối thiểu và tối đa.\nĐiều trị can thiệp/khác: Ghi tên dịch vụ và mã kỹ thuật theo Thông tư 23/2024/TT-BYT. Đảm bảo các chỉ định phù hợp với quy tắc giám định BHYT theo Thông tư 37/2024/TT-BYT.\nDinh dưỡng lâm sàng.\n\nTheo dõi & Tiên lượng: Các chỉ số cận lâm sàng cần theo dõi (ghi đúng tên theo Thông tư 23/2024/TT-BYT), thời gian tối đa kiểm tra lại (tính bằng ngày) và đánh giá tiên lượng.\n\nGiáo dục người bệnh (PFE): Thông tin tư vấn, giáo dục sức khỏe thiết thực, dễ hiểu cho người bệnh và gia đình.\n\nTài liệu tham khảo: Trình bày theo đúng định dạng yêu cầu (xem phần Trích dẫn).\n\nYÊU CẦU VỀ NGUỒN TÀI LIỆU VÀ TRÍCH DẪN:\n\nNguồn tra cứu: Chỉ sử dụng cơ sở dữ liệu Y khoa uy tín cao: UpToDate, PubMed/MEDLINE, Cochrane Library, ScienceDirect và các tạp chí thuộc Top 50 thế giới (ISI) được xác thực qua Web of Science/Scopus.\n\nTrích dẫn trong bài: Mọi luận điểm y khoa bắt buộc phải có trích dẫn xác thực, sử dụng số trong ngoặc vuông (Ví dụ: [1], [2]).\n\nXác minh: Bắt buộc kèm Link trúng đích/DOI đã được kiểm chứng chéo (tên bài báo, tạp chí, số báo, ngày tháng năm xuất bản).\n\nDanh mục tham khảo: Phải có ít nhất 40 nguồn tài liệu, trong đó ≥ 50% xuất bản trong 5 năm gần nhất. Định dạng danh mục theo kiểu Hanging Indent.\n\nVĂN PHONG VÀ ĐỊNH DẠNG:\n\nVăn phong khách quan, chuẩn xác tuyệt đối về y khoa, mang tư duy chiến lược phục vụ quản trị bệnh viện theo tiêu chuẩn JCI.\n\nTrình bày thông tin rõ ràng, mạch lạc, dễ dàng số hóa để tích hợp vào hệ thống Hỗ trợ ra quyết định lâm sàng (CDSS).\n\nSản phẩm đầu ra là file docx theo chuẩn văn bản Việt Nam." },"""

CSS_BLOCK = """
        .clinical-pathway-panel { margin-top: 1rem; padding: 0.85rem 1rem; background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%); border: 1px solid #99f6e4; border-radius: 0.75rem; }
        .clinical-pathway-panel-title { font-size: 0.8rem; font-weight: 800; color: #0f766e; margin-bottom: 0.45rem; display: flex; align-items: center; gap: 0.35rem; }
        .clinical-pathway-meta { font-size: 0.72rem; color: #475569; margin-bottom: 0.5rem; }
        .clinical-pathway-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .clinical-pathway-btn { font-size: 0.72rem; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 0.5rem; border: 1px solid #14b8a6; background: #fff; color: #0f766e; cursor: pointer; }
        .clinical-pathway-btn:hover { background: #ccfbf1; }
        .clinical-pathway-btn-primary { background: #0d9488; color: #fff; border-color: #0f766e; }
        .clinical-pathway-btn-primary:hover { background: #0f766e; }
        .clinical-pathway-status { display: inline-block; font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 0.25rem; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
"""

JS_BLOCK = r"""
        let clinicalPathwayIndex = null;
        let hdDieuTriCatalog = [];

        function loadClinicalPathwayIndex() {
            if (window.CLINICAL_PATHWAY_INDEX) return window.CLINICAL_PATHWAY_INDEX;
            return null;
        }

        function icdCanBePrimaryDiagnosis(x) {
            if (!x) return false;
            const flags = x.f || [];
            return !flags.includes('c');
        }

        function getClinicalPathwayEntry(ma) {
            ma = String(ma || '').toUpperCase();
            const idx = clinicalPathwayIndex || loadClinicalPathwayIndex();
            if (!idx || !idx.catalog) return null;
            return idx.catalog.find(function(it) { return String(it.icd || '').toUpperCase() === ma; }) || null;
        }

        function buildClinicalPathwayPromptText(ma, name) {
            const tpl = PROMT_CATALOG.find(function(p) { return p.id === 'phacdo-11-clinical-pathway-jci'; });
            if (!tpl) return '';
            return tpl.text
                .replace(/\{\{ten_benh_ly\}\}/g, name || ma)
                .replace(/\{\{ma_icd10\}\}/g, ma);
        }

        function openClinicalPathwayPromptFromEl(btn) {
            if (!btn) return;
            openClinicalPathwayPrompt(btn.getAttribute('data-cp-icd') || '', btn.getAttribute('data-cp-name') || '');
        }

        async function openClinicalPathwayPrompt(ma, name) {
            const text = buildClinicalPathwayPromptText(ma, name);
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
            } catch (_) {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            navigateToSection('promt');
            setTimeout(function() {
                promtActiveCategory = 'phacdo';
                promtActiveId = 'phacdo-11-clinical-pathway-jci';
                saveAppScreenState();
                initPromtModule();
                const status = document.getElementById('promtSearchStatus');
                if (status) status.textContent = 'Đã sao chép prompt phác đồ cho ' + ma + ' — dán vào AI.';
            }, 120);
        }

        function renderClinicalPathwayPanelForIcd(ma, x) {
            if (!icdCanBePrimaryDiagnosis(x)) return '';
            const entry = getClinicalPathwayEntry(ma);
            const name = icdTen(x);
            const status = entry ? (entry.status === 'published' ? 'Đã ban hành' : 'Mẫu JCI — chờ soạn') : 'Chưa có trong danh mục phác đồ';
            const pid = entry ? entry.pathwayId : ('PC-CP-' + ma.replace(/\./g, '-'));
            const ver = entry ? entry.version : '1.0-draft';
            const spec = entry ? entry.specialty : '';
            const refs = entry && entry.chandoanRefs && entry.chandoanRefs.length
                ? '<div class="mt-2 text-[11px] text-slate-600">Kháng sinh/Vi sinh liên quan: ' +
                    entry.chandoanRefs.map(function(r) {
                        return '<button type="button" class="icd-card-note-link" data-chandoan-nav="1" data-chandoan-nav-doc="' + escapeHTML(r.docId) + '" data-chandoan-nav-block="' + escapeHTML(r.blockId || '') + '">' + escapeHTML(r.blockTitle || r.blockId) + '</button>';
                    }).join(' · ') + '</div>'
                : '';
            const warnK = (x.f || []).includes('k') ? '<p class="text-[11px] text-amber-800 mt-1">Lưu ý: mã có cờ «Không khuyến khích làm bệnh chính» — cân nhắc mã cụ thể hơn khi mã hóa.</p>' : '';
            return '<div class="clinical-pathway-panel animate-fade-in">' +
                '<div class="clinical-pathway-panel-title"><i data-lucide="route" class="w-3.5 h-3.5"></i> Phác đồ điều trị (Clinical Pathway) — JCI</div>' +
                '<div class="clinical-pathway-meta"><span class="clinical-pathway-status">' + escapeHTML(status) + '</span> · ' + escapeHTML(pid) + ' · v' + escapeHTML(ver) +
                (spec ? ' · ' + escapeHTML(spec) : '') + '</div>' +
                '<p class="text-[11px] text-slate-600 mb-2">Cấu trúc 7 phần: Hành chính → Đại cương → Chẩn đoán → Điều trị → Theo dõi & Tiên lượng → PFE → Tài liệu tham khảo (≥40 nguồn, TT23/TT37).</p>' +
                warnK + refs +
                '<div class="clinical-pathway-actions">' +
                '<button type="button" class="clinical-pathway-btn clinical-pathway-btn-primary" data-cp-icd="' + escapeHTML(ma) + '" data-cp-name="' + escapeHTML(name) + '" onclick="openClinicalPathwayPromptFromEl(this)">Soạn phác đồ JCI (AI)</button>' +
                '<button type="button" class="clinical-pathway-btn" onclick="selectPromt(\'phacdo-11-clinical-pathway-jci\'); navigateToSection(\'promt\'); initPromtModule();">Xem mẫu prompt</button>' +
                '</div></div>';
        }

        function syncHdDieuTriFromPathwayIndex() {
            const idx = clinicalPathwayIndex || loadClinicalPathwayIndex();
            if (!idx || !idx.catalog) { hdDieuTriCatalog = []; return; }
            hdDieuTriCatalog = idx.catalog.map(function(it) {
                return {
                    id: it.id,
                    title: it.title,
                    icd: it.icd,
                    specialty: it.specialty,
                    code: it.pathwayId,
                    summary: 'Phác đồ JCI · ' + (it.status || 'template') + ' · v' + (it.version || '1.0')
                };
            });
        }

        function filterHdDieuTriCatalog() {
            syncHdDieuTriFromPathwayIndex();
        }
"""


def patch_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    original = text

    if "clinical-pathway/pathway-index.mjs" not in text:
        text = text.replace(
            '<script src="chandoan-html/khang-sinh-drug-filters.mjs"></script>',
            '<script src="chandoan-html/khang-sinh-drug-filters.mjs"></script>\n    <script src="clinical-pathway/pathway-index.mjs"></script>',
            1,
        )

    if "phacdo-11-clinical-pathway-jci" not in text:
        text = text.replace(
            '{ id: \'phacdo-10-tu-van-benh-nhan\'',
            PROMPT_ENTRY + "\n            { id: 'phacdo-10-tu-van-benh-nhan'",
            1,
        )

    if ".clinical-pathway-panel" not in text:
        text = text.replace(
            "        .chandoan-xref-panel {",
            CSS_BLOCK + "        .chandoan-xref-panel {",
            1,
        )

    if "function loadClinicalPathwayIndex" not in text:
        text = text.replace(
            "        let qtktCatalog = [];",
            JS_BLOCK + "\n        let qtktCatalog = [];",
            1,
        )

    if "renderClinicalPathwayPanelForIcd" not in text:
        text = text.replace(
            "${typeof renderChandoanXrefForIcd === 'function' ? renderChandoanXrefForIcd(ma) : ''}",
            "${typeof renderClinicalPathwayPanelForIcd === 'function' ? renderClinicalPathwayPanelForIcd(ma, x) : ''}\n                    ${typeof renderChandoanXrefForIcd === 'function' ? renderChandoanXrefForIcd(ma) : ''}",
            1,
        )

    if "clinicalPathwayIndex = loadClinicalPathwayIndex()" not in text:
        text = text.replace(
            "        function initBytDocModules() {\n            try {\n                const el = document.getElementById('hd-dieutri-data-json');",
            "        function initBytDocModules() {\n            clinicalPathwayIndex = loadClinicalPathwayIndex();\n            try {\n                const el = document.getElementById('hd-dieutri-data-json');",
            1,
        )

    if text == original:
        print(f"No changes needed: {path}")
    else:
        path.write_text(text, encoding="utf-8")
        print(f"Patched: {path}")


def main():
    for target in TARGETS:
        if target.exists():
            patch_file(target)
        else:
            print(f"Skip missing: {target}")


if __name__ == "__main__":
    main()
