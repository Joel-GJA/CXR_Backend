const express = require('express');
const { verifyPassword, listUsers, createUser, updatePassword, updateRole, deleteUser } = require('../auth/users');
const { sign } = require('../auth/jwt');

const router = express.Router();

const COOKIE_NAME = 'cxr_session';
const COOKIE_OPTS = {
  httpOnly: true,          // JS cannot read it — XSS-proof
  sameSite: 'strict',      // CSRF protection
  secure:   false,         // set to true if using HTTPS
  maxAge:   24 * 60 * 60 * 1000, // 24 hours
  path:     '/',
};

// POST /api/auth/login  (public)
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  const user = verifyPassword(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
  const token = sign({ username: user.username, role: user.role });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ ok: true, user: { username: user.username, role: user.role } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

// ── User management (admin only) ─────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

router.get('/users', requireAdmin, (_req, res) => {
  res.json({ users: listUsers() });
});

router.post('/users', requireAdmin, (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    const user = createUser(username, password, role);
    res.status(201).json({ ok: true, user });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/users/:username/password', requireAdmin, (req, res) => {
  try {
    updatePassword(req.params.username, req.body?.password);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/users/:username/role', requireAdmin, (req, res) => {
  try {
    if (req.params.username === req.user.username) return res.status(400).json({ error: "You can't change your own role." });
    updateRole(req.params.username, req.body?.role);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/users/:username', requireAdmin, (req, res) => {
  try {
    if (req.params.username === req.user.username) return res.status(400).json({ error: "You can't delete yourself." });
    deleteUser(req.params.username);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Change own password
router.put('/me/password', (req, res) => {
  try {
    updatePassword(req.user.username, req.body?.password);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
