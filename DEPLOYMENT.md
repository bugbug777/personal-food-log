# 部署前檢查與上線流程

此專案目前適合作為個人 App 上線使用。前端是靜態檔案，後端同步由 Google Apps Script Web App 處理。

## 1. 風險結論

目前沒有阻擋個人使用上線的重大資安風險，但需注意：

- App 沒有登入系統，不適合公開給多人共用。
- 飲食資料會存在使用者瀏覽器的 `localStorage`，同一台裝置上的瀏覽器使用者可能看得到。
- Google Apps Script 若部署為 `Anyone with the link`，取得 Web App URL 的人可嘗試讀寫資料。
- 已強制同步密鑰；部署時必須設定 `FOOD_LOG_SHARED_SECRET`，降低 URL 外流風險。

## 2. 建議部署設定

### 靜態前端

可部署到任一靜態網站服務，例如 GitHub Pages、Netlify、Cloudflare Pages、Vercel Static 或自有主機。

部署檔案至少包含：

```text
index.html
styles.css
app.js
robots.txt
_headers
```

建議：

- 使用 HTTPS。
- 不要把 Apps Script URL 或同步密鑰寫進程式碼。
- 若部署平台支援 `_headers`，保留目前的安全標頭設定。
- 若平台支援，關閉搜尋引擎索引或保持站點不公開列目錄。

### GitHub Pages

GitHub Pages 可直接部署此專案，因為專案根目錄已包含 `index.html`、`styles.css`、`app.js` 等靜態檔案。

建議使用一個新的公開或私人 GitHub repository，例如：

```text
personal-food-log
```

首次部署流程：

1. 在 GitHub 建立新 repository。
2. 在本機專案目錄初始化 Git：

```bash
git init
git branch -M main
git add index.html styles.css app.js google-apps-script.js robots.txt _headers .nojekyll SPEC.md DEPLOYMENT.md SECURITY.md
git commit -m "Initial GitHub Pages deployment"
```

3. 將 repository URL 加入遠端。請把 `<YOUR_GITHUB_USERNAME>` 換成你的 GitHub 帳號：

```bash
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/personal-food-log.git
git push -u origin main
```

4. 到 GitHub repository 頁面開啟：

```text
Settings > Pages
```

5. 在 Build and deployment 設定：

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

6. 儲存後等待 GitHub Pages 完成部署。網站網址通常會是：

```text
https://<YOUR_GITHUB_USERNAME>.github.io/personal-food-log/
```

若 repository 名稱使用 `<YOUR_GITHUB_USERNAME>.github.io`，網址會是：

```text
https://<YOUR_GITHUB_USERNAME>.github.io/
```

後續更新流程：

```bash
git add index.html styles.css app.js google-apps-script.js robots.txt _headers .nojekyll SPEC.md DEPLOYMENT.md SECURITY.md
git commit -m "Update food log app"
git push
```

注意：

- GitHub Pages 不會套用 `_headers` 檔案中的自訂 HTTP security headers；`_headers` 主要適用於 Netlify 或 Cloudflare Pages 這類平台。
- `robots.txt` 與 `index.html` 的 `noindex,nofollow` 仍可降低搜尋引擎收錄機率，但公開 repository 與 GitHub Pages 網址本身仍可能被知道。
- 不要把 Apps Script Web App URL 或 `FOOD_LOG_SHARED_SECRET` 寫入任何檔案或 commit 到 repository。這些設定應只在 App 畫面中輸入，並保存在自己的瀏覽器 `localStorage`。
- 如果 repository 是 public，`google-apps-script.js` 也會公開；此檔案不應包含個人密鑰或個人 Apps Script 部署網址。

### Google Apps Script

1. 建立 Apps Script 專案。
2. 貼上 `google-apps-script.js` 的內容。
3. 到 Project Settings > Script Properties 新增：

```text
FOOD_LOG_SHARED_SECRET = 自行產生的一組長密鑰
```

4. 部署為 Web App：

```text
Execute as: Me
Who has access: Anyone with the link
```

5. 使用正式部署 URL，網址通常以 `/exec` 結尾。不要使用 `/dev` 測試部署 URL。

## 3. 上線後設定

1. 開啟線上版 `index.html`。
2. 在「同步設定」貼上 Apps Script Web App URL。
3. 在「同步密鑰」輸入與 Apps Script `FOOD_LOG_SHARED_SECRET` 相同的密鑰。
4. 按「儲存設定」。
5. 按「測試連線」確認成功。
6. 先新增一筆測試紀錄，確認 Google Sheet 有寫入。
7. 刪除測試紀錄，再確認 Sheet 同步刪除。

## 4. 部署前驗證

```bash
node --check app.js
node --check google-apps-script.js
python3 -m http.server 4173
```

本機開啟：

```text
http://localhost:4173/index.html
```

手動確認：

- 新增、編輯、刪除紀錄正常。
- 常吃食物新增、套用、刪除正常。
- 近 7 日趨勢正常顯示。
- CSV 可以匯出。
- 未設定同步 URL 時可純本機使用。
- 設定同步 URL 與密鑰後可測試連線。
- 未輸入同步密鑰或同步密鑰錯誤時，畫面會顯示連線或同步失敗。

## 5. 備份與復原

建議定期：

- 從 App 匯出 CSV。
- 在 Google Sheet 使用「建立副本」或版本記錄保留備份。

若換新裝置：

1. 開啟線上 App。
2. 填入 Apps Script URL 與同步密鑰。
3. 按「從 Google Sheet 同步」。

## 6. 不建議的用途

- 多人共用同一份資料。
- 儲存醫療診斷、病歷、身分證號、信用卡等高敏感資料。
- 把 Apps Script URL 與同步密鑰提交到公開 repo。
