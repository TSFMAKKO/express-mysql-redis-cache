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

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: 創建新產品
 *     description: 創建一個新的產品（使用 Write-Back 快取策略）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: 產品創建成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Product'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 */

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