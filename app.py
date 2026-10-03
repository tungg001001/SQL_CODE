import time
import sqlite3
from flask import Flask, render_template, request, jsonify

app = Flask(__name__, template_folder='frontend', static_folder='frontend')

# 定義 10 大關卡的標準 FLAG 答案庫
FLAGS = {
    1: "FLAG{auth_bypass_successful_login}",
    2: "FLAG{union_select_data_exfiltration}",
    3: "FLAG{waf_bypass_comment_case_mix}",
    4: "FLAG{error_based_cast_type_leak}",
    5: "FLAG{boolean_blind_substr_match}",
    6: "FLAG{time_based_delay_success}",
    7: "FLAG{second_order_sqli_payload_stored}",
    8: "FLAG{stacked_queries_multi_statement}",
    9: "FLAG{wide_byte_gbk_backslash_eat}",
    10: "FLAG{json_field_direct_concat_vulnerable}"
}

# 暫存 Lab 7 的二階段數據 (以 Session ID 為 key)
lab7_storage = {}


@app.route('/')
def index():
    return render_template('index.html')


# ==================== Lab 1: Auth Bypass ====================
@app.route('/api/lab1/login', methods=['POST'])
def lab1_login():
    data = request.get_json() or {}
    username = data.get('username', '')

    # 檢測閉合與註解
    if "'" in username and ("--" in username or "/*" in username or "or" in username.lower()):
        return jsonify({
            "success": True,
            "message": "Lab 1 成功！已成功繞過驗證登入 Admin 帳號。",
            "flag": FLAGS[1]
        })
    return jsonify({"success": False, "message": "登入失敗，請檢查 SQL Payload"})


# ==================== Lab 2: UNION 撈取 ====================
@app.route('/api/lab2/search', methods=['GET'])
def lab2_search():
    query_id = request.args.get('id', '')

    if "union" in query_id.lower() and "select" in query_id.lower():
        return jsonify({
            "success": True,
            "message": "Lab 2 成功！已透過 UNION 跨表查詢擷取 Flag。",
            "flag": FLAGS[2],
            "data": [{"id": 1, "username": "admin", "role": FLAGS[2]}]
        })
    return jsonify({"success": False, "message": "搜尋無結果"})


# ==================== Lab 3: WAF 繞過 ====================
@app.route('/api/lab3/search', methods=['GET'])
def lab3_search():
    keyword = request.args.get('keyword', '')

    # 繞過過濾 (例如使用 /**/ 代替空格，或大小寫混淆)
    if ("union" in keyword.lower() and "select" in keyword.lower()) and ("/**/" in keyword or keyword != keyword.lower()):
        return jsonify({
            "success": True,
            "message": "Lab 3 成功！成功繞過 WAF 關鍵字與空格限制。",
            "flag": FLAGS[3]
        })
    return jsonify({"success": False, "message": "WAF 阻擋：檢測到惡意字元或格式不合"})


# ==================== Lab 4: 報錯注入 ====================
@app.route('/api/lab4/user', methods=['GET'])
def lab4_user():
    query_id = request.args.get('id', '')

    if "cast" in query_id.lower() or "convert" in query_id.lower() or "extractvalue" in query_id.lower():
        return jsonify({
            "success": False,
            "error": f"SQLite3 Error: Conversion failed when converting the varchar value '{FLAGS[4]}' to data type int.",
            "flag": FLAGS[4]
        })
    return jsonify({"success": True, "message": "正常查詢結果：使用者資料無誤"})


# ==================== Lab 5: 布林盲注 ====================
@app.route('/api/lab5/check', methods=['GET'])
def lab5_check():
    username = request.args.get('username', '')

    if "substr" in username.lower() or "substring" in username.lower() or "' and" in username.lower():
        return jsonify({
            "exists": True,
            "message": "條件成立 (True)",
            "flag": FLAGS[5]
        })
    return jsonify({"exists": False, "message": "條件不成立 (False)"})


# ==================== Lab 6: 時間盲注 ====================
@app.route('/api/lab6/profile', methods=['GET'])
def lab6_profile():
    query_id = request.args.get('id', '')

    if "delay" in query_id.lower() or "sleep" in query_id.lower() or "benchmark" in query_id.lower():
        time.sleep(2.1)  # 模擬延遲 2 秒
        return jsonify({
            "success": True,
            "message": "查詢完成 (觸發延遲 2000ms+)",
            "flag": FLAGS[6]
        })
    return jsonify({"success": True, "message": "查詢完成"})


# ==================== Lab 7: 二次注入 ====================
@app.route('/api/lab7/update_bio', methods=['POST'])
def lab7_update_bio():
    session_id = request.headers.get('x-session-id', 'default')
    data = request.get_json() or {}
    bio = data.get('bio', '')

    lab7_storage[session_id] = bio
    return jsonify({"success": True, "message": f"Bio 已安全寫入資料庫：{bio}"})


@app.route('/api/lab7/trigger_bio', methods=['GET'])
def lab7_trigger_bio():
    session_id = request.headers.get('x-session-id', 'default')
    stored_bio = lab7_storage.get(session_id, '')

    if "'" in stored_bio or "or" in stored_bio.lower():
        return jsonify({
            "success": True,
            "message": "Lab 7 成功！二次渲染讀取 Bio 時觸發 SQL 語句拼接。",
            "flag": FLAGS[7]
        })
    return jsonify({"success": False, "message": "Bio 觸發執行正常，無異常語法"})


# ==================== Lab 8: 堆疊查詢 ====================
@app.route('/api/lab8/execute', methods=['POST'])
def lab8_execute():
    data = request.get_json() or {}
    cmd = data.get('cmd', '')

    if ";" in cmd and ("update" in cmd.lower() or "insert" in cmd.lower() or "drop" in cmd.lower()):
        return jsonify({
            "success": True,
            "message": "Lab 8 成功！堆疊查詢已成功執行第二條命令。",
            "flag": FLAGS[8]
        })
    return jsonify({"success": False, "message": "僅執行單一查詢指令"})


# ==================== Lab 9: 寬位元組 ====================
@app.route('/api/lab9/search', methods=['GET'])
def lab9_search():
    name = request.args.get('name', '')

    if "%df" in name.lower() or "\\'" in name or "0xdf" in name.lower():
        return jsonify({
            "success": True,
            "message": "Lab 9 成功！%df 吃掉反斜線 \\，單引號成功逃逸。",
            "flag": FLAGS[9]
        })
    return jsonify({"success": False, "message": "輸入已被安全轉義為 \\'"})


# ==================== Lab 10: JSON 注入 ====================
@app.route('/api/lab10/json_search', methods=['POST'])
def lab10_json_search():
    data = request.get_json() or {}
    filter_data = data.get('filter', {})
    val = str(filter_data.get('id', ''))

    if "or" in val.lower() or "'" in val or "1=1" in val:
        return jsonify({
            "success": True,
            "message": "Lab 10 成功！JSON 內部欄位直接拼接至 SQL 語法中爆發漏洞。",
            "flag": FLAGS[10]
        })
    return jsonify({"success": False, "message": "JSON 內容查詢無結果"})


# ==================== Flag 驗證與計分接口 ====================
@app.route('/api/verify_flag', methods=['POST'])
def verify_flag():
    data = request.get_json() or {}
    user_flag = data.get('user_flag', '').strip()

    if user_flag in FLAGS.values():
        return jsonify({"success": True, "message": "🎉 驗證成功！Flag 正確，獲得 10 分！"})
    return jsonify({"success": False, "message": "❌ Flag 錯誤，請檢查後重新提交。"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
