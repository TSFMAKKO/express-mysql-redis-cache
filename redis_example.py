import redis
import json
from datetime import timedelta

def main():
    try:
        # 連接到 Redis
        redis_client = redis.Redis(
            host='localhost',  # Redis 伺服器地址
            port=6379,        # Redis 端口
            db=0,            # 使用的資料庫編號
            decode_responses=True,  # 自動將回應解碼為字串
            socket_connect_timeout=1,  # 連接超時時間
            socket_timeout=1  # 操作超時時間
        )
        # 測試連接
        redis_client.ping()
    except redis.ConnectionError as e:
        print("無法連接到 Redis 伺服器。請確保 Redis 伺服器已啟動。")
        print(f"錯誤訊息: {e}")
        return
    except Exception as e:
        print(f"發生未知錯誤: {e}")
        return

    try:
        # 1. 字串操作示例
        print("\n=== 字串操作示例 ===")
        # 設置鍵值對
        redis_client.set('name', '張三')
        # 獲取值
        name = redis_client.get('name')
        print(f"獲取名字: {name}")
        
        # 設置帶過期時間的鍵值對（5秒）
        redis_client.setex('temp_key', 5, '臨時數據')
        print(f"臨時數據: {redis_client.get('temp_key')}")
        
        # 2. 列表操作示例
        print("\n=== 列表操作示例 ===")
        # 清除已存在的列表
        redis_client.delete('fruits')
        # 向列表添加元素
        redis_client.lpush('fruits', '蘋果', '香蕉', '橙子')
        # 獲取整個列表
        fruits = redis_client.lrange('fruits', 0, -1)
        print(f"水果列表: {fruits}")
        
        # 3. 集合操作示例
        print("\n=== 集合操作示例 ===")
        # 添加集合元素
        redis_client.sadd('skills', 'Python', 'Java', 'Redis')
        # 獲取所有集合元素
        skills = redis_client.smembers('skills')
        print(f"技能集合: {skills}")
        
        # 4. 雜湊表操作示例
        print("\n=== 雜湊表操作示例 ===")
        # 設置用戶資訊
        user_data = {
            'name': '李四',
            'age': '25',
            'city': '北京'
        }
        # 使用 hmset 替代 hset
        for key, value in user_data.items():
            redis_client.hset('user:1', key, value)
        # 獲取所有用戶資訊
        user_info = redis_client.hgetall('user:1')
        print(f"用戶資訊: {user_info}")
        
        # 5. 事務示例
        print("\n=== 事務示例 ===")
        pipe = redis_client.pipeline()
        try:
            pipe.set('transaction_key', '事務測試')
            pipe.incr('counter')
            # 執行事務
            pipe.execute()
            print("事務執行成功")
        except Exception as e:
            print(f"事務執行失敗: {e}")
    except redis.RedisError as e:
        print(f"Redis 操作出錯: {e}")
    except Exception as e:
        print(f"發生未知錯誤: {e}")

if __name__ == "__main__":
    main() 