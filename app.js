require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const redis = require('redis');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// Swagger 配置
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '產品 API 文檔',
            version: '1.0.0',
            description: '使用 Express + MySQL + Redis 實現的產品 API',
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: '開發服務器',
            },
        ],
    },
    apis: ['./swagger.js'], // 修改為新的 Swagger 註解文件
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();
const port = process.env.PORT || 3000;

// Swagger UI 路由
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(cors());
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// 設置響應頭中間件
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

// MySQL 連接池配置
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'your_password',
    database: process.env.MYSQL_DATABASE,
    charset: 'utf8mb4',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0
});

// 初始化連接設定
pool.on('connection', function(connection) {
    connection.query('SET NAMES utf8mb4');
    connection.query('SET CHARACTER SET utf8mb4');
});

// 輸出環境變數（不包含敏感信息）
console.log('環境配置:', {
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_DATABASE: process.env.MYSQL_DATABASE,
    REDIS_URL: process.env.REDIS_URL.replace(/\/\/.*@/, '//***:***@'),
    PORT: process.env.PORT
});

// 測試 MySQL 連接
async function testMySQLConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('MySQL 連接成功');
        // 測試查詢
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM products');
        console.log('產品數量:', rows[0].count);
        connection.release();
    } catch (error) {
        console.error('MySQL 連接錯誤:', error);
        throw error;
    }
}

// Redis 客戶端
const redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    socket: {
        reconnectStrategy: retries => {
            console.log(`嘗試重新連接 Redis (${retries})`);
            return Math.min(retries * 50, 1000);
        }
    }
});

// Redis 錯誤處理
redisClient.on('error', err => {
    console.error('Redis 錯誤:', err);
});

redisClient.on('connect', () => {
    console.log('Redis 連接成功');
});

redisClient.on('ready', () => {
    console.log('Redis 準備就緒');
});

// 連接 Redis
async function connectRedis() {
    try {
        await redisClient.connect();
    } catch (error) {
        console.error('Redis 連接錯誤:', error);
        process.exit(1);
    }
}

// 用於存儲待寫入數據庫的更改
const pendingWrites = new Map();   // 用於存儲待寫入的更改
const pendingInserts = new Map();  // 新增：用於存儲待插入的新產品
const pendingDeletes = new Map();  // 新增：用於存儲待刪除的產品

// 定期將快取中的更改寫入數據庫
setInterval(async () => {
    try {
        const currentTime = new Date().toLocaleTimeString();
        
        // 處理所有寫入操作（包括新增和更新）
        if (pendingWrites.size > 0) {
            console.log(`[${currentTime}] 開始處理數據庫寫入操作，待處理項目數: ${pendingWrites.size}`);
            
            // 獲取當前的產品列表快取
            const productsKey = 'products';
            let cachedProducts = [];
            const cachedData = await redisClient.get(productsKey);
            if (cachedData) {
                cachedProducts = JSON.parse(cachedData);
            }
            
            for (const [key, data] of pendingWrites.entries()) {
                try {
                    const { id, name, price, description } = data;
                    
                    // 檢查是否為新增操作（id 為時間戳）
                    if (id > 1600000000000) { // 時間戳檢查（2020年後的時間戳）
                        // 執行插入操作
                        const [result] = await pool.query(
                            'INSERT INTO products (name, price, description) VALUES (?, ?, ?)',
                            [name, price, description]
                        );
                        console.log(`[${currentTime}] 成功將新產品寫入數據庫，ID: ${result.insertId}`);

                        // 更新快取中的產品ID
                        const updatedProduct = {
                            ...data,
                            id: result.insertId
                        };

                        // 更新單個產品快取
                        const newProductKey = `product:${result.insertId}`;
                        await redisClient.set(newProductKey, JSON.stringify(updatedProduct), {
                            EX: 5
                        });

                        // 清理舊的快取
                        await redisClient.del(`product:${id}`);

                        // 更新產品列表快取中的對應項目
                        const productIndex = cachedProducts.findIndex(p => p.id === id);
                        if (productIndex !== -1) {
                            cachedProducts[productIndex] = updatedProduct;
                        }
                    } else {
                        // 執行更新操作
                        await pool.query(
                            'UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?',
                            [name, price, description, id]
                        );
                        console.log(`[${currentTime}] 成功將產品 ${id} 的更改寫入數據庫`);

                        // 更新產品列表快取中的對應項目
                        const productIndex = cachedProducts.findIndex(p => p.id === id);
                        if (productIndex !== -1) {
                            cachedProducts[productIndex] = data;
                        }
                    }
                    
                    pendingWrites.delete(key);
                } catch (error) {
                    console.error(`[${currentTime}] 寫入產品到數據庫時出錯:`, error);
                }
            }
            
            // 更新產品列表快取
            if (cachedProducts.length > 0) {
                await redisClient.set(productsKey, JSON.stringify(cachedProducts), {
                    EX: 5 // 使用與讀取路由相同的過期時間
                });
                console.log(`[${currentTime}] 已更新產品列表快取`);
            }
        }

        // 處理刪除操作
        if (pendingDeletes.size > 0) {
            console.log(`[${currentTime}] 開始處理刪除操作，待處理項目數: ${pendingDeletes.size}`);
            
            for (const [productId, timestamp] of pendingDeletes.entries()) {
                try {
                    const [result] = await pool.query(
                        'DELETE FROM products WHERE id = ?',
                        [productId]
                    );
                    
                    if (result.affectedRows > 0) {
                        console.log(`[${currentTime}] 成功從數據庫中刪除產品 ${productId}`);
                        // 清除相關快取
                        await redisClient.del(`product:${productId}`);
                        await redisClient.del('products');
                    } else {
                        console.log(`[${currentTime}] 產品 ${productId} 已不存在於數據庫中`);
                    }
                    
                    pendingDeletes.delete(productId);
                } catch (error) {
                    console.error(`[${currentTime}] 刪除產品 ${productId} 時出錯:`, error);
                }
            }
        }
    } catch (error) {
        console.error('執行定期寫入時出錯:', error);
    }
}, 20000);

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - price
 *       properties:
 *         id:
 *           type: integer
 *           description: 產品 ID
 *         name:
 *           type: string
 *           description: 產品名稱
 *         price:
 *           type: number
 *           description: 產品價格
 *         description:
 *           type: string
 *           description: 產品描述
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: 獲取所有產品
 *     description: 返回所有產品的列表，支持 Redis 快取
 *     responses:
 *       200:
 *         description: 成功獲取產品列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
app.get('/api/products', async (req, res) => {
    try {
        const cacheKey = 'products';
        const CACHE_EXPIRE_SECONDS = 5;  // 快取過期時間為 5 秒
        const currentTime = new Date().toLocaleTimeString();

        // 先檢查並清除可能的過期快取
        const ttl = await redisClient.ttl(cacheKey);
        console.log(`[${currentTime}] 檢查快取狀態 - TTL: ${ttl} 秒`);
        
        if (ttl > CACHE_EXPIRE_SECONDS) {
            console.log(`[${currentTime}] 檢測到異常的 TTL，清除快取`);
            await redisClient.del(cacheKey);
        }

        // 重新檢查快取
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData && ttl > 0 && ttl <= CACHE_EXPIRE_SECONDS) {
            console.log(`[${currentTime}] 使用快取數據，剩餘時間: ${ttl} 秒`);
            // 過濾掉待刪除的產品
            const products = JSON.parse(cachedData);
            const filteredProducts = await filterDeletedProducts(products);
            return res.send(JSON.stringify(filteredProducts));
        }

        // 從 MySQL 獲取新數據
        console.log(`[${currentTime}] 從 MySQL 獲取新數據`);
        const [rows] = await pool.query('SELECT * FROM products');
        
        // 過濾掉待刪除的產品
        const filteredRows = await filterDeletedProducts(rows);
        
        // 設置新的快取，強制使用 NX 選項確保不會覆蓋現有的快取
        await redisClient.set(cacheKey, JSON.stringify(filteredRows), {
            EX: CACHE_EXPIRE_SECONDS,
            NX: true  // 只在鍵不存在時設置
        });
        
        // 驗證快取設置
        const newTtl = await redisClient.ttl(cacheKey);
        console.log(`[${currentTime}] 設置新快取，過期時間: ${CACHE_EXPIRE_SECONDS} 秒，實際 TTL: ${newTtl} 秒`);
        
        res.send(JSON.stringify(filteredRows));
    } catch (error) {
        console.error('獲取產品列表時出錯：', error);
        res.status(500).json({ error: '獲取產品列表時出錯' });
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: 獲取單個產品
 *     description: 根據 ID 獲取單個產品的詳細信息
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 產品 ID
 *     responses:
 *       200:
 *         description: 成功獲取產品
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: 找不到產品
 */
app.get('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const cacheKey = `product:${productId}`;
        const CACHE_EXPIRE_SECONDS = 5;  // 快取過期時間為 5 秒
        const currentTime = new Date().toLocaleTimeString();

        // 檢查產品是否在待刪除隊列中
        const deleteKey = `delete:product:${productId}`;
        const isPendingDelete = await redisClient.get(deleteKey);
        if (isPendingDelete) {
            return res.status(404).json({ error: '找不到產品' });
        }

        // 先檢查並清除可能的過期快取
        const ttl = await redisClient.ttl(cacheKey);
        console.log(`[${currentTime}] 檢查快取狀態 - TTL: ${ttl} 秒`);
        
        if (ttl > CACHE_EXPIRE_SECONDS) {
            console.log(`[${currentTime}] 檢測到異常的 TTL，清除快取`);
            await redisClient.del(cacheKey);
        }

        // 重新檢查快取
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData && ttl > 0 && ttl <= CACHE_EXPIRE_SECONDS) {
            console.log(`[${currentTime}] 使用快取數據，剩餘時間: ${ttl} 秒`);
            return res.send(cachedData);
        }

        // 從 MySQL 獲取新數據
        console.log(`[${currentTime}] 從 MySQL 獲取新數據`);
        const [rows] = await pool.query(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: '找不到產品' });
        }

        // 設置新的快取，強制使用 NX 選項確保不會覆蓋現有的快取
        await redisClient.set(cacheKey, JSON.stringify(rows[0]), {
            EX: CACHE_EXPIRE_SECONDS,
            NX: true  // 只在鍵不存在時設置
        });
        
        // 驗證快取設置
        const newTtl = await redisClient.ttl(cacheKey);
        console.log(`[${currentTime}] 設置新快取，過期時間: ${CACHE_EXPIRE_SECONDS} 秒，實際 TTL: ${newTtl} 秒`);
        
        res.send(JSON.stringify(rows[0]));
    } catch (error) {
        console.error('獲取產品時出錯：', error);
        res.status(500).json({ error: '獲取產品時出錯' });
    }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: 創建新產品
 *     description: 創建一個新的產品（使用 Write-Back 快取策略）
 */
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, description } = req.body;
        const currentTime = new Date().toLocaleTimeString();
        
        // 1. 生成臨時ID並準備新產品數據
        const tempId = Date.now();
        const newProduct = {
            id: tempId,
            name,
            price,
            description,
            created_at: new Date().toISOString()
        };

        // 2. 立即更新所有讀取快取
        try {
            // 2.1 強制更新產品列表快取
            const productsKey = 'products';
            let cachedProducts = [];
            
            // 從數據庫獲取最新的產品列表
            const [rows] = await pool.query('SELECT * FROM products');
            cachedProducts = [...rows, newProduct];
            
            // 強制更新產品列表快取
            await redisClient.set(productsKey, JSON.stringify(cachedProducts), {
                EX: 5 // 使用與讀取路由相同的過期時間（5秒）
            });
            console.log(`[${currentTime}] 已更新產品列表快取，包含新產品`);

            // 2.2 強制更新單個產品快取
            const productKey = `product:${tempId}`;
            await redisClient.set(productKey, JSON.stringify(newProduct), {
                EX: 5 // 使用與讀取路由相同的過期時間（5秒）
            });
            console.log(`[${currentTime}] 已設置新產品的快取`);

            // 2.3 驗證快取是否成功更新
            const verifyProductCache = await redisClient.get(productKey);
            const verifyListCache = await redisClient.get(productsKey);
            
            if (!verifyProductCache || !verifyListCache) {
                throw new Error('快取驗證失敗');
            }

            // 3. 將新產品加入待寫入隊列
            pendingWrites.set(tempId, newProduct);
            console.log(`[${currentTime}] 新產品已加入待寫入隊列，等待寫入數據庫`);

            // 4. 返回成功響應
            res.status(201).json({
                ...newProduct,
                message: '產品已成功創建並可立即讀取，將在稍後寫入數據庫'
            });
        } catch (cacheError) {
            console.error(`[${currentTime}] 更新快取時出錯：`, cacheError);
            
            // 即使快取更新失敗，仍然將新產品加入待寫入隊列
            pendingWrites.set(tempId, newProduct);
            
            res.status(201).json({
                ...newProduct,
                message: '產品已創建但快取更新失敗，將在稍後寫入數據庫'
            });
        }
    } catch (error) {
        console.error('創建產品時出錯：', error);
        res.status(500).json({ error: '創建產品時出錯' });
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: 更新產品
 *     description: 根據 ID 更新產品信息（使用 Write-Back 快取策略）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 產品 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: 產品更新成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Product'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *       404:
 *         description: 找不到產品
 */
app.put('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, price, description } = req.body;
        const currentTime = new Date().toLocaleTimeString();
        
        // 1. 檢查產品是否存在
        const [existingProduct] = await pool.query(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );

        if (existingProduct.length === 0) {
            return res.status(404).json({ error: '找不到產品' });
        }

        // 2. 準備更新的數據
        const updatedProduct = {
            id: parseInt(productId),
            name,
            price,
            description,
            created_at: existingProduct[0].created_at
        };

        // 3. 立即更新所有相關快取
        try {
            // 3.1 更新產品列表快取
            const productsKey = 'products';
            let cachedProducts = [];
            const cachedData = await redisClient.get(productsKey);
            
            if (cachedData) {
                // 如果快取存在，直接更新對應產品
                cachedProducts = JSON.parse(cachedData);
                const productIndex = cachedProducts.findIndex(p => p.id === parseInt(productId));
                if (productIndex !== -1) {
                    cachedProducts[productIndex] = updatedProduct;
                    await redisClient.set(productsKey, JSON.stringify(cachedProducts), {
                        EX: 5 // 使用與讀取路由相同的過期時間（5秒）
                    });
                    console.log(`[${currentTime}] 已更新產品列表快取`);
                }
            } else {
                // 如果快取不存在，從數據庫獲取完整列表並更新
                const [rows] = await pool.query('SELECT * FROM products');
                cachedProducts = rows.map(product => 
                    product.id === parseInt(productId) ? updatedProduct : product
                );
                await redisClient.set(productsKey, JSON.stringify(cachedProducts), {
                    EX: 5 // 使用與讀取路由相同的過期時間（5秒）
                });
                console.log(`[${currentTime}] 已創建並更新產品列表快取`);
            }

            // 3.2 更新單個產品快取
            const productKey = `product:${productId}`;
            await redisClient.set(productKey, JSON.stringify(updatedProduct), {
                EX: 5 // 使用與讀取路由相同的過期時間（5秒）
            });
            console.log(`[${currentTime}] 已更新單個產品快取`);

            // 4. 將更新加入待寫入隊列，等待排程寫入數據庫
            pendingWrites.set(productId, updatedProduct);
            console.log(`[${currentTime}] 產品更新已加入待寫入隊列`);

            // 5. 返回成功響應
            res.json({
                ...updatedProduct,
                message: '產品已更新完成並可立即讀取，將在稍後寫入數據庫'
            });
        } catch (cacheError) {
            console.error(`[${currentTime}] 更新快取時出錯：`, cacheError);
            // 即使快取更新失敗，仍然將更新加入待寫入隊列
            pendingWrites.set(productId, updatedProduct);
            res.status(200).json({
                ...updatedProduct,
                message: '產品更新已加入待寫入隊列，但快取更新失敗'
            });
        }
    } catch (error) {
        console.error('更新產品時出錯：', error);
        res.status(500).json({ error: '更新產品時出錯' });
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: 刪除產品
 *     description: 根據 ID 刪除產品（使用 Write-Back 快取策略）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 產品 ID
 *     responses:
 *       202:
 *         description: 刪除請求已接受，產品將在稍後被刪除
 *       404:
 *         description: 找不到產品
 */
app.delete('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const currentTime = new Date().toLocaleTimeString();

        // 檢查產品是否存在
        const [existingProduct] = await pool.query(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );

        if (existingProduct.length === 0) {
            return res.status(404).json({ error: '找不到產品' });
        }

        // 標記產品為待刪除狀態
        const deleteKey = `delete:product:${productId}`;
        await redisClient.set(deleteKey, 'pending', {
            EX: 3600 // 設置 1 小時過期時間
        });

        // 立即清除相關快取
        await redisClient.del(`product:${productId}`);
        await redisClient.del('products');
        
        // 將刪除操作加入待處理隊列
        pendingDeletes.set(productId, Date.now());
        
        console.log(`[${currentTime}] 產品 ${productId} 已標記為待刪除，並清除相關快取`);
        
        res.status(202).json({
            message: '刪除請求已接受，產品將在稍後被刪除',
            id: productId
        });
    } catch (error) {
        console.error('刪除產品時出錯：', error);
        res.status(500).json({ error: '刪除產品時出錯' });
    }
});

// 輔助函數：過濾待刪除的產品
async function filterDeletedProducts(products) {
    const filteredProducts = [];
    for (const product of products) {
        const deleteKey = `delete:product:${product.id}`;
        const isPendingDelete = await redisClient.get(deleteKey);
        if (!isPendingDelete) {
            filteredProducts.push(product);
        }
    }
    return filteredProducts;
}

// 優雅關閉
process.on('SIGINT', async () => {
    try {
        await redisClient.quit();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('關閉錯誤:', error);
        process.exit(1);
    }
});

// 初始化連接並啟動服務器
async function startServer() {
    try {
        // 測試資料庫連接
        await testMySQLConnection();
        
        // 連接 Redis
        await connectRedis();
        
        // 啟動服務器
        app.listen(port, () => {
            console.log(`服務器運行在 http://localhost:${port}`);
        });
    } catch (error) {
        console.error('啟動服務器失敗:', error);
        process.exit(1);
    }
}

startServer(); 