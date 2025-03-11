一个基于使用大语言模型分析VRCX用户数据的工具，皆在用于分析指定用户/多名用户的社交状态，心理状态和行为分析等功能

# ✅ 项目待办事项

## 🖥️ 前端优化
- [x] 重构前端页面
- [x] 自由选择分析数据的类型

## 📊 数据分析功能
- [x] 允许用户组合多个表内的数据来源
- [x] 根据 userid 来确定用户，而不是依靠用户名
- [x] 自动分析数据库内数据，并提取出相关数据用于分析
- [ ] 自动找到目标文件并解析
- [ ] 预设 prompt
- [x] 支持自由选择分析 prompt，用于单人和多人

## ⚙️ 系统与 API 接入
- [ ] 自动化部署流程
- [x] 任务结束后自动删除缓存文件
- [x] 接入 DeepSeek API 支持
- [x] 增加设置页，允许用户自定义 API Endpoint、API Key 和模型

## 📦 应用打包
- [ ] 打包成 Electron 应用
