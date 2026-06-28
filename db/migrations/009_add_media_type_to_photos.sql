ALTER TABLE photos
  ADD COLUMN media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
  ADD COLUMN duration INT NULL;
