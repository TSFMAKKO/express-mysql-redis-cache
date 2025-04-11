CREATE DATABASE IF NOT EXISTS test_db;
USE test_db;

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 插入一些測試數據
INSERT INTO products (name, price, description) VALUES
('測試產品 1', 99.99, '這是測試產品 1 的描述'),
('測試產品 2', 199.99, '這是測試產品 2 的描述'),
('測試產品 3', 299.99, '這是測試產品 3 的描述'); 