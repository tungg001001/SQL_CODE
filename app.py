from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

# ==================== Lab 1: Auth Bypass (SQL Injection) ====================
@app.route('/api/lab1/login', methods=['POST'])
def lab1_login():
    data = request.get_json() or {}
    username = data.get('username', '')
    password = data.get('password', '')

    # 檢測常見 SQL Injection 繞過語法
    if "'--" in username.replace(" ", "") or "'or" in username.lower().replace(" ", "") or "' or " in username.lower():
        return jsonify({
            "success": True,
            "message": "Lab 1 成功！已成功繞過驗證登入 Admin 帳號。",
            "flag": "FLAG{sql_auth_bypass_success}"  # <--- 補上 Flag
        })
    
    return jsonify({"success": False, "message": "登入失敗，請檢查 SQL Payload"})


# ==================== Lab 2: Union-Based SQLi ====================
@app.route('/api/lab2/search', methods=['POST'])
def lab2_search():
    data = request.get_json() or {}
    query = data.get('query', '')

    if "union" in query.lower():
        return jsonify({
            "success": True,
            "message": "Lab 2 成功！已透過 UNION Injection 擷取資料。",
            "flag": "FLAG{union_based_sqli_extracted}"
        })
    
    return jsonify({"success": False, "message": "搜尋無結果"})


# ==================== Lab 3: Error-Based SQLi ====================
@app.route('/api/lab3/search', methods=['POST'])
def lab3_search():
    data = request.get_json() or {}
    query = data.get('query', '')

    # 檢測 Error-based 函數或觸發語法
    if "extractvalue" in query.lower() or "updatexml" in query.lower() or "'" in query:
        return jsonify({
            "success": True,
            "message": "Lab 3 成功！已觸發 Error-Based 報錯洩漏資料。",
            "flag": "FLAG{error_based_sqli_leak}"  # <--- 補上 Flag
        })
    
    return jsonify({"success": False, "message": "查詢無結果"})


# ==================== Lab 4: Boolean-Based Blind SQLi ====================
@app.route('/api/lab4/check', methods=['POST'])
def lab4_check():
    data = request.get_json() or {}
    query = data.get('query', '')

    if "length" in query.lower() or "substr" in query.lower() or "' and " in query.lower():
        return jsonify({
            "success": True,
            "message": "Lab 4 成功！盲注測試條件成立。",
            "flag": "FLAG{boolean_blind_sqli_exfiltrated}"  # <--- 補上 Flag
        })
    
    return jsonify({"success": False, "message": "狀態： False"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
