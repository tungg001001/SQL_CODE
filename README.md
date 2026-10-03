# 🛡️ SQL Injection 互動教學評分系統

這是一個基於 **Docker + Express + SQLite** 的輕量級 SQL 注入沙盒教學系統。

### 🚀 一鍵啟動 (GitHub Codespaces)

點擊下方按鈕即可在雲端開啟專屬隔離沙盒進行練習：

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME)

---

### 📖 系統特點

- **動態 Flag 注入：** 每個 Session 自動隨機生成專屬 Flag，防止直接複製答案。
- **完全隔離沙盒：** 每筆查詢皆在記憶體獨立 DB (In-Memory SQLite) 執行，用完即棄。
- **雙重評分機制：** 支援功能行為判定與 CTF 模式 Flag 驗證。
