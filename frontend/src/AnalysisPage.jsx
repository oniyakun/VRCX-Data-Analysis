import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Container,
  Toolbar,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
  CircularProgress,
  Alert,
  Autocomplete,
  TextField,
  CssBaseline,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  GlobalStyles,
  MenuItem,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Upload } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import html2canvas from 'html2canvas';
import SettingsModal from './SettingsModal';

// Dark theme configuration
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#1e1e1e',
      paper: '#2c2c2c',
    },
    text: {
      primary: '#ffffff',
    },
    primary: {
      main: '#6abf4b',
    },
    secondary: {
      main: '#03dac6',
    },
  },
  typography: {
    fontSize: 15,
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

export default function AnalysisPage() {
  // 状态定义
  const [tables, setTables] = useState([]);
  const [filters, setFilters] = useState({});
  const [selectedColumns, setSelectedColumns] = useState({});
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chartOption, setChartOption] = useState({
    title: {
      text: '请上传数据文件',
      subtext: '等待数据加载...',
      left: 'center',
      top: 'center',
      textStyle: { color: '#999', fontSize: 16 },
    },
    xAxis: { show: false },
    yAxis: { show: false },
  });
  const [promptInput, setPromptInput] = useState('');
  const [apiResponse, setApiResponse] = useState('');
  const navigate = useNavigate();

  // 预设 prompt 下拉框相关状态
  const [presetPrompts, setPresetPrompts] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  // 设置面板状态及 API 配置
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState({
    endpoint: '',
    apiKey: '',
    model: '',
  });

  // 分析结果区域引用（用于截图）
  const responseContainerRef = useRef(null);

  // 用于管理图片数据和对话框显示
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 允许的 Feed 类型
  const allowedFeedTypes = ['feed_gps', 'feed_status', 'feed_bio', 'feed_avatar'];

  // 组件挂载时加载 API 配置和预设 prompt
  useEffect(() => {
    const savedEndpoint = localStorage.getItem('apiEndpoint') || '';
    const savedApiKey = localStorage.getItem('apiKey') || '';
    const savedModel = localStorage.getItem('model') || '';
    setApiConfig({ endpoint: savedEndpoint, apiKey: savedApiKey, model: savedModel });
    if (!savedEndpoint || !savedApiKey || !savedModel) {
      setSettingsOpen(true);
    }
    // 读取本地配置文件中的预设 prompt
    window.electron.ipcRenderer.invoke('read-config').then((result) => {
      if (result.success && result.prompts && result.prompts.length > 0) {
        setPresetPrompts(result.prompts);
      }
    });
  }, []);

  // 根据表名获取显示名称
  const getDisplayName = (tableName) => {
    for (const feedType of allowedFeedTypes) {
      if (tableName.includes(feedType)) {
        const usrPart = tableName.split(feedType)[0].replace(/_$/, '');
        switch (feedType) {
          case 'feed_gps':
            return `${usrPart}的历史位置信息`;
          case 'feed_status':
            return `${usrPart}的历史状态信息`;
          case 'feed_bio':
            return `${usrPart}的历史简介信息`;
          case 'feed_avatar':
            return `${usrPart}的历史模型信息`;
          default:
            return null;
        }
      }
    }
    return null;
  };

  // 手动上传文件处理函数
  const handleUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post('http://localhost:5000/upload', formData);
      const validTables = response.data.tables_metadata.filter(
        (t) =>
          Array.isArray(t?.columns) &&
          Array.isArray(t?.data) &&
          getDisplayName(t.name) !== null
      );
      if (validTables.length === 0) throw new Error('未找到有效表格数据');
      setTables(validTables);
      setPagination(
        validTables.reduce(
          (acc, table) => ({
            ...acc,
            [table.name]: { page: 1, rowsPerPage: 10 },
          }),
          {}
        )
      );
      setSelectedColumns(
        validTables.reduce(
          (acc, table) => ({
            ...acc,
            [table.name]: table.columns.reduce((cols, col) => ({ ...cols, [col]: false }), {}),
          }),
          {}
        )
      );
    } catch (err) {
      setError(err.message);
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 自动加载 VRCX 数据库：
   * 通过调用主进程 IPC 方法寻找并上传位于 AppData\Roaming\VRCX 的 VRCX.sqlite3
   */
  const handleAutoLoadVrcx = async () => {
    setLoading(true);
    setError(null);
    try {
      const { success, data, message } = await window.electron.ipcRenderer.invoke('auto-load-vrcx-db');
      if (!success) {
        setError(message || '自动加载失败');
        setLoading(false);
        return;
      }
      const validTables = data.tables_metadata.filter(
        (t) =>
          Array.isArray(t?.columns) &&
          Array.isArray(t?.data) &&
          getDisplayName(t.name) !== null
      );
      if (validTables.length === 0) throw new Error('未找到有效表格数据');
      setTables(validTables);
      setPagination(
        validTables.reduce(
          (acc, table) => ({
            ...acc,
            [table.name]: { page: 1, rowsPerPage: 10 },
          }),
          {}
        )
      );
      setSelectedColumns(
        validTables.reduce(
          (acc, table) => ({
            ...acc,
            [table.name]: table.columns.reduce((cols, col) => ({ ...cols, [col]: false }), {}),
          }),
          {}
        )
      );
    } catch (err) {
      setError(err.message);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  // 合并过滤数据
  const getMergedFilteredData = useCallback(() => {
    const mergedData = {};
    tables.forEach((table) => {
      const tableSelectedColumns = selectedColumns[table.name] || {};
      const visibleColumns = table.columns.filter((col) => tableSelectedColumns[col]);
      if (visibleColumns.length === 0) return;
      const tableFilters = filters[table.name] || {};
      const filteredData = table.data.filter((row) =>
        visibleColumns.every((col) => {
          const filterValues = tableFilters[col] || [];
          return (
            filterValues.length === 0 ||
            filterValues.some((f) =>
              String(row[table.columns.indexOf(col)]).toLowerCase().includes(f.toLowerCase())
            )
          );
        })
      );
      const selectedData = filteredData.map((row) =>
        visibleColumns.reduce((acc, col) => {
          acc[col] = row[table.columns.indexOf(col)];
          return acc;
        }, {})
      );
      mergedData[table.name] = selectedData;
    });
    return mergedData;
  }, [tables, filters, selectedColumns]);

  // 处理聊天分析请求
  const handleChatAnalysis = async () => {
    try {
      setLoading(true);
      setApiResponse('');
      const mergedData = getMergedFilteredData();
      const payload = {
        model: apiConfig.model,
        messages: [
          {
            role: 'user',
            content: `${promptInput}\n${JSON.stringify(mergedData)}`,
          },
        ],
        stream: true,
      };
      const response = await fetch(apiConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedResponse += chunk;
        const lines = accumulatedResponse.split('\n');
        accumulatedResponse = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const json = JSON.parse(data);
              if (json.choices && json.choices[0].delta.content) {
                setApiResponse((prev) => prev + json.choices[0].delta.content);
              }
              if (json.choices[0].finish_reason === 'stop') break;
            } catch (e) {
              console.error('解析 JSON 失败:', e, '行内容:', line);
            }
          }
        }
      }
    } catch (err) {
      setError(`API 请求失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 自动滚动到响应区域底部
  useEffect(() => {
    if (responseContainerRef.current) {
      responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight;
    }
  }, [apiResponse]);

  // 保存分析结果为图片
  const handleSaveAnalysisAsImage = async () => {
    if (!responseContainerRef.current) return;
    try {
      const originalOverflow = responseContainerRef.current.style.overflow;
      const originalHeight = responseContainerRef.current.style.height;
      responseContainerRef.current.style.overflow = 'visible';
      const scrollHeight = responseContainerRef.current.scrollHeight;
      const { width } = responseContainerRef.current.getBoundingClientRect();
      responseContainerRef.current.style.height = `${scrollHeight}px`;
      const canvas = await html2canvas(responseContainerRef.current, {
        backgroundColor: '#2c2c2c',
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        width,
        height: scrollHeight,
      });
      responseContainerRef.current.style.overflow = originalOverflow;
      responseContainerRef.current.style.height = originalHeight;
      const dataUrl = canvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);
      setDialogOpen(true);
    } catch (error) {
      console.error('Error saving analysis as image:', error);
    }
  };

  // 下载图片
  const handleDownloadImage = () => {
    if (!imageDataUrl) return;
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = 'analysis_result.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 渲染表头
  const renderTableHeader = (table, visibleColumns) => (
    <TableHead>
      <TableRow>
        {visibleColumns.map((col) => (
          <TableCell key={col}>
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              size="small"
              sx={{ width: 180 }}
              onChange={(_, value) =>
                setFilters((prev) => ({
                  ...prev,
                  [table.name]: { ...prev[table.name], [col]: value },
                }))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="多条件筛选"
                  variant="outlined"
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                />
              )}
            />
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );

  // 切换列显示与否
  const handleColumnToggle = (tableName, column) => {
    setSelectedColumns((prev) => {
      const tableSelected = prev[tableName] || {};
      return {
        ...prev,
        [tableName]: { ...tableSelected, [column]: !tableSelected[column] },
      };
    });
    setFilters((prev) => {
      const tableFilters = prev[tableName] || {};
      const { [column]: _, ...rest } = tableFilters;
      return { ...prev, [tableName]: rest };
    });
  };

  // 保存筛选数据为 JSON 文件
  const saveFilteredDataAsJSON = useCallback(() => {
    tables.forEach((table) => {
      const tableSelectedColumns = selectedColumns[table.name] || {};
      const visibleColumns = table.columns.filter((col) => tableSelectedColumns[col]);
      if (visibleColumns.length === 0) return;
      const tableFilters = filters[table.name] || {};
      const filteredData = table.data.filter((row) =>
        visibleColumns.every((col) => {
          const filterValues = tableFilters[col] || [];
          return (
            filterValues.length === 0 ||
            filterValues.some((f) =>
              String(row[table.columns.indexOf(col)]).toLowerCase().includes(f.toLowerCase())
            )
          );
        })
      );
      const selectedData = filteredData.map((row) =>
        visibleColumns.reduce((acc, col) => {
          acc[col] = row[table.columns.indexOf(col)];
          return acc;
        }, {})
      );
      const jsonData = JSON.stringify(selectedData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${table.name}_filtered.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [tables, filters, selectedColumns]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {/* 注入自定义滚动条样式 */}
      <GlobalStyles
        styles={{
          '::-webkit-scrollbar': { width: '8px', height: '8px' },
          '::-webkit-scrollbar-track': { background: '#2c2c2c' },
          '::-webkit-scrollbar-thumb': {
            backgroundColor: '#6abf4b',
            borderRadius: '10px',
            border: '2px solid #2c2c2c',
          },
        }}
      />
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 始终显示工具栏及设置部分 */}
        <Toolbar sx={{ justifyContent: 'space-between', mb: 3, px: 0 }}>
          <Button variant="contained" component="label" startIcon={<Upload />} sx={{ borderRadius: 2 }}>
            上传 SQLite 文件
            <input type="file" hidden accept=".sqlite3" onChange={handleUpload} />
          </Button>
          <Button variant="contained" onClick={handleAutoLoadVrcx} sx={{ borderRadius: 2 }}>
            自动加载VRCX数据库
          </Button>
          <Button variant="contained" onClick={saveFilteredDataAsJSON} sx={{ borderRadius: 2 }}>
            保存筛选数据为 JSON
          </Button>
          <Button variant="contained" onClick={() => setSettingsOpen(true)} sx={{ borderRadius: 2 }}>
            设置
          </Button>
        </Toolbar>

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onSave={(config) => {
            localStorage.setItem('apiEndpoint', config.endpoint);
            localStorage.setItem('apiKey', config.apiKey);
            localStorage.setItem('model', config.model);
            setApiConfig(config);
          }}
          initialConfig={apiConfig}
        />

        {/* 如果没有解析到数据库数据（tables为空），则显示“请上传数据文件”提示的图表区域 */}
        {tables.length === 0 && (
          <Card sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent>
              <ReactECharts option={chartOption} style={{ height: '500px' }} />
            </CardContent>
          </Card>
        )}

        {/* 当存在解析后的数据时显示数据表格 */}
        {tables.map((table) => {
          const state = pagination[table.name] || { page: 1, rowsPerPage: 10 };
          const tableSelectedColumns = selectedColumns[table.name] || {};
          const visibleColumns = table.columns.filter((col) => tableSelectedColumns[col]);
          const tableFilters = filters[table.name] || {};
          const filteredData = table.data.filter((row) =>
            visibleColumns.every((col) => {
              const filterValues = tableFilters[col] || [];
              return (
                filterValues.length === 0 ||
                filterValues.some((f) =>
                  String(row[table.columns.indexOf(col)]).toLowerCase().includes(f.toLowerCase())
                )
              );
            })
          );
          const startIndex = (state.page - 1) * state.rowsPerPage;
          const paginatedData = filteredData.slice(startIndex, startIndex + state.rowsPerPage);
          return (
            <Card key={table.name} sx={{ mb: 3, borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {getDisplayName(table.name)}
                </Typography>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: 16 }}>
                  {table.columns.map((col) => (
                    <Chip
                      key={col}
                      label={col}
                      color={tableSelectedColumns[col] ? 'primary' : 'default'}
                      onClick={() => handleColumnToggle(table.name, col)}
                      sx={{ borderRadius: '16px' }}
                    />
                  ))}
                </div>
                <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                  <Table>
                    {renderTableHeader(table, visibleColumns)}
                    <TableBody>
                      {paginatedData.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {visibleColumns.map((col) => (
                            <TableCell key={col}>{row[table.columns.indexOf(col)]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Pagination
                  count={Math.ceil(filteredData.length / state.rowsPerPage)}
                  page={state.page}
                  onChange={(_, page) =>
                    setPagination((prev) => ({
                      ...prev,
                      [table.name]: { ...prev[table.name], page },
                    }))
                  }
                  sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}
                />
              </CardContent>
            </Card>
          );
        })}

        {/* Prompt 输入区及预设 prompt 下拉框 */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent>
            {/* 预设 prompt 下拉框 */}
            <TextField
              select
              label="预设 prompt"
              value={selectedPreset}
              onChange={(e) => {
                setSelectedPreset(e.target.value);
                setPromptInput(e.target.value);
              }}
              fullWidth
              sx={{ mb: 2 }}
            >
              {presetPrompts.map((option, index) => (
                <MenuItem key={index} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="输入分析 Prompt"
              multiline
              rows={4}
              fullWidth
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="请输入您的分析需求..."
              variant="outlined"
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <div style={{ display: 'flex', gap: 16 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleChatAnalysis}
                disabled={loading}
                sx={{ borderRadius: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : '开始分析'}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleSaveAnalysisAsImage}
                disabled={!apiResponse}
                sx={{ borderRadius: 2 }}
              >
                保存分析结果为图片
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 分析结果区域 */}
        {apiResponse && (
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                分析结果
              </Typography>
              <div
                ref={responseContainerRef}
                style={{
                  fontFamily: 'monospace',
                  lineHeight: 1.6,
                  padding: '16px',
                  backgroundColor: '#2c2c2c',
                  borderRadius: '8px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}
              >
                {apiResponse.split(/(\<think\>[\s\S]*?\<\/think\>)/g).map((part, index) => {
                  if (part.match(/\<think\>[\s\S]*?\<\/think\>/)) {
                    return (
                      <div
                        key={index}
                        style={{
                          backgroundColor: '#333',
                          padding: '12px',
                          borderRadius: '4px',
                          margin: '12px 0',
                          fontStyle: 'italic',
                          color: '#ddd',
                        }}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  {...props}
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {part.replace(/\<think\>|<\/think\>/g, '')}
                        </ReactMarkdown>
                      </div>
                    );
                  }
                  return (
                    <ReactMarkdown
                      key={index}
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter
                              {...props}
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {part}
                    </ReactMarkdown>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 分析结果图片对话框 */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>分析结果图片</DialogTitle>
          <DialogContent>
            {imageDataUrl && (
              <img src={imageDataUrl} alt="Analysis Result" style={{ maxWidth: '100%' }} />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>关闭</Button>
            <Button onClick={handleDownloadImage}>下载</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
}