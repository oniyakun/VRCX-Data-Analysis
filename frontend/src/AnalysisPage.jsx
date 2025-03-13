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

// 暗色主题配置
const modernDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#2c2c2c',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
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
    fontFamily: ['Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e1e1e',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          textTransform: 'none',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'transform 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            transform: 'scale(1.05)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: '#2a2a2a',
            transition: 'background-color 0.3s',
            '&:hover': {
              backgroundColor: '#333333',
            },
            '&.Mui-focused': {
              backgroundColor: '#404040',
            },
          },
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          overflow: 'hidden',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#2a2a2a',
          fontWeight: 'bold',
        },
        body: {
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: '#252525',
          },
        },
      },
    },
  },
});

export default function AnalysisPage() {
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

  const [presetPrompts, setPresetPrompts] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState({
    endpoint: '',
    apiKey: '',
    model: '',
  });

  const responseContainerRef = useRef(null);
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);

  const [filterInputs, setFilterInputs] = useState({});

  const allowedFeedTypes = ['feed_gps', 'feed_status', 'feed_bio', 'feed_avatar'];

  useEffect(() => {
    const savedEndpoint = localStorage.getItem('apiEndpoint') || '';
    const savedApiKey = localStorage.getItem('apiKey') || '';
    const savedModel = localStorage.getItem('model') || '';
    setApiConfig({ endpoint: savedEndpoint, apiKey: savedApiKey, model: savedModel });
    if (!savedEndpoint || !savedApiKey || !savedModel) {
      setSettingsOpen(true);
    }
    window.electronAPI.ipcRenderer.invoke('read-config').then((result) => {
      if (result.success && result.prompts && result.prompts.length > 0) {
        setPresetPrompts(result.prompts);
      }
    });
  }, []);

  // 修改 getDisplayName 函数，返回显示名称和提示信息
  const getDisplayNameAndHint = (tableName) => {
    for (const feedType of allowedFeedTypes) {
      if (tableName.includes(feedType)) {
        const usrPart = tableName.split(feedType)[0].replace(/_$/, '');
        switch (feedType) {
          case 'feed_gps':
            return {
              displayName: `${usrPart}的历史位置信息`,
              hint: '正常不建议添加此项进行分析，可以选择 created_at, display_name, world_name 选项，当用户以前修改过名字时，请使用用户的 user_id 筛选',
            };
          case 'feed_status':
            return {
              displayName: `${usrPart}的历史状态信息`,
              hint: '建议选择 created_at, display_name, status, status_description 选项，当用户以前修改过名字时，请使用用户的 user_id 筛选',
            };
          case 'feed_bio':
            return {
              displayName: `${usrPart}的历史简介信息`,
              hint: '建议选择 created_at, display_name, bio 选项，当用户以前修改过名字时，请使用用户的 user_id 筛选',
            };
          case 'feed_avatar':
            return {
              displayName: `${usrPart}的历史模型信息`,
              hint: '不建议添加此项进行分析，没有太大作用',
            };
          default:
            return { displayName: null, hint: null };
        }
      }
    }
    return { displayName: null, hint: null };
  };

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
          getDisplayNameAndHint(t.name).displayName !== null
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
      setFilterInputs(
        validTables.reduce(
          (acc, table) => ({
            ...acc,
            [table.name]: table.columns.reduce((cols, col) => ({ ...cols, [col]: [] }), {}),
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

  const handleAutoLoadVrcx = async () => {
    setLoading(true);
    setError(null);
    try {
      const { success, data, message } = await window.electronAPI.ipcRenderer.invoke('auto-load-vrcx-db');
      if (!success) {
        setError(message || '自动加载失败');
        setLoading(false);
        return;
      }
      const validTables = data.tables_metadata.filter(
        (t) =>
          Array.isArray(t?.columns) &&
          Array.isArray(t?.data) &&
          getDisplayNameAndHint(t.name).displayName !== null
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
      setFilterInputs(
        validTables.reduce(
          (acc, table) => ({
            ...acc,
            [table.name]: table.columns.reduce((cols, col) => ({ ...cols, [col]: [] }), {}),
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

  const handleChatAnalysis = async () => {
    const hasFilterInput = Object.values(filterInputs).some((tableFilters) =>
      Object.values(tableFilters).some((filter) => filter.length > 0)
    );
    if (!hasFilterInput || !promptInput.trim()) {
      setValidationDialogOpen(true);
      return;
    }

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

  useEffect(() => {
    if (responseContainerRef.current) {
      responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight;
    }
  }, [apiResponse]);

  const handleSaveAnalysisAsImage = () => {
    if (!responseContainerRef.current) return;
    setIsCapturing(true);
  };

  useEffect(() => {
    if (isCapturing) {
      const capture = async () => {
        try {
          const canvas = await html2canvas(responseContainerRef.current, {
            backgroundColor: '#2c2c2c',
            scale: 2,
            useCORS: true,
          });
          const dataUrl = canvas.toDataURL('image/png');
          setImageDataUrl(dataUrl);
          setDialogOpen(true);
        } catch (error) {
          console.error('Error saving analysis as image:', error);
        } finally {
          setIsCapturing(false);
        }
      };
      capture();
    }
  }, [isCapturing]);

  const handleDownloadImage = () => {
    if (!imageDataUrl) return;
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = 'analysis_result.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyToClipboard = async () => {
    if (!imageDataUrl) return;
    try {
      const response = await window.electronAPI.ipcRenderer.invoke('copy-to-clipboard', imageDataUrl);
      if (response.success) {
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请重试');
    }
  };

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
              onChange={(_, value) => {
                setFilters((prev) => ({
                  ...prev,
                  [table.name]: { ...prev[table.name], [col]: value },
                }));
                setFilterInputs((prev) => ({
                  ...prev,
                  [table.name]: { ...prev[table.name], [col]: value },
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="多条件筛选（回车提交）"
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
    setFilterInputs((prev) => {
      const tableFilterInputs = prev[tableName] || {};
      const { [column]: _, ...rest } = tableFilterInputs;
      return { ...prev, [tableName]: rest };
    });
  };

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
    <ThemeProvider theme={modernDarkTheme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          '::-webkit-scrollbar': { width: '8px', height: '8px' },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '::-webkit-scrollbar-thumb': {
            backgroundColor: '#6abf4b',
            borderRadius: '10px',
            border: '2px solid transparent',
          },
          body: {
            backgroundColor: '#2c2c2c',
          },
          '.analysis-result': {
            fontFamily: "'Roboto Mono', monospace",
            fontSize: '16px',
            lineHeight: '1.8',
          },
        }}
      />
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            mb: 4,
            px: 0,
            backgroundColor: '#2c2c2c',
            borderRadius: '12px',
          }}
        >
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

        {tables.length === 0 && (
          <Card sx={{ mb: 4, borderRadius: 3 }}>
            <CardContent>
              <ReactECharts option={chartOption} style={{ height: '500px' }} />
            </CardContent>
          </Card>
        )}

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
          // 获取表名对应的显示名称和提示信息
          const { displayName, hint } = getDisplayNameAndHint(table.name);
          return (
            <Card key={table.name} sx={{ mb: 4, borderRadius: 3 }}>
              <CardContent>
                {/* 显示表名 */}
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {displayName}
                </Typography>
                {/* 显示提示信息 */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {hint}
                </Typography>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: 24 }}>
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
                <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden' }}>
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
                  sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}
                />
              </CardContent>
            </Card>
          );
        })}

        <Card sx={{ mb: 4, borderRadius: 3 }}>
          <CardContent>
            <TextField
              select
              label="预设Prompt"
              value={selectedPreset}
              onChange={(e) => {
                setSelectedPreset(e.target.value);
                setPromptInput(e.target.value);
              }}
              fullWidth
              sx={{ mb: 3 }}
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
              placeholder="请输入您的分析需求，可以根据实际情况修改Prompt"
              variant="outlined"
              sx={{ mb: 3 }}
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

        {apiResponse && (
          <Card sx={{ borderRadius: 3, mb: 4 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3 }}>
                分析结果
              </Typography>
              <div
                ref={responseContainerRef}
                className="analysis-result"
                style={{
                  padding: '16px',
                  backgroundColor: '#1e1e1e',
                  borderRadius: '12px',
                  maxHeight: isCapturing ? 'none' : '400px',
                  height: isCapturing ? 'auto' : undefined,
                  overflowY: isCapturing ? 'visible' : 'auto',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
                }}
              >
                {apiResponse.split(/(\<think\>[\s\S]*?\<\/think\>)/g).map((part, index) => {
                  if (part.match(/\<think\>[\s\S]*?\<\/think\>/)) {
                    return (
                      <div
                        key={index}
                        style={{
                          backgroundColor: '#2a2a2a',
                          padding: '12px',
                          borderRadius: '8px',
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

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>分析结果图片</DialogTitle>
          <DialogContent>
            {imageDataUrl && (
              <img src={imageDataUrl} alt="Analysis Result" style={{ maxWidth: '100%', borderRadius: '12px' }} />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>关闭</Button>
            <Button onClick={handleDownloadImage}>下载</Button>
            <Button onClick={handleCopyToClipboard}>复制图片</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={validationDialogOpen} onClose={() => setValidationDialogOpen(false)}>
          <DialogTitle>提示</DialogTitle>
          <DialogContent>
            <Typography>请至少在一个多条件筛选框内输入内容，并输入分析Prompt。</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setValidationDialogOpen(false)}>确定</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
}