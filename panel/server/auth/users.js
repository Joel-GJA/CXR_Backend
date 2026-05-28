const fs      = require('fs');
const path    = require('path');
const bcrypt  = require('bcryptjs');

const USERS_FILE = path.resolve(__dirname, '../data/users.json');
const SALT_ROUNDS = 10;

const ROLES = ['admin', 'operator', 'viewer'];

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch (_) { return {}; }
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function ensureDefaultAdmin() {
  const users = loadUsers();
  if (Object.keys(users).length > 0) return;
  const hash = bcrypt.hashSync('admin', SALT_ROUNDS);
  users['admin'] = { username: 'admin', role: 'admin', passwordHash: hash, createdAt: new Date().toISOString() };
  saveUsers(users);
  console.log('[auth] Created default admin user — username: admin  password: admin  (change immediately!)');
}

function getUser(username) {
  return loadUsers()[username] || null;
}

function listUsers() {
  return Object.values(loadUsers()).map(u => ({ username: u.username, role: u.role, createdAt: u.createdAt }));
}

function createUser(username, password, role) {
  if (!username || !/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) throw new Error('Invalid username (2-32 chars, alphanumeric/_/.)');
  if (!password || password.length < 4) throw new Error('Password must be at least 4 characters');
  if (!ROLES.includes(role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);
  const users = loadUsers();
  if (users[username]) throw new Error(`User "${username}" already exists`);
  users[username] = { username, role, passwordHash: bcrypt.hashSync(password, SALT_ROUNDS), createdAt: new Date().toISOString() };
  saveUsers(users);
  return { username, role, createdAt: users[username].createdAt };
}

function updatePassword(username, newPassword) {
  if (!newPassword || newPassword.length < 4) throw new Error('Password must be at least 4 characters');
  const users = loadUsers();
  if (!users[username]) throw new Error(`User "${username}" not found`);
  users[username].passwordHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  saveUsers(users);
}

function updateRole(username, role) {
  if (!ROLES.includes(role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);
  const users = loadUsers();
  if (!users[username]) throw new Error(`User "${username}" not found`);
  users[username].role = role;
  saveUsers(users);
}

function deleteUser(username) {
  const users = loadUsers();
  if (!users[username]) throw new Error(`User "${username}" not found`);
  delete users[username];
  saveUsers(users);
}

function verifyPassword(username, password) {
  const user = getUser(username);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.passwordHash)) return null;
  return { username: user.username, role: user.role };
}

module.exports = { ensureDefaultAdmin, getUser, listUsers, createUser, updatePassword, updateRole, deleteUser, verifyPassword, ROLES };
