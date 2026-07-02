-- The authenticated media route resolves every /uploads request by exact
-- filename/thumbnail match; these lookups must not scan the table.
ALTER TABLE photos
  ADD INDEX idx_photos_filename (filename),
  ADD INDEX idx_photos_thumbnail (thumbnail);
