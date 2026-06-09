# Android WebView - CDSS Dinh dưỡng lâm sàng

Project Android dong goi web app Google Apps Script thanh ung dung Android.

## Chuc nang da cau hinh

- Mo web app trong `WebView`.
- Splash screen khi khoi dong.
- Kiem tra ket noi mang, hien thong bao offline + nut `Thu lai`.
- Thanh loading tien trinh tai trang.
- Nut **Lam moi trang** (khong dung pull-to-refresh de tranh lam moi nham).
- Ho tro upload file tu web app (input type file).
- Mo link ngoai (`tel:`, `mailto:`, app links) bang app he thong.
- Nut Back: quay lai trang truoc trong WebView, neu het lich su thi thoat app.
- Khoa man hinh doc (`portrait`).
- Cau hinh bao mat co ban: tat cleartext traffic, network security config.

## Link web app hien tai

Duoc cau hinh tai `gradle.properties`:

`WEB_APP_URL=https://script.google.com/macros/s/AKfycbyDSJNY44Ob575D6Ulo9xqFGd0P2TZb-QlCXcEjoAhB/exec`

Neu ban deploy moi, doi URL tai day roi Sync lai Gradle.

## Cach build APK

1. Mo thu muc `android-webview` bang Android Studio.
2. Cho Android Studio sync Gradle lan dau.
3. Vao menu `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
4. APK output thuong nam o:
   - `app/build/outputs/apk/debug/app-debug.apk`

## Tao ban phat hanh

1. Tao file `keystore.properties` tai thu muc `android-webview` dua theo mau `keystore.properties.example`.
2. Dat file key (`.jks`) vao duong dan da khai bao trong `storeFile`.
3. Chay build release:
   - Android Studio: `Build > Generate Signed Bundle / APK`
   - hoac CLI: `./gradlew bundleRelease`
4. File AAB output:
   - `app/build/outputs/bundle/release/app-release.aab`
5. Cai thu ban release len thiet bi va test day du.

## Checklist truoc khi ban giao "san pham cuoi"

1. Kiem tra URL dang la production (`/exec`) trong `gradle.properties`.
2. Tang `versionCode` va `versionName` truoc moi lan phat hanh.
3. Tao Signed AAB (`bundleRelease`) de dua len Google Play.
4. Kiem tra tren toi thieu 3 nhom Android: 8/10/13.
5. Chay smoke test: dang nhap, luu phieu, xem module 6, chat AI, in module 5.
6. Kiem tra upload file tai module tham khao (WebView file chooser).
