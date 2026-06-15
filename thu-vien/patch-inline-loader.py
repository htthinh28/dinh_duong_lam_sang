#!/usr/bin/env python3
"""Áp dụng patch JS tra cứu inline cho index.html và bản source."""
from pathlib import Path

FILES = [
    Path(__file__).parent / 'index.html',
    Path(__file__).parent / 'index-thu-vien-source.txt',
    Path(__file__).parent / 'Dược thư Phương Châu - CHỈ MỞ FILE NÀY.html',
]

OLD_LOAD = '''let ksModuleReady = false;


        function loadChandoanEmbeddedData() {
            const meta = window.KS_CHANDOAN_META;
            try {
                if (meta && meta.catalog && meta.catalog.length) {
                    chandoanCatalog = meta.catalog;
                } else {
                    const el = document.getElementById('chandoan-data-json');
                    if (el && el.textContent && el.textContent.trim()) {
                        chandoanCatalog = JSON.parse(el.textContent.trim());
                    }
                }
            } catch (e) {
                console.warn('Kháng sinh: không đọc được catalog', e);
                chandoanCatalog = [];
            }
            try {
                if (meta && meta.infographics && Object.keys(meta.infographics).length) {
                    chandoanInfographics = meta.infographics;
                } else {
                    const el = document.getElementById('chandoan-infographics-json');
                    if (el && el.textContent && el.textContent.trim()) {
                        chandoanInfographics = JSON.parse(el.textContent.trim());
                    }
                }
            } catch (e) {
                console.warn('Kháng sinh: không đọc được infographic', e);
                chandoanInfographics = {};
            }
            try {
                if (window.VS_CHANDOAN_META) {
                    var _vsWarn = document.getElementById('ksVsLoadWarning');
                    if (_vsWarn) _vsWarn.classList.add('hidden');
                    if (window.VS_CHANDOAN_META.catalog && window.VS_CHANDOAN_META.catalog.length) {
                        chandoanCatalog = chandoanCatalog.concat(window.VS_CHANDOAN_META.catalog);
                    }
                    if (window.VS_CHANDOAN_META.infographics) {
                        Object.assign(chandoanInfographics, window.VS_CHANDOAN_META.infographics);
                    }
                } else {
                    console.warn('Vi sinh: chưa tải VS_CHANDOAN_META — kiểm tra chandoan-html/vi-sinh-lam-sang-2025-meta.mjs');
                }
            } catch (e) { console.warn('Vi sinh: không đọc được meta', e); }
            try { buildChandoanCrossRefIndex(); } catch (e) { console.warn('Kháng sinh xref', e); }
            if (chandoanCatalog.length) buildKsFlatItems();
            showVsLoadWarning();
        }'''

NEW_LOAD = '''let ksModuleReady = false;

        /** Tra cứu fulltext theo thẻ (block) — nhúng sẵn, lazy parse, không fetch mạng */
        const _chandoanHtmlBlockCache = Object.create(null);
        const _chandoanHtmlDocCache = Object.create(null);
        const _chandoanHtmlLazyProxy = Object.create(null);

        function readVsChandoanMetaInline() {
            if (window.VS_CHANDOAN_META) return window.VS_CHANDOAN_META;
            try {
                const el = document.getElementById('vs-chandoan-meta-json');
                if (el && el.textContent && el.textContent.trim()) {
                    window.VS_CHANDOAN_META = JSON.parse(el.textContent.trim());
                    return window.VS_CHANDOAN_META;
                }
            } catch (e) { console.warn('Vi sinh meta inline', e); }
            return null;
        }

        function readChandoanHtmlBlockInline(docId, blockId) {
            const key = docId + '::' + blockId;
            if (_chandoanHtmlBlockCache[key]) return _chandoanHtmlBlockCache[key];
            const el = document.querySelector(
                'script.chandoan-html-block-chunk[data-doc="' + CSS.escape(docId) + '"][data-block="' + CSS.escape(blockId) + '"]'
            );
            if (!el || !el.textContent.trim()) return null;
            try {
                const block = JSON.parse(el.textContent);
                _chandoanHtmlBlockCache[key] = block;
                return block;
            } catch (e) {
                console.warn('Chandoan inline block', docId, blockId, e);
                return null;
            }
        }

        function ensureChandoanHtmlDocStore(docId) {
            if (_chandoanHtmlDocCache[docId]) return _chandoanHtmlDocCache[docId];
            if (window.CHANDOAN_HTML_CONTENT && window.CHANDOAN_HTML_CONTENT[docId]) {
                _chandoanHtmlDocCache[docId] = window.CHANDOAN_HTML_CONTENT[docId];
                return _chandoanHtmlDocCache[docId];
            }
            const chunks = document.querySelectorAll(
                'script.chandoan-html-block-chunk[data-doc="' + CSS.escape(docId) + '"]'
            );
            if (!chunks.length) return null;
            const store = Object.create(null);
            chunks.forEach(function(el) {
                const bid = el.getAttribute('data-block');
                if (!bid) return;
                try {
                    store[bid] = JSON.parse(el.textContent);
                    _chandoanHtmlBlockCache[docId + '::' + bid] = store[bid];
                } catch (e) { console.warn('Chandoan chunk', docId, bid, e); }
            });
            if (Object.keys(store).length) {
                _chandoanHtmlDocCache[docId] = store;
                if (!window.CHANDOAN_HTML_CONTENT) window.CHANDOAN_HTML_CONTENT = {};
                window.CHANDOAN_HTML_CONTENT[docId] = store;
            }
            return store;
        }

        function getChandoanHtmlBlock(docId, blockId) {
            if (!docId || !blockId) return null;
            const store = ensureChandoanHtmlDocStore(docId);
            if (store && store[blockId]) return store[blockId];
            return readChandoanHtmlBlockInline(docId, blockId);
        }

        function getChandoanHtmlLazyStore(docId) {
            if (!docId) return null;
            if (window.CHANDOAN_HTML_CONTENT && window.CHANDOAN_HTML_CONTENT[docId]) {
                return window.CHANDOAN_HTML_CONTENT[docId];
            }
            if (_chandoanHtmlDocCache[docId]) return _chandoanHtmlDocCache[docId];
            if (!_chandoanHtmlLazyProxy[docId]) {
                _chandoanHtmlLazyProxy[docId] = new Proxy(Object.create(null), {
                    get: function(_t, prop) {
                        if (typeof prop !== 'string' || prop === 'then') return undefined;
                        return getChandoanHtmlBlock(docId, prop);
                    }
                });
            }
            return _chandoanHtmlLazyProxy[docId];
        }

        function hasInlineChandoanBlocks(docId) {
            return !!document.querySelector('script.chandoan-html-block-chunk[data-doc="' + CSS.escape(docId) + '"]');
        }

        function loadChandoanEmbeddedData() {
            const meta = window.KS_CHANDOAN_META;
            try {
                if (meta && meta.catalog && meta.catalog.length) {
                    chandoanCatalog = meta.catalog;
                } else {
                    const el = document.getElementById('chandoan-data-json');
                    if (el && el.textContent && el.textContent.trim()) {
                        chandoanCatalog = JSON.parse(el.textContent.trim());
                    }
                }
            } catch (e) {
                console.warn('Kháng sinh: không đọc được catalog', e);
                chandoanCatalog = [];
            }
            try {
                if (meta && meta.infographics && Object.keys(meta.infographics).length) {
                    chandoanInfographics = meta.infographics;
                } else {
                    const el = document.getElementById('chandoan-infographics-json');
                    if (el && el.textContent && el.textContent.trim()) {
                        chandoanInfographics = JSON.parse(el.textContent.trim());
                    }
                }
            } catch (e) {
                console.warn('Kháng sinh: không đọc được infographic', e);
                chandoanInfographics = {};
            }
            try {
                const vsMeta = readVsChandoanMetaInline();
                if (vsMeta) {
                    var _vsWarn = document.getElementById('ksVsLoadWarning');
                    if (_vsWarn) _vsWarn.classList.add('hidden');
                    if (vsMeta.catalog && vsMeta.catalog.length) {
                        const seen = new Set(chandoanCatalog.map(function(x) { return x.id; }));
                        vsMeta.catalog.forEach(function(doc) {
                            if (doc && doc.id && !seen.has(doc.id)) {
                                chandoanCatalog.push(doc);
                                seen.add(doc.id);
                            }
                        });
                    }
                    if (vsMeta.infographics) {
                        Object.assign(chandoanInfographics, vsMeta.infographics);
                    }
                } else if (!hasInlineChandoanBlocks(VS_DOC_ID)) {
                    console.warn('Vi sinh: chưa có meta nhúng — chạy embed-chandoan-inline.mjs');
                }
            } catch (e) { console.warn('Vi sinh: không đọc được meta', e); }
            try { buildChandoanCrossRefIndex(); } catch (e) { console.warn('Kháng sinh xref', e); }
            if (chandoanCatalog.length) buildKsFlatItems();
            showVsLoadWarning();
        }'''

OLD_KS_GET = '''function ksGetHtmlStore(docId) {
            return (window.CHANDOAN_HTML_CONTENT && window.CHANDOAN_HTML_CONTENT[docId]) || null;
        }'''

NEW_KS_GET = '''function ksGetHtmlStore(docId) {
            return getChandoanHtmlLazyStore(docId);
        }'''

OLD_VS_WARN = '''function showVsLoadWarning() {
            if (window.VS_CHANDOAN_META && window.VS_CHANDOAN_META.catalog && window.VS_CHANDOAN_META.catalog.length) return;
            var bar = document.getElementById('ksVsLoadWarning');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'ksVsLoadWarning';
                bar.className = 'mx-3 sm:mx-4 md:mx-6 mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-semibold';
                bar.textContent = 'Không tải được Vi sinh lâm sàng — đặt thư mục chandoan-html cạnh file HTML và bấm Ctrl+F5.';
                var ws = document.getElementById('ksWorkspace');
                if (ws && ws.parentNode) ws.parentNode.insertBefore(bar, ws);
            }
            bar.classList.remove('hidden');
        }'''

NEW_VS_WARN = '''function showVsLoadWarning() {
            const vsMeta = readVsChandoanMetaInline();
            const hasVsCatalog = !!(vsMeta && vsMeta.catalog && vsMeta.catalog.length)
                || chandoanCatalog.some(function(x) { return x.id === VS_DOC_ID; });
            const hasVsHtml = hasInlineChandoanBlocks(VS_DOC_ID)
                || !!(window.CHANDOAN_HTML_CONTENT && window.CHANDOAN_HTML_CONTENT[VS_DOC_ID]);
            if (hasVsCatalog && hasVsHtml) {
                var hideBar = document.getElementById('ksVsLoadWarning');
                if (hideBar) hideBar.classList.add('hidden');
                return;
            }
            var bar = document.getElementById('ksVsLoadWarning');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'ksVsLoadWarning';
                bar.className = 'mx-3 sm:mx-4 md:mx-6 mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm font-semibold';
                bar.textContent = 'Không tải được Vi sinh lâm sàng — mở bản HTML đầy đủ (đã nhúng thẻ) hoặc chạy embed-chandoan-inline.mjs.';
                var ws = document.getElementById('ksWorkspace');
                if (ws && ws.parentNode) ws.parentNode.insertBefore(bar, ws);
            }
            bar.classList.remove('hidden');
        }'''

OLD_BOOT = '''            finishAppScreenRestore(saved);
            try {
                window.parent.postMessage({ type: 'thuVienAppReady', v: 1 }, '*');
            } catch (e) { /* nhúng iframe */ }
        }'''

NEW_BOOT = '''            finishAppScreenRestore(saved);
            try {
                window.parent.postMessage({ type: 'thuVienAppReady', v: 2, shell: true }, '*');
            } catch (e) { /* nhúng iframe */ }
            loadChandoanEmbeddedData();
            try {
                window.parent.postMessage({
                    type: 'thuVienDataReady',
                    v: 1,
                    chandoan: chandoanCatalog.length,
                    inlineKs: hasInlineChandoanBlocks(KS_DOC_ID),
                    inlineVs: hasInlineChandoanBlocks(VS_DOC_ID),
                }, '*');
            } catch (e) { /* nhúng iframe */ }
        }'''

OLD_BOOT_SOURCE = '''            finishAppScreenRestore(saved);
        }'''

NEW_BOOT_SOURCE = '''            finishAppScreenRestore(saved);
            loadChandoanEmbeddedData();
        }'''

DUP_MARKER = '''        function ksGetPriorityDrugLabels() {
            if (!ksDrugFilterDefs.length) loadKsDrugFilters();
            return ksDrugFilterDefs.filter(function(d) { return d.priority; }).map(function(d) {
                return (d.label || '').replace(/\\*+$/, '').trim();
            }).filter(Boolean).sort(function(a, b) { return b.length - a.length; });
        }

        function highlightKsPriorityDrugs(html) {
            if (!html) return html;
            const labels = ksGetPriorityDrugLabels();
            if (!labels.length) return html;
            let out = html;
            labels.forEach(function(label) {
                const esc = label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
                const re = new RegExp('(?!<mark class="ks-priority-abx">)(' + esc + ')(?![^<]*>)(?![^<]*</mark>)', 'gi');
                out = out.replace(re, '<mark class="ks-priority-abx">$1</mark>');
            });
            return out.replace(/(<mark class="ks-priority-abx">)([^<]*)(<mark class="ks-priority-abx">)/g, '$1$2');
        }

        function ksGetPriorityDrugLabels() {'''


def patch_text(text: str) -> str:
    if 'getChandoanHtmlLazyStore' in text:
        boot_done = 'thuVienDataReady' in text or (
            'loadChandoanEmbeddedData();' in text and 'function bootAppNavigation' in text
            and text.find('loadChandoanEmbeddedData();', text.find('function bootAppNavigation')) > 0
        )
        if boot_done:
            return text
    replacements = [
        (OLD_LOAD, NEW_LOAD),
        (OLD_KS_GET, NEW_KS_GET),
        (OLD_VS_WARN, NEW_VS_WARN),
    ]
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'Missing patch anchor: {old[:60]}...')
        text = text.replace(old, new, 1)
    if OLD_BOOT in text:
        text = text.replace(OLD_BOOT, NEW_BOOT, 1)
    elif OLD_BOOT_SOURCE in text:
        text = text.replace(OLD_BOOT_SOURCE, NEW_BOOT_SOURCE, 1)
    if DUP_MARKER in text:
        text = text.replace(DUP_MARKER, '        function ksGetPriorityDrugLabels() {', 1)
    return text


def main():
    for fp in FILES:
        if not fp.exists():
            continue
        raw = fp.read_text(encoding='utf-8')
        patched = patch_text(raw)
        if patched != raw:
            fp.write_text(patched, encoding='utf-8')
            print('Patched', fp.name)
        else:
            print('Already patched', fp.name)


if __name__ == '__main__':
    main()
