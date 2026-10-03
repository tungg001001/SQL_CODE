const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 動態資料庫初始化
function createIsolatedDB(sessionId, callback) {
    const db = new sqlite3.Database(':memory:');
    const flag = 'FLAG{' + crypto.createHash('md5').update(sessionId + 'SQLI_SECRET_2026').digest('hex') + '}';

    db.serialize(() => {
        // Users Table
        db.run("CREATE TABLE users (id INT, username TEXT, password TEXT, role TEXT, bio TEXT)");
        db.run("INSERT INTO users VALUES (1, 'admin', 'Super_Admin_P@ss_2026', 'admin', 'System Owner')");
        db.run("INSERT INTO users VALUES (2, 'guest', 'guest123', 'user', 'Welcome guest')");

        // Secret Flags Table
        db.run("CREATE TABLE secret_flags (id INT, flag_value TEXT)");
        db.run(`INSERT INTO secret_flags VALUES (1, '${flag}')`);

        callback(db, flag);
    });
}

// Helper: 延遲執行 (用於 Time-Based 盲注模擬)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// Lab 1: Auth Bypass (基礎萬用密碼)
// ==========================================
app.post('/api/lab1/login', (req, res) => {
    const { username, password } = req.body;
    createIsolatedDB(req.headers['x-session-id'] || 'default', (db) => {
        const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
        db.get(query, (err, row) => {
            db.close();
            if (err) return res.json({ success: false, error: err.message });
            if (row && row.username === 'admin') return res.json({ success: true, message: "Lab 1 成功！已以 Admin 身份登入。" });
            res.json({ success: false, message: "登入失敗。" });
        });
    });
});

// ==========================================
// Lab 2: UNION Injection (跨表資料擷取)
// ==========================================
app.get('/api/lab2/search', (req, res) => {
    const id = req.query.id || '1';
    createIsolatedDB(req.headers['x-session-id'] || 'default', (db) => {
        const query = `SELECT id, username, role FROM users WHERE id = ${id}`;
        db.all(query, (err, rows) => {
            db.close();
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true, results: rows });
        });
    });
});

// ==========================================
// Lab 3: WAF / Blacklist Bypass (黑名單繞過)
// ==========================================
app.get('/api/lab3/search', (req, res) => {
    let input = req.query.keyword || '';
    
    // 黑名單過濾：禁止 UNION, SELECT (不區分大小寫), 與空格
    if (/union/i.test(input) || /select/i.test(input) || /\s/.test(input)) {
        return res.json({ success: false, message: "🚨 WAF 攔截：偵測到非法關鍵字或空格！" });
    }

    createIsolatedDB(req.headers['x-session-id'] || 'default', (db) => {
        const query = `SELECT id, username, bio FROM users WHERE username = '${input}'`;
        db.all(query, (err, rows) => {
            db.close();
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true, results: rows });
        });
    });
});

// ==========================================
// Lab 4: Error-Based Injection (報錯注入)
// ==========================================
app.get('/api/lab4/user', (req, res) => {
    const id = req.query.id || '1';
    createIsolatedDB(req.headers['x-session-id'] || 'default', (db) => {
        // 利用 SQLite 轉型錯誤爆出敏感數據
        const query = `SELECT id, username FROM users WHERE id = ${id}`;
        db.get(query, (err, row) => {
            db.close();
            if (err) {
                // 回傳完整的資料庫報錯訊息
                return res.status(500).json({ success: false, db_error: err.message });
            }
            res.json({ success: true, result: row });
        });
    });
});

// ==========================================
// Lab 5: Boolean-Based Blind (布林盲注)
// ==========================================
app.get('/api/lab5/check', (req, res) => {
    const username = req.query.username || '';
    createIsolatedDB(req.headers['x-session-id'] || 'default', (db) => {
        const query = `SELECT id FROM users WHERE username = '${username}'`;
        db.get(query, (err, row) => {
            db.close();
            // 頁面完全不顯示資料與報錯，只回傳 User Exists (True/False)
            if (row) {
                res.json({ exists: true });
            } else {
                res.json({ exists: false });
            }
        });
    });
});

// ==========================================
// Lab 6: Time-Based Blind (時間盲注)
// ==========================================
app.get('/api/lab6/profile', async (req, res) => {
    const id = req.query.id || '1';
    const sessionId = req.headers['x-session-id'] || 'default';
    
    createIsolatedDB(sessionId, async (db, flag) => {
        // 模擬 SQLite 時間延遲（若查詢條件成立則 sleep 2 秒）
        // 學生輸入 Payload 例: 1 AND (SELECT LIKE('F%', flag_value) FROM secret_flags)
        if (id.includes('SLEEP') || id.includes('LIKE') || id.includes('SUBSTR')) {
            // 簡單模擬時間延遲邏輯
            if (id.includes('DELAY')) {
                await sleep(2000);
            }
        }
        
        const query = `SELECT id, username FROM users WHERE id = ${id}`;
        db.get(query, (err, row) => {
            db.close();
            // 無論如何都回傳固定靜態頁面
            res.json({ status: "processed" });
        });
    });
});

// ==========================================
// Lab 7: Second-Order SQLi (二次注入)
// ==========================================
let tempUserStore = {}; // 暫存使用者 Bio

app.post('/api/lab7/update_bio', (req, res) => {
    const { bio } = req.body; // 步驟 1: 儲存未過濾的語法 (例如: admin'--)
    const sessionId = req.headers['x-session-id'] || 'default';
    tempUserStore[sessionId] = bio;
    res.json({ success: true, message: "個人簡介已更新！" });
});

app.get('/api/lab7/trigger_bio', (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'default';
    const storedBio = tempUserStore[sessionId] || 'default bio';

    createIsolatedDB(sessionId, (db) => {
        // 步驟 2: 在第二次調用時，直接拼接到 SQL 語句中觸發漏洞
        const query = `UPDATE users SET bio = 'Updated' WHERE username = '${storedBio}'`;
        db.run(query, function(err) {
            db.close();
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true, message: `二次注入觸發！受影響資料筆數: ${this.changes}` });
        });
    });
});

// ==========================================
// Lab 8: Stacked Queries (堆疊查詢)
// ==========================================
app.post('/api/lab8/execute', (req, res) => {
    const { cmd } = req.body;
    createIsolatedDB(req.headers['x-session-id'] || 'default', (db) => {
        // 使用 exec 支援多條 SQL 命令以分號區隔 (分號注入)
        const query = `SELECT id FROM users WHERE id = 1; ${cmd}`;
        db.exec(query, (err) => {
            db.close();
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true, message: "多重指令執行完畢！" });
        });
    });
});

// ==========================================
// Lab 9: Wide-Byte / Quote Bypass (寬位元組與轉義繞過)
// ==========================================
app.get('/api/lab9/search', (req, res) => {
    let name = req.query.name || '';
    
    // 模擬強行加上轉義斜線 \'
    name = name.replace(/'/g, "\\'");

    // 若輸入包含 %df' (寬位元組)，模擬將 \' 吃掉還原單引號
    if (name.includes('%df') || name.includes('0xdf')) {
        name = name.replace(/%df\\'/g, "'").replace(/0xdf\\'/g, "'");
    }

    createIsolatedDB(req.headers['x-session-id'] || 'default', (db) => {
        const query = `SELECT * FROM users WHERE username = '${name}'`;
        db.all(query, (err, rows) => {
            db.close();
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true, results: rows });
        });
    });
});

// ==========================================
// Lab 10: JSON Field Injection (JSON 欄位注入)
// ==========================================
app.post('/api/lab10/json_search', (req, res) => {
    const { filter } = req.body; // 傳入 JSON 物件，例: {"id": "1 OR 1=1"}
    
    createIsolatedDB(req.headers['x-session-id'] || 'default', (db) => {
        const idVal = filter && filter.id ? filter.id : '1';
        const query = `SELECT id, username, role FROM users WHERE id = ${idVal}`;
        
        db.all(query, (err, rows) => {
            db.close();
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true, results: rows });
        });
    });
});

// 通用 Flag 評分 API
app.post('/api/verify_flag', (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'default';
    const { user_flag } = req.body;
    const expectedFlag = 'FLAG{' + crypto.createHash('md5').update(sessionId + 'SQLI_SECRET_2026').digest('hex') + '}';

    if (user_flag && user_flag.trim() === expectedFlag) {
        return res.json({ success: true, message: "🎉 恭喜！Flag 正確，成功通關此關卡！" });
    }
    res.json({ success: false, message: "❌ Flag 錯誤，請再接再厲。" });
});

app.listen(3000, () => console.log('10-Lab SQLi API running on port 3000'));
