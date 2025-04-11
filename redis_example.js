const redis = require('redis');

async function main() {
    try {
        // 連接到 Redis
        const client = redis.createClient({
            url: 'redis://localhost:6379'  // Redis 伺服器地址
        });

        // 錯誤處理
        client.on('error', err => {
            console.error('Redis 錯誤:', err);
        });

        // 連接到 Redis
        await client.connect();
        
        try {
            // 1. 字串操作示例
            console.log('\n=== 字串操作示例 ===');
            // 設置鍵值對
            await client.set('name', '張三');
            // 獲取值
            const name = await client.get('name');
            console.log(`獲取名字: ${name}`);
            
            // 設置帶過期時間的鍵值對（5秒）
            await client.setEx('temp_key', 5, '臨時數據');
            const tempData = await client.get('temp_key');
            console.log(`臨時數據: ${tempData}`);
            
            // 2. 列表操作示例
            console.log('\n=== 列表操作示例 ===');
            // 清除已存在的列表
            await client.del('fruits');
            // 向列表添加元素
            await client.lPush('fruits', ['蘋果', '香蕉', '橙子']);
            // 獲取整個列表
            const fruits = await client.lRange('fruits', 0, -1);
            console.log(`水果列表: ${JSON.stringify(fruits)}`);
            
            // 3. 集合操作示例
            console.log('\n=== 集合操作示例 ===');
            // 添加集合元素
            await client.sAdd('skills', ['Python', 'Java', 'Redis']);
            // 獲取所有集合元素
            const skills = await client.sMembers('skills');
            console.log(`技能集合: ${JSON.stringify(skills)}`);
            
            // 4. 雜湊表操作示例
            console.log('\n=== 雜湊表操作示例 ===');
            // 設置用戶資訊
            const userData = {
                name: '李四',
                age: '25',
                city: '北京'
            };
            // 設置雜湊表
            await client.hSet('user:1', userData);
            // 獲取所有用戶資訊
            const userInfo = await client.hGetAll('user:1');
            console.log(`用戶資訊: ${JSON.stringify(userInfo)}`);
            
            // 5. 事務示例
            console.log('\n=== 事務示例 ===');
            const multi = client.multi();
            multi.set('transaction_key', '事務測試');
            multi.incr('counter');
            // 執行事務
            const results = await multi.exec();
            console.log('事務執行成功');

        } catch (err) {
            console.error('Redis 操作出錯:', err);
        }

        // 關閉連接
        await client.quit();
        
    } catch (err) {
        console.error('無法連接到 Redis 伺服器:', err);
    }
}

// 執行主程式
main().catch(err => {
    console.error('程式執行出錯:', err);
}); 