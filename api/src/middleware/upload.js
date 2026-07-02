const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

// Incoming files land on disk (not RAM): a 12 x 200MB batch buffered in memory
// could OOM the container. Processing reads from these temp paths, and the
// routes clean them up in a finally.
const tmpDir = path.join(uploadPath, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: tmpDir,
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '') || '').toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are supported.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit (videos can be large)
  }
});

// Removes multer temp files after processing. ENOENT is expected when the
// video pipeline already consumed (moved) the file.
function cleanupFiles(files) {
  for (const file of files || []) {
    if (file && file.path) {
      fs.unlink(file.path, err => {
        if (err && err.code !== 'ENOENT') {
          console.error(`Failed to remove temp upload ${file.path}:`, err);
        }
      });
    }
  }
}

module.exports = upload;
module.exports.cleanupFiles = cleanupFiles;
module.exports.tmpDir = tmpDir;
