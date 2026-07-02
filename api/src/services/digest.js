const db = require('../db');
const { sendEngagementDigest } = require('./mailer');

// Sends the owner a daily email digest of new likes and comments. State lives
// in app_state so restarts don't re-send or drop a window. The check runs
// hourly; a digest goes out once 24h have passed since the last one.
const STATE_KEY = 'last_engagement_digest_at';
const DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function getLastDigestAt() {
  const rows = await db.query('SELECT `value` FROM app_state WHERE `key` = ?', [STATE_KEY]);
  if (rows.length === 0 || !rows[0].value) return null;
  const date = new Date(rows[0].value);
  return isNaN(date.getTime()) ? null : date;
}

async function setLastDigestAt(date) {
  await db.query(
    'INSERT INTO app_state (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [STATE_KEY, date.toISOString()]
  );
}

async function runDigestCheck() {
  try {
    const last = await getLastDigestAt();
    if (!last) {
      // First run ever: start the clock now rather than digesting all history.
      await setLastDigestAt(new Date());
      return;
    }
    if (Date.now() - last.getTime() < DIGEST_INTERVAL_MS) return;

    const comments = await db.query(
      `SELECT c.body, c.created_at, u.name AS author, p.caption, p.id AS photo_id
       FROM photo_comments c
       LEFT JOIN users u ON u.id = c.user_id
       JOIN photos p ON p.id = c.photo_id
       WHERE c.created_at > ?
       ORDER BY c.created_at ASC`,
      [last]
    );
    const likes = await db.query(
      `SELECT l.created_at, u.name AS author, p.caption, p.id AS photo_id
       FROM photo_likes l
       LEFT JOIN users u ON u.id = l.user_id
       JOIN photos p ON p.id = l.photo_id
       WHERE l.created_at > ?
       ORDER BY l.created_at ASC`,
      [last]
    );

    const now = new Date();
    if (comments.length === 0 && likes.length === 0) {
      // Quiet day: advance the window silently, no empty email.
      await setLastDigestAt(now);
      return;
    }

    await sendEngagementDigest({ comments, likes, since: last, until: now });
    await setLastDigestAt(now);
  } catch (err) {
    // Never let the digest take the API down; next hourly tick retries.
    console.error('[DIGEST] Check failed:', err.message);
  }
}

function startEngagementDigest() {
  runDigestCheck();
  const timer = setInterval(runDigestCheck, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref();
  console.log('[DIGEST] Engagement digest scheduler started (daily, checked hourly).');
}

module.exports = {
  startEngagementDigest,
  runDigestCheck
};
