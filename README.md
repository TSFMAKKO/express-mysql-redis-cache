# Express MySQL Redis 緩存示例

這是一個使用 Express.js、MySQL 和 Redis 實現的產品管理 API 示例項目。該項目展示了如何使用 Redis 作為緩存層來提高 MySQL 數據庫的查詢性能。

## 功能特點

- RESTful API 設計
- MySQL 數據持久化
- Redis 緩存層
- Swagger API 文檔
- 完整的錯誤處理
- 環境變量配置

## 技術棧

- Node.js
- Express.js
- MySQL
- Redis
- Swagger UI

## 安裝步驟

1. 克隆倉庫：
   ```bash
   git clone [倉庫URL]
   cd [項目目錄]
   ```

2. 安裝依賴：
   ```bash
   npm install
   ```

3. 配置環境變量：
   - 複製 `.env.example` 為 `.env`
   - 修改 `.env` 中的配置

4. 初始化數據庫：
   - 使用 MySQL 客戶端執行 `init.sql` 文件

5. 啟動服務：
   ```bash
   npm start
   ```

## API 文檔

啟動服務後，訪問 `http://localhost:3001/api-docs` 查看 Swagger API 文檔。

## 主要 API 端點

- `GET /api/products` - 獲取所有產品
- `GET /api/products/:id` - 獲取單個產品
- `POST /api/products` - 創建新產品
- `PUT /api/products/:id` - 更新產品
- `DELETE /api/products/:id` - 刪除產品

## 緩存策略

- 使用 Redis 緩存產品查詢結果
- 緩存過期時間：1小時
- 在產品更新或刪除時自動清除緩存

## 開發環境要求

- Node.js >= 14
- MySQL >= 8.0
- Redis >= 6.0

## 許可證

MIT 