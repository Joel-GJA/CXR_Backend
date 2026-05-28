const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { exec } = require('child_process');
const config   = require('../config');

const router = express.Router();
let _roomManager = null;
router.setRoomManager = (rm) => { _roomManager = rm; };

const tmpDir = path.resolve(__dirname, '../tmp-uploads');
fs.mkdirSync(tmpDir, { recursive: true });

const upload = multer({
  dest: tmpDir,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // 4 GB
});

function extractZip(filePath, destDir) {
  return new Promise((resolve, reject) => {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      zip.extractAllTo(destDir, true);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function execCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 300_000 }, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve();
    });
  });
}

router.post('/upload', upload.single('build'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded.' });

  const orig    = req.file.originalname;
  const tmpPath = req.file.path;

  const buildName = orig
    .replace(/\.(tar\.gz|tgz|tar|zip|rar)$/i, '')
    .replace(/[^a-zA-Z0-9_\-. ]/g, '_')
    .trim() || 'unity-build';

  const destDir = path.join(config.buildsDir, buildName);

  const cleanup = () => {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  };

  const cleanupAll = () => {
    cleanup();
    try { fs.rmSync(destDir, { recursive: true, force: true }); } catch (_) {}
  };

  try {
    fs.mkdirSync(config.buildsDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });

    const lower = orig.toLowerCase();

    if (lower.endsWith('.zip')) {
      await extractZip(tmpPath, destDir);
    } else if (lower.endsWith('.rar')) {
      await execCmd(`unrar x -o+ "${tmpPath}" "${destDir}/"`);
    } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
      await execCmd(`tar -xzf "${tmpPath}" -C "${destDir}"`);
    } else if (lower.endsWith('.tar')) {
      await execCmd(`tar -xf "${tmpPath}" -C "${destDir}"`);
    } else {
      cleanup();
      return res.status(400).json({ ok: false, error: 'Unsupported format. Use .zip, .rar, .tar.gz, or .tar' });
    }

    cleanup();

    // Make any .x86_64 files executable
    try {
      await execCmd(`find "${destDir}" -name "*.x86_64" -o -name "*.x86" | xargs -r chmod +x`);
    } catch (_) {}

    // Refresh the live build registry so new build is immediately available
    const freshBuilds = config.rescanBuilds();
    if (_roomManager) _roomManager.refreshBuilds(freshBuilds);
    const normalizedId = buildName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const registered = !!freshBuilds[normalizedId];

    res.json({
      ok: true,
      buildName,
      buildId: normalizedId,
      registered,
      message: `Build "${buildName}" extracted and ready.${registered ? '' : ' No .x86_64 binary found — build ID not registered.'}`,
    });
  } catch (err) {
    cleanupAll();
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List all builds on disk (raw directory listing)
router.get('/list', (req, res) => {
  try {
    fs.mkdirSync(config.buildsDir, { recursive: true });
    const dirs = fs.readdirSync(config.buildsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => {
        const dir = path.join(config.buildsDir, e.name);
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.x86_64') || f.endsWith('.x86'));
        return { name: e.name, executable: files[0] || null, path: dir };
      });
    res.json({ ok: true, builds: dirs, buildsDir: config.buildsDir });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete a build folder
router.delete('/:name', (req, res) => {
  const name = req.params.name;
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(name)) {
    return res.status(400).json({ ok: false, error: 'Invalid build name.' });
  }
  const dir = path.join(config.buildsDir, name);
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ ok: false, error: 'Build not found.' });
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    const freshBuilds = config.rescanBuilds();
    if (_roomManager) _roomManager.refreshBuilds(freshBuilds);
    res.json({ ok: true, message: `Build "${name}" deleted.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
