
![WOHIF1RQPT@5F}VQ`0L)0XL](https://github.com/user-attachments/assets/54a8bebe-55ed-47f3-b054-9839eecce3d5)

# VRCX 用户数据分析工具

## 项目简介

本项目是一个基于**大语言模型**分析**VRCX用户数据**的工具，旨在分析指定用户或多名用户的社交状态、心理状态和行为特征等，提供深度数据洞察。

---

## ⚠️ 注意事项

1. 本工具**仅限 VRCX 用户使用**。  
   - VRCX 使用时间越长，数据越丰富，分析结果越准确。

2. 本项目仍处于开发阶段，目前仅支持基础功能。  
   - 欢迎在 GitHub 提交 Issue 提供建议或报告问题。

3. 只能分析你的好友数据。如需分析非好友，请获取其他用户提供的数据库文件。

4. **本软件仅供娱乐，分析结果不得用于攻击或骚扰他人。**

---

## 🚀 使用说明

### 步骤 0：下载软件

1. 从 [releases](https://github.com/oniyakun/VRCX-Data-Analysis/releases) 下载最新版本的软件。
2. 解压软件，双击 `VRCX Data Analysis.exe` 运行。

### 步骤 1：配置 API

打开软件后，请先配置你的 API 信息：

- 支持所有符合 OpenAI API 标准的服务。
- 配置方法：
  - 点击设置，填写 API Endpoint、API Key 和模型名。
- 获取你的API，可以使用从 [nuwaapi](https://api.nuwaapi.com/register?aff=p4T5) 购买的API

### 示例：

```ini
API Endpoint: https://api.nuwaapi.com/v1/chat/completions
API Key: 你的API密钥
Model: deepseek-r1
```

---

## 2. 加载 VRCX 数据库

- 点击“自动加载 VRCX 数据库”按钮。
- 若自动加载失败，请手动上传文件：
  1. 在 VRCX 中打开 `设置 - 高级 - 常用文件夹 - AppData(VRCX)`。
  2. 找到 `VRCX.sqlite3` 文件，通过软件中的“上传 SQLite 文件”按钮手动加载。

## 3. 数据筛选与选择

- 加载完成后，选择你想分析的表格（例如状态、简介）。
- 推荐选中以下字段进行分析：
  - `created_at` (创建时间)
  - `user_id`（用户 ID，推荐）
  - `display_name`（用户名称）
  - `status`（状态）
  - `status_description`（状态描述）
  - `bio`（个人简介）
- 使用筛选框进行筛选：
  - 输入`user_id`或`display_name`并回车，可添加多个用户。
  - 获取`user_id`的方法：
    - 在VRCX中打开好友页面，复制下方的“玩家ID”。

## 4. 开始分析

- 在页面底部，选择或输入一个 Prompt，例如：
  ```markdown
  分析指定用户过去一周的状态变化，推测心理状态波动情况。
  ```
- 点击“开始分析”，等待分析结果返回。

---

## 🛠 开发指南

### 本地开发环境搭建：

```bash
git clone https://github.com/oniyakun/VRCX-Data-Analysis.git
cd frontend
npm install -i
cd ..
npm install -i
pip install -r requirements.txt
pyinstaller --noconsole --clean app.py
npm run dev
```

### 项目打包指南：

```bash
git clone https://github.com/oniyakun/VRCX-Data-Analysis.git
cd frontend
npm install -i
cd ..
npm install -i
pip install -r requirements.txt
pyinstaller --noconsole --clean app.py
npm run build
```

---

## 📌 配置文件 (config.ini)

示例如下：

```ini
[prompts]
prompt1 = 请分析指定用户的社交状态变化。
prompt2 = 分析该用户的心理状态特征。
prompt3 = 提取用户近期的行为特征并总结。
```

- config.ini文件位于程序```resources\frontend```目录下，用户可自行按格式添加自定义的Prompt。
- 用户可自定义多条 Prompt，用于快速选择。

---

## ✅ 项目待办事项

### 🖥 前端优化
- [x] 重构前端页面
- [x] 自由选择分析数据类型
- [x] 筛选页面增加提示信息，帮助用户选择
- [x] 一定要筛选框有内容的情况下才能触发分析
- [x] 单独选择消息保存为图片的功能
- [x] 分别给数据筛选和分析结果页面增加不同的prompt预设

### 📊 数据分析功能
- [x] 支持多表数据组合分析
- [x] 通过`user_id`确定用户，避免误差
- [x] 自动分析和提取数据库数据
- [x] 自动加载 VRCX 数据库文件
- [x] 预设 prompt 功能
- [x] 支持 prompt 自由选择（单人/多人）
- [x] 连续对话支持
- [x] 在连续对话中途筛选内容并添加到对话中分析

### ⚙️ 系统与 API 接入
- [x] 自动化部署流程
- [x] 任务完成后自动清理缓存文件
- [x] 支持 DeepSeek API
- [x] 用户自定义 API 配置页面

### 📦 应用打包
- [x] 支持 Electron 打包应用

---

## ⚠️ 免责声明

**本软件仅供娱乐！分析结果不可作为任何正式依据。禁止用于恶意攻击、骚扰或违法用途，违者后果自负。**
