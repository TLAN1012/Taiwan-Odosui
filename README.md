# Taiwan-Odosui 機車考照模擬

自用的台灣機車駕照筆試練習程式：題目、條文、詳解、模擬考。名字取自「歐托拜」（日語オートバイ，機車），大家都說尾字「敗」不好，改成 sui，美的意思。

純靜態網頁（無框架、無建置步驟），部署在 GitHub Pages；作答紀錄只存在使用者自己瀏覽器的 localStorage。

## 功能
- 逐題練習：官方題庫（隨機、圖片題、三大類）、自編題依主題、還沒練過的、收藏；答完立刻對答案，自編題另有詳解與條文原文（引用句標黃）
- 模擬考：官方題庫（三選一）或自編題（四選一），50 題、30 分鐘、每題 2 分、85 分及格；交卷前不顯示對錯，交卷後檢討錯題；未交卷可續考
- 條文查詢：處罰條例、安全規則、標誌標線號誌設置規則，可搜尋，條文旁列出相關題目
- 錯題本：答對後自動移出

## 資料
- `data/laws.json`：由 `tools/build_laws.py` 從[全國法規資料庫](https://law.moj.gov.tw/)抓取（政府資料開放授權條款第 1 版）。已公布但尚未施行的修正條文（例如處罰條例第 35 條酒駕罰則）保留現行有效版本，並附上尚未施行的版本。
- `data/official.json`＋`data/img/`：交通部公路局「機車駕駛人筆試題庫」115 年 1 月 1 日版（NTM-00725，806 題、三選一、其中 148 題為圖片題），依[政府資料開放授權條款第 1 版](https://data.gov.tw/license)使用，資料來源為交通部公路局。官方題庫只有答案沒有詳解。題目文字不改動，僅去除 PDF 排版造成的多餘空白與選項末的句號；「以上皆是」類選項作答時固定放在最後。
- `data/questions.json`：由 `data/q_parts/*.json` 經 `tools/merge_questions.py` 合併。**題目是依條文編寫的練習題，不是公路局官方題庫。** 每題都附出處條文與一句逐字引用的原文，`tools/validate_questions.py` 會機械檢查引用是否真的出現在現行有效條文中。
- 考試規格（題數、分數、時間）依公開資訊設定於 `app.js` 最上方的 `EXAM`，考前請以監理站公告為準。

## 重新建置
    python tools/build_laws.py --refetch
    python tools/merge_questions.py

## 重新匯入官方題庫
PDF 需自行從公路局題庫下載，放到 `official/`（該目錄不進版控）：

    python tools/pdf_to_text.py official/NTM-00725_zh.pdf official/zh_pypdf.txt
    python tools/parse_official.py official/zh_pypdf.txt official/bank.json
    python tools/extract_official_images.py official/NTM-00725_zh.pdf official/bank.json official/img_tmp
    python tools/build_official.py            # → data/official.json、data/img/

## 尚未做
- 官方題庫的詳解與條文出處（官方沒有提供）；其他語言版與情境影片題（NTM-00707～00714）未匯入
