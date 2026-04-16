const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const dataFolder = path.join(__dirname, 'data');
const dbFile = path.join(dataFolder, 'attendance.db');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const adminSessions = new Set();

const requireAdmin = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || !adminSessions.has(token)) {
    return res.status(403).json({ error: 'Unauthorized admin access.' });
  }
  next();
};

const issueAdminToken = () => {
  const token = crypto.randomBytes(24).toString('hex');
  adminSessions.add(token);
  return token;
};

if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder);
}

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Failed to open database:', err);
    process.exit(1);
  }
});

app.use(bodyParser.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

const createTables = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        email TEXT,
        password TEXT,
        descriptor TEXT,
        role TEXT DEFAULT 'student'
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        timestamp TEXT
      )
    `);

    db.all("PRAGMA table_info(users)", (err, columns) => {
      if (!err && columns && !columns.some((col) => col.name === 'role')) {
        db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "student"', (alterErr) => {
          if (alterErr) {
            console.error('Failed to migrate users table for role column:', alterErr);
          }
        });
      }
    });
  });
};

createTables();

app.post('/api/signup', (req, res) => {
  const { username, email, password, role = 'student' } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const stmt = db.prepare('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)');
  stmt.run(username, email, password, role, function (err) {
    if (err) {
      return res.status(409).json({ error: 'User already exists.' });
    }
    res.json({ success: true, message: 'Signup completed.' });
  });
  stmt.finalize();
});

app.post('/api/save-face', (req, res) => {
  const { username, descriptor, force = false } = req.body;
  if (!username || !descriptor) {
    return res.status(400).json({ error: 'Missing username or descriptor.' });
  }

  db.get('SELECT descriptor FROM users WHERE username = ?', username, (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed.' });
    }
    if (!row) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (row.descriptor && !force) {
      return res.status(409).json({ error: 'Face already registered for this user. Use the update option to change it.', alreadyRegistered: true });
    }

    const descriptorText = JSON.stringify(descriptor);
    const stmt = db.prepare('UPDATE users SET descriptor = ? WHERE username = ?');
    stmt.run(descriptorText, username, function (updateErr) {
      if (updateErr) {
        return res.status(500).json({ error: 'Database save failed.' });
      }
      res.json({ success: true, message: force ? 'Face updated successfully.' : 'Face registered successfully.', updated: force });
    });
    stmt.finalize();
  });
});

app.get('/api/descriptor', (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'Missing username.' });
  }

  db.get('SELECT descriptor FROM users WHERE username = ?', username, (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Query failed.' });
    }
    if (!row || !row.descriptor) {
      return res.status(404).json({ error: 'Descriptor not found.' });
    }
    res.json({ descriptor: JSON.parse(row.descriptor) });
  });
});

app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
  const token = issueAdminToken();
  res.json({ success: true, token });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  db.serialize(() => {
    db.get('SELECT COUNT(*) AS totalUsers FROM users', (err, usersRow) => {
      if (err) return res.status(500).json({ error: 'Query failed.' });

      db.get("SELECT COUNT(DISTINCT username) AS presentToday FROM attendance WHERE date(timestamp) = date('now')", (err, presentRow) => {
        if (err) return res.status(500).json({ error: 'Query failed.' });

        db.get("SELECT AVG(strftime('%s', timestamp)) AS avgSeconds FROM attendance WHERE date(timestamp) = date('now') GROUP BY date(timestamp)", (err, avgRow) => {
          if (err) return res.status(500).json({ error: 'Query failed.' });

          db.all(
          'SELECT a.username, a.timestamp, COALESCE(u.role, "student") AS role FROM attendance a LEFT JOIN users u ON a.username = u.username ORDER BY a.id DESC LIMIT 10',
          (err, recentRows) => {
            if (err) return res.status(500).json({ error: 'Query failed.' });

            const presentToday = presentRow ? presentRow.presentToday : 0;
            const absentToday = Math.max(0, (usersRow ? usersRow.totalUsers : 0) - presentToday);
            let avgCheckin = '--:--';
            if (avgRow && avgRow.avgSeconds) {
              const dt = new Date(Number(avgRow.avgSeconds) * 1000);
              const hours = String(dt.getUTCHours()).padStart(2, '0');
              const minutes = String(dt.getUTCMinutes()).padStart(2, '0');
              avgCheckin = `${hours}:${minutes}`;
            }

            res.json({
              totalUsers: usersRow.totalUsers,
              presentToday,
              absentToday,
              avgCheckin,
              recentActivity: recentRows,
            });
          }
        );
        });
      });
    });
  });
});

app.post('/api/attendance', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Missing username.' });
  }

  db.get('SELECT username FROM users WHERE username = ?', username, (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database lookup failed.' });
    }
    if (!row) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const timestamp = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO attendance (username, timestamp) VALUES (?, ?)');
    stmt.run(username, timestamp, function (insertErr) {
      if (insertErr) {
        return res.status(500).json({ error: 'Could not log attendance.' });
      }
      res.json({ success: true, username, timestamp });
    });
    stmt.finalize();
  });
});

app.get('/api/attendance', (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'Missing username.' });
  }

  db.all('SELECT id, username, timestamp FROM attendance WHERE username = ? ORDER BY id DESC LIMIT 10', username, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Query failed.' });
    }
    res.json({ attendance: rows });
  });
});

const userSessions = new Map();

const issueUserToken = (username) => {
  const token = crypto.randomBytes(24).toString('hex');
  userSessions.set(token, username);
  return token;
};

const getUserFromToken = (token) => {
  return userSessions.get(token);
};

const requireUser = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  const username = getUserFromToken(token);
  if (!username) {
    return res.status(403).json({ error: 'Unauthorized access.' });
  }
  req.user = username;
  next();
};

app.post('/api/user-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password.' });
  }

  db.get('SELECT username, password, role FROM users WHERE username = ?', username, (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!row || row.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = issueUserToken(username);
    res.json({ success: true, token, username, role: row.role });
  });
});

app.get('/api/user/stats', requireUser, (req, res) => {
  const username = req.user;

  db.get('SELECT role FROM users WHERE username = ?', username, (err, userRow) => {
    if (err || !userRow) {
      return res.status(500).json({ error: 'User lookup failed.' });
    }

    if (userRow.role === 'student') {
      db.all(
        'SELECT timestamp FROM attendance WHERE username = ? ORDER BY timestamp DESC LIMIT 100',
        username,
        (err, attendanceRows) => {
          if (err) {
            return res.status(500).json({ error: 'Query failed.' });
          }

          const totalCheckins = attendanceRows ? attendanceRows.length : 0;
          const lastCheckin = attendanceRows && attendanceRows.length > 0 ? attendanceRows[0].timestamp : null;

          res.json({
            role: 'student',
            username,
            totalCheckins,
            lastCheckin,
            attendanceHistory: attendanceRows || [],
          });
        }
      );
    } else {
      db.serialize(() => {
        db.get('SELECT COUNT(*) AS totalStudents FROM users WHERE role = ?', 'student', (err, usersRow) => {
          if (err) return res.status(500).json({ error: 'Query failed.' });

          db.get("SELECT COUNT(DISTINCT a.username) AS presentToday FROM attendance a JOIN users u ON a.username = u.username WHERE date(a.timestamp) = date('now') AND u.role = 'student'", (err, presentRow) => {
            if (err) return res.status(500).json({ error: 'Query failed.' });

            db.get("SELECT AVG(strftime('%s', a.timestamp)) AS avgSeconds FROM attendance a JOIN users u ON a.username = u.username WHERE date(a.timestamp) = date('now') AND u.role = 'student' GROUP BY date(a.timestamp)", (err, avgRow) => {
              if (err) return res.status(500).json({ error: 'Query failed.' });

              db.all("SELECT a.username, a.timestamp FROM attendance a JOIN users u ON a.username = u.username WHERE date(a.timestamp) = date('now') AND u.role = 'student' ORDER BY a.timestamp DESC LIMIT 10",
                (err, todayRows) => {
                  if (err) return res.status(500).json({ error: 'Query failed.' });

                  const presentToday = presentRow ? presentRow.presentToday : 0;
                  const absentToday = Math.max(0, (usersRow ? usersRow.totalStudents : 0) - presentToday);
                  let avgCheckin = '--:--';
                  if (avgRow && avgRow.avgSeconds) {
                    const dt = new Date(Number(avgRow.avgSeconds) * 1000);
                    const hours = String(dt.getUTCHours()).padStart(2, '0');
                    const minutes = String(dt.getUTCMinutes()).padStart(2, '0');
                    avgCheckin = `${hours}:${minutes}`;
                  }

                  res.json({
                    role: 'teacher',
                    username,
                    totalStudents: usersRow ? usersRow.totalStudents : 0,
                    presentToday,
                    absentToday,
                    avgCheckin,
                    todayCheckins: todayRows || [],
                  });
                }
              );
            });
          });
        });
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
