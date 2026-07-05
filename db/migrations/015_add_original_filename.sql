-- Human-readable upload name for display in the UI. Server-side filenames stay
-- crypto-random (unguessable names are part of the access-control story) and
-- this column is never used to locate files on disk. Nullable: photos uploaded
-- before this migration have no recorded original name.
ALTER TABLE photos
  ADD COLUMN original_filename VARCHAR(500) NULL AFTER filename;
