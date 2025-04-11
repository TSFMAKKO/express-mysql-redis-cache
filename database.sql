SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS test_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE test_db;

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 插入測試數據
INSERT INTO products (name, price, description) VALUES
    ('iPhone 15', 35900, 'Apple 最新旗艦手機'),
    ('MacBook Pro', 47900, '專業級筆記型電腦'),
    ('AirPods Pro', 7990, '主動降噪藍牙耳機'),
    ('iPad Air', 18900, '輕薄平板電腦'),
    ('Apple Watch', 12900, '智慧型手錶'); 