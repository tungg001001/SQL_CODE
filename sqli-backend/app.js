const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
app.use(express.json());

// 動態幫每個 Session/請求建立即用即棄的 SQLite 記憶體資料庫
function createIsolatedDB(sessionId, callback) {
    const db = new sqlite3.Database(':memory:');
    const flag = 'FLAG{' + crypto.createHash('md5').update(sessionId + 'SQLI_SECRET_KEY').digest('hex') + '}';

    db.serialize(() => {
        db.run("CREATE TABLE users (id INT, username TEXT, password TEXT, role TEXT)");
        db.run("INSERT INTO users VALUES (1, 'admin', 'Pass_9981_Admin!', 'admin')");
        db.run("INSERT INTO users VALUES (2, 'guest', 'guest123', 'user')");

        db.run("CREATE TABLE secret_flags (id INT, flag_value TEXT)");
        db.run(`INSERT INTO secret_flags VALUES (1, '${flag}')`);

        callback(db, flag);
    });
}

// Lab 1: Auth Bypass
app.post('/api/lab1/login', (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'default_user';
    const { username, password } = req.body;

    createIsolatedDB(sessionId, (db) => {
        const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
        
        db.get(query, (err, row) => {
            db.close();
            if (err) return res.json({ success: false, error: err.message, query });
            if (row && row.username === 'admin') {
                return res.json({ success: true, message: "繞過成功！歡迎 Admin 入內。", query });
            }
            res.json({ success: false, message: "登入失敗，密碼錯誤或使用者不存在。", query });
        });
    });
});

// Lab 2: UNION Injection (Data Extraction)
app.get('/api/lab2/search', (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'default_user';
    const id = req.query.id || '1';

    createIsolatedDB(sessionId, (db) => {
        const query = `SELECT id, username, role FROM users WHERE id = ${id}`;

        db.all(query, (err, rows) => {
            db.close();
            if (err) return res.json({ success: false, error: err.message, query });
            res.json({ success: true, results: rows, query });
        });
    });
});

// 驗證 Flag 介面
app.post('/api/verify_flag', (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'default_user';
    const { user_flag } = req.body;
    const expectedFlag = 'FLAG{' + crypto.createHash('md5').update(sessionId + 'SQLI_SECRET_KEY').digest('hex') + '}';

    if (user_flag && user_flag.trim() === expectedFlag) {
        return res.json({ success: true, message: "🎉 恭喜！Flag 正確，成功通關！" });
    }
    res.json({ success: false, message: "❌ Flag 錯誤，請再試試。" });
});

app.listen(3000, () => console.log('API running on port 3000'));
