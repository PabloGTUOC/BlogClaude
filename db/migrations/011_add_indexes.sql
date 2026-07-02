-- Public feed reads: WHERE is_public = TRUE ORDER BY sort_order ASC, published_at DESC.
-- Without this, every feed page is a full table scan + filesort as the archive grows.
ALTER TABLE photos ADD INDEX idx_photos_public_feed (is_public, sort_order, published_at);
