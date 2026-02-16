# 飞牛 NAS 结算系统 — 从零安装部署指南

## 前置条件

- 飞牛 NAS 已安装 Docker 应用
- NAS 可以正常联网

---

## 第一步：创建部署目录

1. 打开飞牛 NAS 桌面的 **「文件管理」** 应用
2. 进入 `/vol1/docker/` 目录（如果没有 `docker` 文件夹就新建一个）
3. 在 `docker` 目录下新建文件夹，命名为 **`settlement-deploy`**

最终路径为：`/vol1/docker/settlement-deploy/`

---

## 第二步：创建配置文件

在 `/vol1/docker/settlement-deploy/` 目录下，需要创建 **3 个文件**。

### 文件 1：`docker-compose.yml`

在文件管理中右键 → 新建文件（或用电脑上的文本编辑器创建后上传），内容如下：

```yaml
services:
  # ---- MySQL 数据库 ----
  mysql:
    image: mysql:8.0
    container_name: settlement-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: settlement2024
      MYSQL_DATABASE: settlement
      MYSQL_USER: settlement
      MYSQL_PASSWORD: settlement2024
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-psettlement2024"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ---- Web 应用 ----
  web:
    image: evanql19871128/shuadan:latest
    container_name: settlement-web
    restart: always
    ports:
      - "9091:9091"
    environment:
      - DATABASE_URL=mysql://settlement:settlement2024@mysql:3306/settlement
      - JWT_SECRET=your-super-secret-jwt-key-change-me
      - ADMIN_USERNAME=Evan
      - ADMIN_PASSWORD=admin123
      - PORT=9091
      - NODE_ENV=production
      - API_TOKEN=sk-settlement-api-2024
    depends_on:
      mysql:
        condition: service_healthy

  # ---- Watchtower 自动更新 ----
  watchtower:
    image: containrrr/watchtower
    container_name: settlement-watchtower
    restart: always
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=300
      - WATCHTOWER_LABEL_ENABLE=false
    command: settlement-web

volumes:
  mysql_data:
    driver: local
```

> **重要说明：** `web` 服务使用的是 `image: evanql19871128/shuadan:latest`（直接从 Docker Hub 拉取镜像），而不是 `build` 方式。这样 Watchtower 才能自动检测更新。

### 文件 2：`init-db.sql`

内容如下（数据库初始化脚本）：

```sql
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `openId` varchar(64) NOT NULL UNIQUE,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settlements` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `orderDate` bigint,
  `orderNo` varchar(64),
  `groupName` varchar(128),
  `customerService` varchar(64) DEFAULT '',
  `customerName` varchar(128) DEFAULT '',
  `originalPrice` decimal(12,2) DEFAULT '0.00',
  `totalPrice` decimal(12,2) DEFAULT '0.00',
  `actualTransfer` decimal(12,2) DEFAULT '0.00',
  `transferStatus` varchar(32) DEFAULT '',
  `registrationStatus` varchar(32) DEFAULT '',
  `settlementStatus` varchar(32) DEFAULT '',
  `isSpecial` tinyint(1) DEFAULT 0,
  `remark` text,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER //
CREATE PROCEDURE add_column_if_not_exists()
BEGIN
  IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settlements' AND COLUMN_NAME = 'customerName'
  ) THEN
    ALTER TABLE `settlements` ADD COLUMN `customerName` varchar(128) DEFAULT '' AFTER `customerService`;
  END IF;

  IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settlements' AND COLUMN_NAME = 'isSpecial'
  ) THEN
    ALTER TABLE `settlements` ADD COLUMN `isSpecial` tinyint(1) DEFAULT 0 AFTER `settlementStatus`;
  END IF;
END //
DELIMITER ;

CALL add_column_if_not_exists();
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

CREATE TABLE IF NOT EXISTS `transfer_records` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `imageData` longtext,
  `note` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transfer_settlements` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `transferId` int NOT NULL,
  `settlementId` int NOT NULL,
  INDEX `idx_transfer_id` (`transferId`),
  INDEX `idx_settlement_id` (`settlementId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 第三步：在飞牛 NAS Docker 中创建 Compose 项目

1. 打开飞牛 NAS 桌面的 **「Docker」** 应用
2. 点击左侧 **「Compose」**
3. 点击右上角 **「+ 新增项目」**
4. 项目名称填：**settlement-deploy**
5. 路径选择：**/vol1/docker/settlement-deploy**（就是刚才创建的目录）
6. 它会自动读取目录下的 `docker-compose.yml`
7. 点击 **「创建」** 或 **「部署」**

---

## 第四步：等待启动完成

- MySQL 数据库需要约 **30-60 秒** 完成初始化
- Web 应用会在数据库就绪后自动启动
- 在 Docker → Compose → settlement-deploy → 容器 中，确认三个容器都显示 **运行中（绿色）**

---

## 第五步：访问系统

在浏览器中打开：

```
http://你的NAS的IP地址:9091
```

登录信息：
- 用户名：**Evan**
- 密码：**admin123**

---

## 后续自动更新说明

Watchtower 每 **5 分钟** 自动检查 Docker Hub 上的镜像是否有更新。当 GitHub 代码推送后，GitHub Actions 会自动构建新镜像并推送到 Docker Hub，Watchtower 检测到后会自动拉取新镜像并重启 Web 容器。**无需手动操作。**

---

## 常见问题

**Q: 端口 3306 被占用怎么办？**
修改 `docker-compose.yml` 中 mysql 的端口映射，比如改为 `"3307:3306"`

**Q: 端口 9091 被占用怎么办？**
修改 `docker-compose.yml` 中 web 的端口映射，比如改为 `"9092:9091"`，然后访问 `http://NAS的IP:9092`

**Q: 容器启动失败怎么办？**
在 Docker → 容器 中，点击对应容器查看日志，根据错误信息排查
