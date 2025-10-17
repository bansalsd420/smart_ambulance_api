const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

function signToken(user) {
  const payload = {
    id: user.id,
    role: user.role,
    hospital_id: user.hospital_id,
    fleet_id: user.fleet_id,
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '8h' });
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    const safeUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      hospital_id: user.hospital_id,
      fleet_id: user.fleet_id,
      full_name: user.full_name,
    };
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
};
