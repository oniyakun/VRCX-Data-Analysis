from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import pandas as pd
import tempfile
import os
import logging

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB限制
CORS(app)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clear_temp_directory(temp_dir):
    """清理临时目录中的所有文件"""
    for filename in os.listdir(temp_dir):
        file_path = os.path.join(temp_dir, filename)
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
                logger.info(f'成功删除临时文件: {file_path}')
        except Exception as e:
            logger.error(f'删除临时文件失败: {file_path}, 错误: {str(e)}')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    temp_dir = os.path.join(os.path.dirname(__file__), 'temp')
    os.makedirs(temp_dir, exist_ok=True)

    # 在处理新文件之前清理临时目录
    clear_temp_directory(temp_dir)

    tmp = None
    conn = None
    try:
        # 使用with语句创建临时文件，确保资源管理
        with tempfile.NamedTemporaryFile(suffix='.sqlite3', dir=temp_dir, delete=False) as tmp:
            file.save(tmp.name)
            tmp.close()
            os.environ['SQLITE_TMPDIR'] = os.path.dirname(tmp.name)
            
            # 使用上下文管理器连接数据库
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

            # 保留临时文件用于调试（可根据需要调整）
            logger.info(f'保留临时文件用于调试: {tmp.name}')

            return jsonify({'tables_metadata': tables_metadata}), 200

    except Exception as e:
        logger.error('文件处理失败: %s', str(e), exc_info=True)
        if conn:
            conn.close()
        if tmp and os.path.exists(tmp.name):
            try:
                # 保留临时文件用于调试（可根据需要删除）
                logger.info(f'保留临时文件用于调试: {tmp.name}')
            except Exception as del_error:
                logger.error('删除临时文件失败: %s', str(del_error), exc_info=True)
        return jsonify({'error': '服务器处理文件时发生错误', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)