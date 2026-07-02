-- ~320px thumbnail variant for mobile/card srcset. Nullable: photos uploaded
-- before this migration only have the 900px thumbnail and fall back to it.
ALTER TABLE photos
  ADD COLUMN thumbnail_small VARCHAR(500) NULL AFTER thumbnail,
  ADD INDEX idx_photos_thumbnail_small (thumbnail_small);
