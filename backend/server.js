const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Database setup
const dbPath = path.join(__dirname, 'questionnaire.db');
let db;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      q1 TEXT,
      q2 TEXT,
      q3 TEXT,
      q4 TEXT,
      q5 TEXT,
      q6 TEXT,
      q7 TEXT,
      q8 TEXT,
      q9 TEXT,
      q10 TEXT,
      q11 TEXT,
      q12 TEXT,
      q13 TEXT,
      q14_object TEXT,
      q14_adjective TEXT,
      q15_moment TEXT,
      q16_drawing TEXT,
      ip_address TEXT,
      user_agent TEXT
    )
  `);

  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Helper: convert sql.js result to array of objects
function queryAll(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

// ============================================================
// Analysis Logic
// ============================================================

function classifyEmotion(row) {
  const { q9, q10, q11, q12 } = row;

  // 漂泊型 (Drifting): q12=A + (q11=A or q10=D)
  if (q12 === 'A' && (q11 === 'A' || q10 === 'D')) {
    return '漂泊型';
  }

  // 挣扎型 (Struggling): q11=C + (q10=A or q9=D)
  if (q11 === 'C' && (q10 === 'A' || q9 === 'D')) {
    return '挣扎型';
  }

  // 沉稳型 (Stable): q12=D + (q11=D or q10=C)
  if (q12 === 'D' && (q11 === 'D' || q10 === 'C')) {
    return '沉稳型';
  }

  // 探索型 (Exploring): q12=B or q12=C + (q10=B or q11=B)
  if ((q12 === 'B' || q12 === 'C') && (q10 === 'B' || q11 === 'B')) {
    return '探索型';
  }

  return '未分类';
}

function classifyBehavior(row) {
  const { q4, q5, q6, q7, q8, q9 } = row;

  // 数字游牧 (Digital Nomad): q4=A + (q5=D or q8=A)
  if (q4 === 'A' && (q5 === 'D' || q8 === 'A')) {
    return '数字游牧';
  }

  // 社交活跃 (Socially Active): q8=C or q8=D + (q7=C or q7=D)
  if ((q8 === 'C' || q8 === 'D') && (q7 === 'C' || q7 === 'D')) {
    return '社交活跃';
  }

  // 内向沉淀 (Introverted): q8=A + q9=D + (q5=A or q5=B)
  if (q8 === 'A' && q9 === 'D' && (q5 === 'A' || q5 === 'B')) {
    return '内向沉淀';
  }

  // 生活主义 (Life-oriented): q5=C + (q4=B or q6=D)
  if (q5 === 'C' && (q4 === 'B' || q6 === 'D')) {
    return '生活主义';
  }

  return '未分类';
}

// ============================================================
// API Endpoints
// ============================================================

// POST /api/submit — submit a questionnaire response
app.post('/api/submit', (req, res) => {
  try {
    const data = req.body;

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'] || '';

    db.run(`
      INSERT INTO responses (
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
        q11, q12, q13, q14_object, q14_adjective,
        q15_moment, q16_drawing, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.q1 || null,
      data.q2 || null,
      data.q3 || null,
      data.q4 || null,
      data.q5 || null,
      data.q6 || null,
      data.q7 || null,
      data.q8 || null,
      data.q9 || null,
      data.q10 || null,
      data.q11 || null,
      data.q12 || null,
      data.q13 || null,
      data.q14_object || null,
      data.q14_adjective || null,
      data.q15_moment || null,
      data.q16_drawing || null,
      ip,
      ua
    ]);

    const lastId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    saveDatabase();

    res.json({ success: true, id: lastId });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/responses — all responses (admin)
app.get('/api/responses', (req, res) => {
  try {
    const rows = queryAll('SELECT * FROM responses ORDER BY submitted_at DESC');
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Fetch responses error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/responses/:id — single response detail
app.get('/api/responses/:id', (req, res) => {
  try {
    const row = queryOne('SELECT * FROM responses WHERE id = ?', [parseInt(req.params.id)]);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Response not found' });
    }
    // Add analysis dimensions
    row.emotional_type = classifyEmotion(row);
    row.behavioral_type = classifyBehavior(row);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('Fetch response error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats — aggregated statistics
app.get('/api/stats', (req, res) => {
  try {
    const rows = queryAll('SELECT * FROM responses');
    const totalCount = rows.length;

    // Option counts for q1-q13
    const questionStats = {};
    for (let i = 1; i <= 13; i++) {
      const key = `q${i}`;
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      rows.forEach(row => {
        const val = row[key];
        if (val && counts.hasOwnProperty(val)) {
          counts[val]++;
        }
      });
      const percentages = {};
      for (const opt of ['A', 'B', 'C', 'D']) {
        percentages[opt] = totalCount > 0
          ? Math.round((counts[opt] / totalCount) * 10000) / 100
          : 0;
      }
      questionStats[key] = { counts, percentages };
    }

    // Emotional analysis
    const emotionalCounts = {
      '漂泊型': 0,
      '挣扎型': 0,
      '沉稳型': 0,
      '探索型': 0,
      '未分类': 0
    };
    rows.forEach(row => {
      const type = classifyEmotion(row);
      emotionalCounts[type]++;
    });
    const emotionalPercentages = {};
    for (const [key, count] of Object.entries(emotionalCounts)) {
      emotionalPercentages[key] = totalCount > 0
        ? Math.round((count / totalCount) * 10000) / 100
        : 0;
    }

    // Behavioral analysis
    const behavioralCounts = {
      '数字游牧': 0,
      '社交活跃': 0,
      '内向沉淀': 0,
      '生活主义': 0,
      '未分类': 0
    };
    rows.forEach(row => {
      const type = classifyBehavior(row);
      behavioralCounts[type]++;
    });
    const behavioralPercentages = {};
    for (const [key, count] of Object.entries(behavioralCounts)) {
      behavioralPercentages[key] = totalCount > 0
        ? Math.round((count / totalCount) * 10000) / 100
        : 0;
    }

    res.json({
      success: true,
      totalResponses: totalCount,
      questionStats,
      emotionalAnalysis: {
        counts: emotionalCounts,
        percentages: emotionalPercentages
      },
      behavioralAnalysis: {
        counts: behavioralCounts,
        percentages: behavioralPercentages
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/export — CSV export
app.get('/api/export', (req, res) => {
  try {
    const rows = queryAll('SELECT * FROM responses ORDER BY submitted_at DESC');

    const headers = [
      'id', 'submitted_at',
      'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9',
      'q10', 'q11', 'q12', 'q13',
      'q14_object', 'q14_adjective', 'q15_moment',
      'emotional_type', 'behavioral_type',
      'ip_address', 'user_agent'
    ];

    const csvRows = [headers.join(',')];

    rows.forEach(row => {
      row.emotional_type = classifyEmotion(row);
      row.behavioral_type = classifyBehavior(row);

      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        // Escape CSV values
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str}"`
          : str;
      });
      csvRows.push(values.join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=questionnaire_responses.csv');
    // Add BOM for Excel UTF-8 compatibility
    res.send('\ufeff' + csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// Fallback: serve frontend index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Start server
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`✅ 问卷系统后端已启动: http://localhost:${PORT}`);
    console.log(`📁 数据库路径: ${dbPath}`);
    console.log(`📂 静态文件目录: ${path.join(__dirname, '..', 'frontend')}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
