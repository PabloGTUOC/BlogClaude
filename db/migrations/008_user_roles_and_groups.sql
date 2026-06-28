ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'family', 'friend', 'user') NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN `group` VARCHAR(50) NULL DEFAULT NULL;
