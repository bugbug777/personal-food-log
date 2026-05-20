# 安全注意事項

## 個人使用風險等級

此 App 目前定位為個人工具。若部署為個人使用，且 Apps Script URL 與同步密鑰不公開，整體風險可接受。

## 資料保存位置

- 瀏覽器：飲食紀錄、常吃食物、每日目標、同步設定會存在 `localStorage`。
- Google：若啟用同步，資料會寫入 Google Sheet。
- 靜態網站主機：不應保存使用者飲食資料、Apps Script URL 或同步密鑰。

## 同步密鑰

Apps Script 強制使用 `FOOD_LOG_SHARED_SECRET`。

設定後：

- 前端 GET 會以 query string 帶上 `sharedSecret`。
- 前端 POST 會在 JSON body 帶上 `sharedSecret`。
- Apps Script 會拒絕沒有密鑰、密鑰不相符，或伺服器端未設定 `FOOD_LOG_SHARED_SECRET` 的請求。

限制：

- 這不是完整登入系統。
- 密鑰仍存在使用者自己的瀏覽器 `localStorage`。
- 若密鑰與 Web App URL 同時外流，仍可被他人使用。

建議：

- 使用長且不可猜的密鑰。
- 不要把密鑰寫入 repo、HTML、JS 或公開文件。
- 若懷疑外流，更新 Apps Script Script Properties 中的 `FOOD_LOG_SHARED_SECRET`，再到 App 重新儲存同步設定。

## 上線前最低安全清單

- 使用 HTTPS 靜態網站。
- Apps Script 使用正式 `/exec` URL。
- 設定 `FOOD_LOG_SHARED_SECRET`。
- Google Sheet 不設為公開分享。
- 不在公開 repo 放入個人 Web App URL 或同步密鑰。
- 手動測試錯誤密鑰會被拒絕。

## 未涵蓋範圍

目前沒有：

- 使用者登入。
- 多使用者隔離。
- 伺服器端 session。
- 複雜權限模型。
- 完整審計紀錄。

若未來要提供給他人使用，建議改成正式後端與登入架構。
