const express = require('express');
const { verifyPassword, listUsers, createUser, updatePassword, updateRole, deleteUser, ROLES } = require('../auth/users');
const { sign } = require('../auth/jwt');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const user = verifyPassword(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  const token = sign({ username: user.username, role: user.role });
  res.json({ ok: true, token, user: { username: user.username, role: user.role } });
});

// GET /api/auth/me  (requires auth — attached by server.js middleware)
router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

// ── User management (admin only) ──────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

router.get('/users', requireAdmin, (req, res) => {
  res.json({ users: listUsers() });
});

router.post('/users', requireAdmin, (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    const user = createUser(username, password, role);
    res.status(201).json({ ok: true, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/users/:username/password', requireAdmin, (req, res) => {
  try {
    const { password } = req.body || {};
    updatePassword(req.params.username, password);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/users/:username/role', requireAdmin, (req, res) => {
  try {
    const { role } = req.body || {};
    if (req.params.username === req.user.username) return res.status(400).json({ error: "Can't change your own role" });
    updateRole(req.params.username, role);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/users/:username', requireAdmin, (req, res) => {
  try {
    if (req.params.username === req.user.username) return res.status(400).json({ error: "Can't delete yourself" });
    deleteUser(req.params.username);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Change own password
router.put('/me/password', (req, res) => {
  try {
    const { password } = req.body || {};
    updatePassword(req.user.username, password);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
