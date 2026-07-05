-- 'feed' zone: photos uploaded directly to the public feed, belonging to no
-- analog or digital gallery. Access: visible to everyone while is_public,
-- admin-only once unpublished (media.js grants nothing for this zone).
ALTER TABLE photos
  MODIFY zone ENUM('analog', 'digital', 'feed') NOT NULL;
