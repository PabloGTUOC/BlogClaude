const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// Use bundled static binaries so no system ffmpeg install is required
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
const fullDir = path.join(uploadPath, 'full');
const thumbsDir = path.join(uploadPath, 'thumbs');
const tmpDir = path.join(uploadPath, 'tmp');

fs.mkdirSync(fullDir, { recursive: true });
fs.mkdirSync(thumbsDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

function probe(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

// Browsers reliably play H.264 + AAC/MP3 in an MP4 container; anything else
// (iPhone HEVC .mov, PCM audio, webm-only codecs) is playback roulette.
const SAFE_VIDEO_CODECS = ['h264'];
const SAFE_AUDIO_CODECS = ['aac', 'mp3'];

// Processes a video upload: probes it, stores it as browser-playable MP4
// (transcoding/remuxing only when the source needs it), and extracts a
// poster-frame thumbnail.
//
// `input` may be a file path (disk-based multer uploads) or a Buffer
// (legacy callers). The input file is CONSUMED — moved into the uploads
// tree or deleted after transcoding — so callers' cleanup must tolerate
// the temp file already being gone.
async function processVideo(input, originalName) {
  // Ensure we have the source on disk — ffmpeg works on files, not buffers.
  let inputPath;
  if (Buffer.isBuffer(input)) {
    inputPath = path.join(tmpDir, `${crypto.randomBytes(16).toString('hex')}${path.extname(originalName || '') || '.mp4'}`);
    fs.writeFileSync(inputPath, input);
  } else {
    inputPath = input;
  }

  try {
    // Random filename: uploads are served statically, so names must be unguessable.
    const token = crypto.randomBytes(16).toString('hex');
    const srcExt = (path.extname(originalName || inputPath).replace(/[^a-zA-Z0-9.]/g, '') || '.mp4').toLowerCase();

    // Probe for codecs, dimensions and duration
    let width = null;
    let height = null;
    let duration = null;
    let videoCodec = null;
    let audioCodec = null;
    try {
      const meta = await probe(inputPath);
      const videoStream = (meta.streams || []).find(s => s.codec_type === 'video');
      const audioStream = (meta.streams || []).find(s => s.codec_type === 'audio');
      if (videoStream) {
        width = videoStream.width || null;
        height = videoStream.height || null;
        videoCodec = videoStream.codec_name || null;
      }
      if (audioStream) {
        audioCodec = audioStream.codec_name || null;
      }
      if (meta.format && meta.format.duration) {
        duration = Math.round(parseFloat(meta.format.duration));
      }
    } catch (err) {
      console.warn('Could not probe video metadata:', err.message);
    }

    const videoOk = videoCodec ? SAFE_VIDEO_CODECS.includes(videoCodec) : false;
    const audioOk = !audioCodec || SAFE_AUDIO_CODECS.includes(audioCodec);
    const containerOk = srcExt === '.mp4' || srcExt === '.m4v';

    let videoFilename;
    let videoFullPath;

    if (videoOk && audioOk && containerOk) {
      // Already browser-safe — move into place untouched.
      videoFilename = `${token}${srcExt}`;
      videoFullPath = path.join(fullDir, videoFilename);
      fs.renameSync(inputPath, videoFullPath);
    } else {
      // Re-encode only the streams that need it; a safe codec in the wrong
      // container (e.g. H.264 .mov) is just remuxed, which is fast.
      videoFilename = `${token}.mp4`;
      videoFullPath = path.join(fullDir, videoFilename);

      const outputOptions = ['-movflags +faststart'];
      if (!videoOk) {
        outputOptions.push('-crf 23', '-preset medium', '-pix_fmt yuv420p');
      }

      console.log(
        `[VIDEO] Converting ${originalName || inputPath} for browser playback ` +
        `(video: ${videoCodec || 'unknown'}${videoOk ? ' copy' : ' -> h264'}, ` +
        `audio: ${audioCodec || 'none'}${audioOk ? ' copy' : ' -> aac'})`
      );

      try {
        await new Promise((resolve, reject) => {
          let command = ffmpeg(inputPath)
            .videoCodec(videoOk ? 'copy' : 'libx264')
            .outputOptions(outputOptions);
          command = audioCodec ? command.audioCodec(audioOk ? 'copy' : 'aac') : command.noAudio();
          command
            .on('end', resolve)
            .on('error', reject)
            .save(videoFullPath);
        });
      } catch (err) {
        // Clean up a half-written output before propagating
        fs.rm(videoFullPath, { force: true }, () => {});
        throw new Error(`Video conversion failed: ${err.message}`, { cause: err });
      }

      fs.unlink(inputPath, () => {});
    }

    // Extract a poster frame (~1s in, or the very start for very short clips)
    const thumbFilename = `${token}.jpg`;
    const thumbFullPath = path.join(thumbsDir, thumbFilename);
    const seekTime = duration && duration < 1 ? 0 : 1;
    await new Promise((resolve, reject) => {
      ffmpeg(videoFullPath)
        .on('end', resolve)
        .on('error', reject)
        .screenshots({
          timestamps: [seekTime],
          filename: thumbFilename,
          folder: thumbsDir,
          size: '900x?'
        });
    });

    // Sanity check the thumbnail actually got written
    if (!fs.existsSync(thumbFullPath)) {
      console.warn('Poster frame was not generated for', videoFilename);
    }

    return {
      filename: `full/${videoFilename}`,
      thumbnail: `thumbs/${thumbFilename}`,
      width,
      height,
      duration,
      media_type: 'video',
      exif_json: null
    };
  } finally {
    // Consume the input in every path, including errors
    fs.unlink(inputPath, err => {
      if (err && err.code !== 'ENOENT') console.error(`Failed to remove video temp ${inputPath}:`, err);
    });
  }
}

module.exports = {
  processVideo
};
