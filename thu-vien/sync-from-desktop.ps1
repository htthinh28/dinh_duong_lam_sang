# Dong bo thu muc Thu vien tu Desktop vao module thu-vien (GitHub Pages)
$ErrorActionPreference = 'Stop'
$src = 'C:\Users\admin\Desktop\Thu vien'
$dst = Join-Path $PSScriptRoot '.'

if (-not (Test-Path -LiteralPath $src)) {
    throw "Khong tim thay: $src"
}

$indexTxt = Join-Path $src 'index thu vien.txt'
if (Test-Path -LiteralPath $indexTxt) {
    $main = Get-Item -LiteralPath $indexTxt
} else {
    $main = Get-ChildItem -LiteralPath $src -File -Filter '*.html' |
        Where-Object { $_.Length -gt 1MB } |
        Sort-Object Length -Descending |
        Select-Object -First 1
}
if (-not $main) { throw 'Khong tim thay index thu vien.txt hoac file HTML chinh tren Desktop.' }

function Sync-Dir($name) {
    $from = Join-Path $src $name
    $to = Join-Path $dst $name
    if (Test-Path -LiteralPath $from) {
        New-Item -ItemType Directory -Force -Path $to | Out-Null
        robocopy $from $to /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    }
}

Sync-Dir 'chandoan-html'
Sync-Dir 'pdfs'

$nd90 = Join-Path $src 'Nghi dinh 90 2026.html'
if (Test-Path -LiteralPath $nd90) {
    Copy-Item -LiteralPath $nd90 -Destination (Join-Path $dst 'Nghi dinh 90 2026.html') -Force
}

Copy-Item -LiteralPath $main.FullName -Destination (Join-Path $dst 'index.html') -Force
if ($main.Extension -ieq '.txt') {
    Copy-Item -LiteralPath $main.FullName -Destination (Join-Path $dst 'index-thu-vien-source.txt') -Force
} else {
    Copy-Item -LiteralPath $main.FullName -Destination (Join-Path $dst $main.Name) -Force
}

$chan = Join-Path $dst 'chandoan-html'
Get-ChildItem -LiteralPath $chan -Filter '*.js' -ErrorAction SilentlyContinue | ForEach-Object {
    $mjs = [System.IO.Path]::ChangeExtension($_.FullName, '.mjs')
    if (Test-Path -LiteralPath $mjs) { Remove-Item -LiteralPath $mjs -Force }
    Move-Item -LiteralPath $_.FullName -Destination $mjs -Force
}

$extraHtml = if ($main.Extension -ieq '.txt') { 'index-thu-vien-source.txt' } else { $main.Name }
foreach ($html in @('index.html', $extraHtml)) {
    $path = Join-Path $dst $html
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $text = [System.IO.File]::ReadAllText($path)
    $text = $text.Replace('chandoan-html/khang-sinh-2015-meta.js', 'chandoan-html/khang-sinh-2015-meta.mjs')
    $text = $text.Replace('chandoan-html/khang-sinh-2015.js', 'chandoan-html/khang-sinh-2015.mjs')
    $text = $text.Replace('chandoan-html/vi-sinh-lam-sang-2025-meta.js', 'chandoan-html/vi-sinh-lam-sang-2025-meta.mjs')
    $text = $text.Replace('chandoan-html/vi-sinh-lam-sang-2025.js', 'chandoan-html/vi-sinh-lam-sang-2025.mjs')
    $text = $text.Replace('chandoan-html/khang-sinh-drug-filters.js', 'chandoan-html/khang-sinh-drug-filters.mjs')
    $text = $text.Replace('vi-sinh-lam-sang-2025-meta.js', 'vi-sinh-lam-sang-2025-meta.mjs')
    [System.IO.File]::WriteAllText($path, $text)
}

Write-Host "Da dong bo thu vien tu Desktop -> $dst"
