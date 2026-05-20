# 個人飲食紀錄 App 規格

## 1. 產品目標

個人飲食紀錄 App 是一個繁體中文網頁工具，用於快速記錄每日餐點、熱量與三大營養素，並透過本機儲存與 Google Sheet 整合提供資料保存。

第一版重點是：

- 快速新增、編輯、刪除飲食紀錄
- 依日期查看每日飲食
- 手動輸入熱量與營養素
- 管理常吃食物
- 查看近 7 日熱量趨勢
- 匯出 CSV
- 使用 Google Sheet 作為持久保存來源

## 2. 技術架構

目前 App 採純前端架構：

- `index.html`：頁面結構
- `styles.css`：版面與響應式樣式
- `app.js`：前端狀態、互動、localStorage、Google Sheet 同步、CSV 匯出
- `google-apps-script.js`：Google Apps Script Web App 後端範本
- `DEPLOYMENT.md`：部署前檢查、上線流程與備份建議
- `SECURITY.md`：個人使用安全注意事項

不使用前端框架或建置工具。可透過靜態伺服器直接執行：

```bash
python3 -m http.server 4173
```

本機網址：

```text
http://localhost:4173/index.html
```

## 3. 主要功能

### 3.1 日期切換

使用者可透過日期輸入欄、前一天、後一天按鈕切換查看日期。

目前日期格式以 `YYYY-MM-DD` 作為內部資料比對格式。

### 3.2 飲食紀錄

使用者可新增、編輯、刪除飲食紀錄。

欄位包含：

- 餐別：早餐、午餐、晚餐、點心/宵夜
- 食物名稱
- 熱量 kcal
- 份量
- 蛋白質 g
- 碳水 g
- 脂肪 g
- 備註

新增或編輯後，資料會先更新本機狀態與 `localStorage`。若已設定 Google Sheet 同步 URL，會再嘗試同步到 Google Sheet。

### 3.3 每日總覽

每日總覽顯示：

- 今日熱量
- 每日目標熱量
- 剩餘或超出熱量
- 目標進度條
- 蛋白質、碳水、脂肪每日合計

每日目標熱量會存在 `localStorage`。

### 3.4 今日紀錄列表

當前選取日期的飲食紀錄會依餐別分組顯示。

每筆紀錄顯示：

- 食物名稱
- 份量與餐別
- 熱量
- 三大營養素摘要
- 備註
- 編輯與刪除按鈕

支援以食物名稱搜尋當日紀錄。

### 3.5 常吃食物

新增或編輯飲食紀錄時，可勾選「儲存為常吃食物」。

常吃食物包含：

- 名稱
- 預設餐別
- 熱量
- 蛋白質
- 碳水
- 脂肪
- 份量
- 建立時間
- 更新時間

常吃食物可：

- 從下拉選單套用
- 從常吃食物列表套用
- 從列表刪除

若已設定 Google Sheet 同步 URL，常吃食物新增、更新、刪除也會同步到 Google Sheet。

### 3.6 近 7 日熱量趨勢

趨勢圖以目前選取日期為結尾，往前顯示 7 天。

顯示內容：

- 每日熱量長條圖
- 每日目標熱量參考線
- 近 7 日平均熱量
- 近 7 日最高熱量
- 目前選取日期的長條以較深色標示

圖表使用前端動態產生 SVG，不依賴圖表套件。

### 3.7 CSV 匯出

使用者可按「匯出 CSV」匯出全部飲食紀錄。

CSV 欄位：

- 日期
- 餐別
- 食物名稱
- 熱量(kcal)
- 蛋白質(g)
- 碳水(g)
- 脂肪(g)
- 份量
- 備註
- 建立時間
- 更新時間

匯出檔名：

```text
飲食紀錄-YYYY-MM-DD.csv
```

CSV 內容包含 UTF-8 BOM，以降低 Excel 或 Numbers 開啟繁體中文時出現亂碼的機率。

目前畫面不顯示下載連結、不顯示 CSV 預覽內容。按鈕只嘗試透過瀏覽器下載或另存機制匯出。

## 4. Google Sheet 同步

### 4.1 整體架構

```text
個人飲食紀錄 App
  -> fetch()
Google Apps Script Web App
  -> SpreadsheetApp
Google Sheet
```

前端不直接呼叫 Google Sheets API。Google Apps Script 作為輕量後端，負責讀寫試算表。

### 4.2 設定方式

使用者需在 App 的「同步設定」區塊輸入 Apps Script Web App URL。

URL 必須是正式部署 URL，通常以 `/exec` 結尾。

不支援測試部署 URL：

```text
/dev
```

若使用 `/dev`，App 會提示改用 `/exec`。

同步設定必須填寫「同步密鑰」。Apps Script 專案必須設定 `FOOD_LOG_SHARED_SECRET` Script Property，前端必須輸入相同密鑰才可讀寫 Google Sheet。若 Apps Script 沒設定此屬性，或前端沒有輸入密鑰，請求會被拒絕。

### 4.3 Apps Script Web App 部署要求

部署建議：

- Execute as: `Me`
- Who has access: `Anyone with the link`
- 個人線上使用必須設定 Script Property：`FOOD_LOG_SHARED_SECRET`

修改 Apps Script 後需重新部署新版本，正式 `/exec` URL 才會使用最新程式碼。

### 4.4 Google Sheet 建立

`google-apps-script.js` 會自動建立或取得名為：

```text
個人飲食紀錄資料庫
```

的試算表。

試算表 ID 會存入 Apps Script Properties：

```text
FOOD_LOG_SPREADSHEET_ID
```

後續請求會沿用同一份試算表。

### 4.5 工作表

Google Sheet 內包含兩個工作表。

#### FoodEntries

| 欄位 | 說明 |
|---|---|
| id | 飲食紀錄 ID |
| date | 日期，格式 `YYYY-MM-DD` |
| mealType | 餐別 |
| foodName | 食物名稱 |
| calories | 熱量 |
| protein | 蛋白質 |
| carbs | 碳水 |
| fat | 脂肪 |
| quantity | 份量 |
| notes | 備註 |
| createdAt | 建立時間 |
| updatedAt | 更新時間 |

#### FavoriteFoods

| 欄位 | 說明 |
|---|---|
| id | 常吃食物 ID |
| name | 食物名稱 |
| mealType | 預設餐別 |
| calories | 熱量 |
| protein | 蛋白質 |
| carbs | 碳水 |
| fat | 脂肪 |
| quantity | 份量 |
| createdAt | 建立時間 |
| updatedAt | 更新時間 |

### 4.6 API

Apps Script 使用 `action` 區分操作。

GET：

```text
?action=ping
?action=listEntries
?action=listFavorites
```

GET 需附加同步密鑰：

```text
&sharedSecret=...
```

POST：

```json
{ "action": "upsertEntry", "sharedSecret": "...", "entry": {} }
{ "action": "deleteEntry", "sharedSecret": "...", "id": "..." }
{ "action": "upsertFavorite", "sharedSecret": "...", "favorite": {} }
{ "action": "deleteFavorite", "sharedSecret": "...", "id": "..." }
```

成功回應：

```json
{
  "ok": true,
  "data": {}
}
```

失敗回應：

```json
{
  "ok": false,
  "error": "錯誤訊息"
}
```

### 4.7 同步策略

同步採「Google Sheet + localStorage 備援」。

App 啟動時：

- 先載入 `localStorage`
- 如果已設定 Web App URL，嘗試從 Google Sheet 同步

從 Google Sheet 同步時：

- 遠端資料會先正規化
- `date` 會轉成 `YYYY-MM-DD`
- 依 `id` 與本機資料合併
- 遠端同 id 資料會覆蓋本機同 id 資料
- 本機存在但遠端不存在的資料不會被刪除

這可避免遠端資料格式異常或同步結果為空時，把本機紀錄整批清掉。

新增、編輯、刪除時：

- 先更新畫面與本機資料
- 再嘗試寫入 Google Sheet
- 寫入失敗時顯示警告，但不移除本機資料

## 5. 本機儲存

使用 `localStorage` 保存：

```text
personal-food-log.entries
personal-food-log.favorites
personal-food-log.settings
personal-food-log.sync-settings
```

### 5.1 entries

飲食紀錄陣列。

```js
{
  id: string,
  date: string,
  mealType: "breakfast" | "lunch" | "dinner" | "snack",
  foodName: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  quantity: string,
  notes: string,
  createdAt: string,
  updatedAt?: string
}
```

### 5.2 favorites

常吃食物陣列。

```js
{
  id: string,
  name: string,
  mealType: "breakfast" | "lunch" | "dinner" | "snack",
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  quantity: string,
  createdAt: string,
  updatedAt?: string
}
```

### 5.3 settings

```js
{
  dailyGoal: number
}
```

### 5.4 sync-settings

```js
{
  scriptUrl: string,
  sharedSecret: string
}
```

## 6. UI 規格

### 6.1 語言

所有使用者介面文字以繁體中文為主。

### 6.2 版面

主要區塊：

1. 頁首與日期切換
2. 每日總覽
3. 近 7 日熱量趨勢
4. Google Sheet 同步設定
5. 新增/編輯飲食紀錄表單
6. 常吃食物列表
7. 當日紀錄列表

### 6.3 響應式

桌面版：

- 總覽卡片橫向排列
- 表單與列表雙欄排列

窄螢幕：

- 主要區塊改為單欄
- 表單欄位與紀錄卡片改為垂直排列

## 7. 已知限制

- 目前無登入或多使用者隔離。
- Google Sheet Web App URL 由使用者手動設定。
- 同步密鑰會阻擋只有 Web App URL、但沒有密鑰的請求；它仍不是完整登入系統。
- Google Sheet 同步以 `id` 合併，不處理複雜衝突解決。
- 本機有、遠端沒有的資料不會在同步時自動刪除。
- CSV 下載依賴瀏覽器支援；部分內嵌瀏覽器可能不支援實際下載落地。
- 前端沒有自動建立 Apps Script 部署，需使用者手動部署。
- Google Sheet 欄位名稱是同步契約，任意修改表頭可能導致讀寫異常。

## 8. 驗證方式

基本靜態檢查：

```bash
node --check app.js
node --check google-apps-script.js
```

本機伺服器檢查：

```bash
python3 -m http.server 4173
```

手動測試項目：

- 新增飲食紀錄
- 編輯飲食紀錄
- 刪除飲食紀錄
- 儲存常吃食物
- 套用常吃食物
- 刪除常吃食物
- 切換日期
- 搜尋當日食物
- 查看近 7 日趨勢
- 匯出 CSV
- 儲存 Apps Script URL
- 測試 Google Sheet 連線
- 從 Google Sheet 同步
- 確認 Sheet 日期資料同步後仍顯示於正確日期
- 確認未輸入同步密鑰或輸入錯誤密鑰時會被拒絕

## 9. 後續候選功能

- 體重紀錄
- 日期範圍篩選
- 依餐別篩選
- 匯出指定日期範圍 CSV
- 同步佇列與重試機制
- Google Sheet 刪除同步策略
- 更完整的同步衝突處理
- 雲端設定或多裝置使用者識別
