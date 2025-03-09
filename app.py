from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import pandas as pd
import tempfile
import os
import time

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB限制
CORS(app)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    tmp = None
    conn = None
    try:
        # 使用with语句确保临时文件自动清理
        with tempfile.NamedTemporaryFile(suffix='.sqlite3', delete=False) as tmp:
            file.save(tmp.name)
            tmp.close()
            os.environ['SQLITE_TMPDIR'] = os.path.dirname(tmp.name)
            
            # 使用上下文管理器确保数据库连接自动关闭
            with sqlite3.connect(tmp.name) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                tables = [row[0] for row in cursor.fetchall() if row[0].strip()]
                
                tables_metadata = []
                for table_name in tables:
                    cursor.execute(f'SELECT * FROM "{table_name}"')
                    columns = [desc[0] for desc in cursor.description]
                    data = [[str(item) for item in row] for row in cursor.fetchall()]
                    
                    tables_metadata.append({
                        'name': table_name,
                        'columns': columns,
                        'data': data
                    })

            # 注释掉文件删除逻辑用于调试
            # retry_count = 0
            # while os.path.exists(tmp.name) and retry_count < 10:
            #     try:
            #         os.unlink(tmp.name)
            #         app.logger.info(f'成功删除临时文件: {tmp.name}')
            #         break
            #     except Exception as e:
            #         retry_count += 1
            #         time.sleep(0.5)
            #         app.logger.warning(f'文件删除重试中({retry_count}/10): {str(e)}')
            #         if retry_count >= 10:
            #             app.logger.error('最终删除临时文件失败: %s', str(e))
            #         raise

            return jsonify({'tables_metadata': tables_metadata}), 200

    except Exception as e:
        app.logger.error('文件处理失败: %s', str(e), exc_info=True)
        if conn:
            conn.close()
        if tmp and os.path.exists(tmp.name):
            try:
                # os.unlink(tmp.name)
                app.logger.info(f'保留临时文件用于调试: {tmp.name}')
            except Exception as del_error:
                app.logger.error('删除临时文件失败: %s', str(del_error), exc_info=True)
        return jsonify({'error': '服务器处理文件时发生错误', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)