#!/usr/bin/env node
/**
 * Nhúng meta + fulltext Kháng sinh/Vi sinh vào index.html theo từng thẻ (block).
 * Tra cứu lazy: chỉ parse JSON của block khi người dùng mở mục — không fetch mạng.
 *
 * Chạy: node thu-vien/embed-chandoan-inline.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAN = path.join(__dirname, 'chandoan-html');
const INDEX = path.join(__dirname, 'index.html');
const SOURCE = path.join(__dirname, 'index-thu-vien-source.txt');
const MARKER_START = '<!-- CHANDOAN_INLINE_EMBED_BEGIN -->';
const MARKER_END = '<!-- CHANDOAN_INLINE_EMBED_END -->';

function loadMjs(file) {
  const g = { CHANDOAN_HTML_CONTENT: {}, KS_CHANDOAN_META: null, VS_CHANDOAN_META: null, KS_DRUG_FILTER_DATA: null };
  const code = fs.readFileSync(path.join(CHAN, file), 'utf8');
  // eslint-disable-next-line no-eval
  eval(code.replace(/\bwindow\./g, 'g.'));
  return g;
}

function escJsonInScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function buildBlockChunks(docId, blocks) {
  const lines = [];
  const ids = Object.keys(blocks).sort();
  for (const blockId of ids) {
    const block = blocks[blockId];
    lines.push(
      `<script type="application/json" class="chandoan-html-block-chunk" data-doc="${docId}" data-block="${blockId}">${escJsonInScript(block)}</script>`
    );
  }
  return lines;
}

function buildEmbedSection() {
  const ksHtml = loadMjs('khang-sinh-2015.mjs');
  const vsHtml = loadMjs('vi-sinh-lam-sang-2025.mjs');
  const vsMeta = loadMjs('vi-sinh-lam-sang-2025-meta.mjs');

  const ksBlocks = ksHtml.CHANDOAN_HTML_CONTENT['khang-sinh-2015'] || {};
  const vsBlocks = vsHtml.CHANDOAN_HTML_CONTENT['vi-sinh-lam-sang-2025'] || {};
  const vsMetaObj = vsMeta.VS_CHANDOAN_META;

  const parts = [MARKER_START];
  parts.push('<!-- Meta Vi sinh + fulltext nhúng theo thẻ — không cần tải chandoan-html/*.mjs -->');

  if (vsMetaObj) {
    parts.push(`<script type="application/json" id="vs-chandoan-meta-json">${escJsonInScript(vsMetaObj)}</script>`);
  }

  parts.push(`<!-- Kháng sinh: ${Object.keys(ksBlocks).length} thẻ fulltext -->`);
  parts.push(...buildBlockChunks('khang-sinh-2015', ksBlocks));
  parts.push(`<!-- Vi sinh: ${Object.keys(vsBlocks).length} thẻ fulltext -->`);
  parts.push(...buildBlockChunks('vi-sinh-lam-sang-2025', vsBlocks));
  parts.push(MARKER_END);

  return {
    html: parts.join('\n'),
    stats: {
      ksBlocks: Object.keys(ksBlocks).length,
      vsBlocks: Object.keys(vsBlocks).length,
      hasVsMeta: !!vsMetaObj,
    },
  };
}

function mergeCatalogJson(html, vsMetaObj) {
  if (!vsMetaObj?.catalog?.length) return html;
  const re = /(<script type="application\/json" id="chandoan-data-json">)([\s\S]*?)(<\/script>)/;
  const m = html.match(re);
  if (!m) return html;
  let catalog;
  try {
    catalog = JSON.parse(m[2]);
  } catch {
    return html;
  }
  const ids = new Set(catalog.map((x) => x.id));
  for (const doc of vsMetaObj.catalog) {
    if (!ids.has(doc.id)) catalog.push(doc);
  }
  return html.replace(re, `$1${escJsonInScript(catalog)}$3`);
}

function mergeInfographicsJson(html, vsMetaObj) {
  if (!vsMetaObj?.infographics) return html;
  const re = /(<script type="application\/json" id="chandoan-infographics-json">)([\s\S]*?)(<\/script>)/;
  const m = html.match(re);
  if (!m) return html;
  let infographics;
  try {
    infographics = JSON.parse(m[2]);
  } catch {
    return html;
  }
  Object.assign(infographics, vsMetaObj.infographics);
  return html.replace(re, `$1${escJsonInScript(infographics)}$3`);
}

function injectEmbed(html, embedHtml) {
  if (html.includes(MARKER_START)) {
    const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`, 'm');
    return html.replace(re, embedHtml);
  }
  const anchor = '<script type="application/json" id="chandoan-infographics-json">';
  const idx = html.indexOf(anchor);
  if (idx < 0) throw new Error('Không tìm thấy anchor chandoan-infographics-json');
  return html.slice(0, idx) + embedHtml + '\n    ' + html.slice(idx);
}

function stripExternalChandoanScripts(html) {
  return html
    .replace(/\s*<script src="chandoan-html\/[^"]+\.mjs"><\/script>\n?/g, '\n')
    .replace(
      /\s*<!-- Tùy chọn: tải thêm từ chandoan-html nếu có -->\n?/g,
      '\n'
    );
}

function patchFile(filePath, embedSection, vsMetaObj) {
  if (!fs.existsSync(filePath)) return false;
  let html = fs.readFileSync(filePath, 'utf8');
  html = mergeCatalogJson(html, vsMetaObj);
  html = mergeInfographicsJson(html, vsMetaObj);
  html = injectEmbed(html, embedSection.html);
  html = stripExternalChandoanScripts(html);
  fs.writeFileSync(filePath, html, 'utf8');
  return true;
}

const vsMeta = loadMjs('vi-sinh-lam-sang-2025-meta.mjs').VS_CHANDOAN_META;
const embedSection = buildEmbedSection();

console.log('Embedding chandoan inline:', embedSection.stats);

if (!patchFile(INDEX, embedSection, vsMeta)) throw new Error('Missing index.html');
patchFile(SOURCE, embedSection, vsMeta);

const duoc = path.join(__dirname, 'Dược thư Phương Châu - CHỈ MỞ FILE NÀY.html');
patchFile(duoc, embedSection, vsMeta);

console.log('Done. Files updated with inline chandoan blocks.');
