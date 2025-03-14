import React, { useState, useCallback, useRef, useEffect } from 'react';
import ChatUI from './components/ChatUI';
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
  Grid,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Link,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Upload, BarChart, Chat, GitHub } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import html2canvas from 'html2canvas';
import SettingsModal from './SettingsModal';
import { handleStreamResponse, sendMessageToAPI } from './services/messageService';

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
    fontFamily: [
      'Noto Sans SC',
      '-apple-system',
      'BlinkMacSystemFont',
      'Microsoft YaHei',
      'Segoe UI',
      'Roboto',
      'Oxygen',
      'Ubuntu',
      'Cantarell',
      'Fira Sans',
      'Droid Sans',
      'Helvetica Neue',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          overflow: 'visible',
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
          overflow: 'visible',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#2a2a2a',
          fontWeight: 'bold',
          color: 'white',
        },
        body: {
          transition: 'background-color 0.2s',
          color: 'white',
          '&:hover': {
            backgroundColor: '#252525',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:nth-of-type(odd)': {
            backgroundColor: '#1e1e1e',
          },
          '&:nth-of-type(even)': {
            backgroundColor: '#252525',
          },
          '&:hover': {
            backgroundColor: '#333333 !important',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          overflow: 'visible',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          overflow: 'visible',
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
  const [chatHistory, setChatHistory] = useState([]);
  const [chartOption, setChartOption] = useState({
    title: {
      text: '请上传数据文件',
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

  const [activeTab, setActiveTab] = useState('analysis');
  const responseContainerRef = useRef(null);
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [filterInputs, setFilterInputs] = useState({});

  // 新增：表名到编号的映射
  const [tableNameToIdMap, setTableNameToIdMap] = useState({});

  const allowedFeedTypes = ['feed_status', 'feed_gps', 'feed_bio', 'feed_avatar'];

  // 初始化时恢复筛选条件
  useEffect(() => {
    const savedEndpoint = localStorage.getItem('apiEndpoint') || '';
    const savedApiKey = localStorage.getItem('apiKey') || '';
    const savedModel = localStorage.getItem('model') || '';
    const savedFilterInputs = localStorage.getItem('savedFilterInputs');

    setApiConfig({ endpoint: savedEndpoint, apiKey: savedApiKey, model: savedModel });

    if (savedFilterInputs) {
      try {
        const parsedFilterInputs = JSON.parse(savedFilterInputs);
        setFilterInputs(parsedFilterInputs);
        setFilters(parsedFilterInputs);
      } catch (error) {
        console.error('解析保存的筛选条件时出错:', error);
      }
    }

    if (!savedEndpoint || !savedApiKey || !savedModel) {
      setSettingsOpen(true);
    }
    window.electronAPI.ipcRenderer.invoke('read-config').then((result) => {
      if (result.success) {
        try {
          const configContent = result.data;
          const prompts = configContent
            .split('\n')
            .filter(line => line.trim() && !line.startsWith(';') && !line.startsWith('['))
            .map(line => line.trim());
          if (prompts.length > 0) {
            setPresetPrompts(prompts);
            console.log('成功加载预设prompts:', prompts);
          }
        } catch (error) {
          console.error('解析配置文件失败:', error);
        }
      }
    });
  }, []);

  // 监听页面切换，恢复筛选条件
  useEffect(() => {
    if (activeTab === 'analysis') {
      const savedFilterInputs = localStorage.getItem('savedFilterInputs');
      if (savedFilterInputs) {
        try {
          const parsedFilterInputs = JSON.parse(savedFilterInputs);
          setFilterInputs(parsedFilterInputs);
          setFilters(parsedFilterInputs);
        } catch (error) {
          console.error('解析保存的筛选条件时出错:', error);
        }
      }
    }
  }, [activeTab]);

  // 监听 filterInputs 变化，保存到本地存储
  useEffect(() => {
    if (Object.keys(filterInputs).length > 0) {
      localStorage.setItem('savedFilterInputs', JSON.stringify(filterInputs));
    }
  }, [filterInputs]);

  const getDisplayNameAndHint = useCallback((tableName) => {
    if (!tableName || typeof tableName !== 'string') {
      console.error('getDisplayNameAndHint: tableName不是有效字符串', tableName);
      return { displayName: null, hint: null };
    }

    for (const feedType of allowedFeedTypes) {
      if (tableName.includes(feedType)) {
        let usrPart = '';
        try {
          const parts = tableName.split(feedType);
          if (parts.length > 0) {
            usrPart = parts[0].replace(/_$/, '');
          }
        } catch (err) {
          console.error(`解析表格名称 ${tableName} 出错:`, err);
          return { displayName: null, hint: null };
        }

        switch (feedType) {
          case 'feed_gps':
            return {
              displayName: `${usrPart}的历史位置信息`,
              hint: '正常不建议添加此项进行分析，可以根据实际情况修改 created_at, display_name, world_name 选项，当用户以前修改过名字时，请使用用户的 user_id 筛选',
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
          case 'feed_status':
            return {
              displayName: `${usrPart}的历史状态信息`,
              hint: '建议选择 created_at, d isplay_name, status, status_description 选项，当用户以前修改过名字时，请使用用户的 user_id 筛选',
            };
          default:
            return { displayName: null, hint: null };
        }
      }
    }

    return { displayName: null, hint: null };
  }, []);

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setTables([]);
    setSelectedColumns({});
    setFilters({});
    setFilterInputs({});
    setPagination({});
    setTableNameToIdMap({});

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post('http://localhost:5000/upload', formData);

      if (!response.data.tables_metadata || !Array.isArray(response.data.tables_metadata)) {
        setError('返回的数据格式不正确');
        setLoading(false);
        return;
      }

      const validatedTables = response.data.tables_metadata.map((table) => ({
        name: String(table.name),
        columns: Array.isArray(table.columns) ? table.columns : [],
        data: Array.isArray(table.data) ? table.data : [],
      }));

      const validTables = validatedTables.filter((t) => {
        return (
          t.columns.length > 0 &&
          t.data.length > 0 &&
          getDisplayNameAndHint(t.name).displayName !== null
        );
      });

      if (validTables.length === 0) {
        setError('未找到有效表格数据');
        setLoading(false);
        return;
      }

      const tableMap = {};
      validTables.forEach((table, index) => {
        tableMap[table.name] = `表${index + 1}`;
      });
      setTableNameToIdMap(tableMap);

      setTables(validTables);

      const newPagination = {};
      for (const table of validTables) {
        newPagination[table.name] = { page: 1, rowsPerPage: 10 };
      }
      setPagination(newPagination);

      const newFilterInputs = {};
      for (const table of validTables) {
        newFilterInputs[table.name] = {};
        for (const col of table.columns) {
          newFilterInputs[table.name][col] = [];
        }
      }
      setFilterInputs(newFilterInputs);

      const initialSelectedColumns = {};
      for (const table of validTables) {
        initialSelectedColumns[table.name] = {};
        for (let i = 0; i < table.columns.length; i++) {
          initialSelectedColumns[table.name][table.columns[i]] = false;
        }
      }

      setTimeout(() => {
        setSelectedColumns(initialSelectedColumns);
        setLoading(false);
      }, 100);
    } catch (err) {
      setError(err.message || '上传文件处理错误');
      setTables([]);
      setLoading(false);
    }
  }, [getDisplayNameAndHint]);

  const handleAutoLoadVrcx = async () => {
    setLoading(true);
    setError(null);
    setTables([]);
    setSelectedColumns({});
    setFilters({});
    setFilterInputs({});
    setPagination({});
    setTableNameToIdMap({});

    try {
      const { success, data, message } = await window.electronAPI.ipcRenderer.invoke(
        'auto-load-vrcx-db'
      );

      if (!success) {
        setError(message || '自动加载失败');
        setLoading(false);
        return;
      }

      if (!data.tables_metadata || !Array.isArray(data.tables_metadata)) {
        setError('返回的数据格式不正确');
        setLoading(false);
        return;
      }

      const validatedTables = data.tables_metadata.map((table) => ({
        name: String(table.name || ''),
        columns: Array.isArray(table.columns) ? table.columns : [],
        data: Array.isArray(table.data) ? table.data : [],
      }));

      const validTables = validatedTables.filter((table) => {
        return (
          table.columns.length > 0 &&
          table.data.length > 0 &&
          getDisplayNameAndHint(table.name).displayName !== null
        );
      });

      if (validTables.length === 0) {
        setError('未找到有效表格数据');
        setLoading(false);
        return;
      }

      const tableMap = {};
      validTables.forEach((table, index) => {
        tableMap[table.name] = `表${index + 1}`;
      });
      setTableNameToIdMap(tableMap);

      setTables(validTables);

      const newPagination = {};
      for (const table of validTables) {
        newPagination[table.name] = { page: 1, rowsPerPage: 10 };
      }
      setPagination(newPagination);

      const newFilterInputs = {};
      for (const table of validTables) {
        newFilterInputs[table.name] = {};
        for (const col of table.columns) {
          newFilterInputs[table.name][col] = [];
        }
      }
      setFilterInputs(newFilterInputs);

      const newSelectedColumns = {};
      for (const table of validTables) {
        newSelectedColumns[table.name] = {};
        for (let i = 0; i < table.columns.length; i++) {
          newSelectedColumns[table.name][table.columns[i]] = false;
        }
      }

      await new Promise((resolve) => {
        setTimeout(() => {
          setSelectedColumns(newSelectedColumns);
          resolve();
        }, 500);
      });

      setLoading(false);
    } catch (err) {
      setError(err.message || '自动加载VRCX数据库错误');
      setLoading(false);
    }
  };

  const getMergedFilteredData = () => {
    const mergedData = {};
    for (const table of tables) {
      const tableFilters = filterInputs[table.name] || {};
      const hasFilters = Object.values(tableFilters).some((filter) => filter.length > 0);

      if (hasFilters) {
        const tableId = tableNameToIdMap[table.name];
        if (!tableId) continue;

        const filteredData = table.data.filter((row) => {
          return Object.entries(tableFilters).every(([column, values]) => {
            if (!values || values.length === 0) return true;
            const cellValue = row[table.columns.indexOf(column)];
            return values.some((value) =>
              cellValue && cellValue.toString().toLowerCase().includes(value.toLowerCase())
            );
          });
        });

        if (filteredData.length > 0) {
          const selectedData = filteredData.map((row) => {
            const rowData = {};
            Object.entries(selectedColumns[table.name] || {}).forEach(([column, isSelected]) => {
              if (isSelected) {
                rowData[column] = row[table.columns.indexOf(column)];
              }
            });
            return rowData;
          });
          mergedData[tableId] = selectedData;
        }
      }
    }

    return mergedData;
  };

  const handleSendMessage = async (message) => {
    try {
      setLoading(true);
      setApiResponse('');

      const filteredData = getMergedFilteredData();
      const hasFilteredData = Object.keys(filteredData).length > 0;

      const messages = [
        {
          role: 'user',
          content: hasFilteredData
            ? `${message}\n\n以下是相关的数据：\n${JSON.stringify(filteredData, null, 2)}`
            : message,
        },
      ];

      const response = await fetch(apiConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.model,
          messages: messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const callbacks = {
        onThinkContent: (content) => {
          if (activeTab === 'analysis') {
            setChatHistory((prev) => {
              const newHistory = [...prev];
              const lastIndex = newHistory.length - 1;
              if (lastIndex >= 0 && !newHistory[lastIndex].isUser) {
                newHistory[lastIndex].thinkContent = content;
                newHistory[lastIndex].isThinking = true;
              }
              return newHistory;
            });
          }
        },
        onDisplayContent: (content) => {
          if (activeTab === 'analysis') {
            setChatHistory((prev) => {
              const newHistory = [...prev];
              const lastIndex = newHistory.length - 1;
              if (lastIndex >= 0 && !newHistory[lastIndex].isUser) {
                newHistory[lastIndex].content = content;
              }
              return newHistory;
            });
          }
        },
        onComplete: () => {
          if (activeTab === 'analysis') {
            setChatHistory((prev) => {
              const newHistory = [...prev];
              const lastIndex = newHistory.length - 1;
              if (lastIndex >= 0 && !newHistory[lastIndex].isUser) {
                newHistory[lastIndex].isThinking = false;
              }
              return newHistory;
            });
          }
          setLoading(false);
        },
        onError: (error) => {
          console.error(error);
          setError(error);
          setLoading(false);
        },
      };

      if (activeTab === 'analysis') {
        setChatHistory((prev) => [...prev, { content: '', thinkContent: '', isUser: false }]);
      }

      await handleStreamResponse(reader, decoder, callbacks);
    } catch (err) {
      setError(err.message || '发送消息失败');
      setLoading(false);
    }
  };

  const handleChatAnalysis = async () => {
    const hasFilterInput = Object.values(filterInputs).some((tableFilters) =>
      Object.values(tableFilters).some((filter) => filter.length > 0)
    );
    if (!hasFilterInput || !promptInput.trim()) {
      setValidationDialogOpen(true);
      return;
    }

    try {
      setActiveTab('chat');
      localStorage.setItem('savedFilterInputs', JSON.stringify(filterInputs));

      let messageContent = promptInput;
      const analysisData = getMergedFilteredData();
      if (Object.keys(analysisData).length > 0) {
        messageContent = `${promptInput}\n数据分析页面的筛选数据：\n${JSON.stringify(analysisData, null, 2)}`;
      }

      const messages = chatHistory.map((msg) => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content,
      }));
      messages.push({ role: 'user', content: messageContent });

      const response = await sendMessageToAPI(messages, apiConfig);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      setChatHistory((prev) => [...prev, { content: '', thinkContent: '', isUser: false }]);

      await handleStreamResponse(reader, decoder, {
        onThinkContent: (content) => {
          setChatHistory((prev) => {
            const newHistory = [...prev];
            const lastIndex = newHistory.length - 1;
            if (lastIndex >= 0 && !newHistory[lastIndex].isUser) {
              newHistory[lastIndex].thinkContent = content;
              newHistory[lastIndex].isThinking = true;
            }
            return newHistory;
          });
        },
        onDisplayContent: (content) => {
          setChatHistory((prev) => {
            const newHistory = [...prev];
            const lastIndex = newHistory.length - 1;
            if (lastIndex >= 0 && !newHistory[lastIndex].isUser) {
              newHistory[lastIndex].content = content;
            }
            return newHistory;
          });
        },
        onComplete: () => {
          setChatHistory((prev) => {
            const newHistory = [...prev];
            const lastIndex = newHistory.length - 1;
            if (lastIndex >= 0 && !newHistory[lastIndex].isUser) {
              newHistory[lastIndex].isThinking = false;
            }
            return newHistory;
          });
        },
        onError: (error) => {
          setChatHistory((prev) => [
            ...prev,
            { content: `错误: ${error}`, isUser: false },
          ]);
        },
      });

      setPromptInput('');
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { content: `发生错误: ${err.message}`, isUser: false },
      ]);
    }
  };

  useEffect(() => {
    if (responseContainerRef.current) {
      responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight;
    }
  }, []);

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
      if (!response.success) {
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
              value={filterInputs[table.name]?.[col] || []} // 设置初始值
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
    const newSelectedColumns = JSON.parse(JSON.stringify(selectedColumns));
    if (!newSelectedColumns[tableName]) {
      newSelectedColumns[tableName] = {};
    }
    const currentValue = newSelectedColumns[tableName][column] || false;
    newSelectedColumns[tableName][column] = !currentValue;
    setSelectedColumns(newSelectedColumns);
  };

  const saveFilteredDataAsJSON = useCallback(() => {
    if (tables.length === 0) {
      setError('没有可导出的数据');
      return;
    }

    let exportCount = 0;

    for (const table of tables) {
      const tableSelectedColumns = selectedColumns[table.name] || {};
      const visibleColumns = table.columns.filter((col) => tableSelectedColumns[col]);

      if (visibleColumns.length === 0) {
        continue;
      }

      const tableFilters = filters[table.name] || {};

      const filteredData = table.data.filter((row) => {
        return visibleColumns.every((col) => {
          const filterValues = tableFilters[col] || [];
          if (filterValues.length === 0) return true;

          return filterValues.some((filterValue) => {
            const cellValue = String(row[table.columns.indexOf(col)]).toLowerCase();
            return cellValue.includes(filterValue.toLowerCase());
          });
        });
      });

      if (filteredData.length === 0) continue;

      const selectedData = filteredData.map((row) => {
        const newRow = {};
        for (const col of visibleColumns) {
          newRow[col] = row[table.columns.indexOf(col)];
        }
        return newRow;
      });

      const jsonData = JSON.stringify(selectedData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${table.name}_filtered.json`;
      a.click();
      URL.revokeObjectURL(url);

      exportCount++;
    }

    if (exportCount === 0) {
      setError('没有符合条件的数据可导出');
    }
  }, [tables, filters, selectedColumns]);

  useEffect(() => {
    if (loading) {
      setChartOption({
        title: {
          text: '正在解析数据文件，如果数据过大可能会短暂无响应，请稍等...',
          left: 'center',
          top: 'center',
          textStyle: { color: '#999', fontSize: 16 },
        },
        xAxis: { show: false },
        yAxis: { show: false },
      });
    } else if (tables.length === 0) {
      setChartOption({
        title: {
          text: '请上传数据文件',
          left: 'center',
          top: 'center',
          textStyle: { color: '#999', fontSize: 16 },
        },
        xAxis: { show: false },
        yAxis: { show: false },
      });
    }
  }, [loading, tables]);

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
          '.MuiTableCell-root': {
            color: 'white !important',
            fontSize: '14px !important',
            padding: '8px 16px !important',
          },
          '.MuiTableBody-root .MuiTableRow-root': {
            backgroundColor: '#1e1e1e !important',
          },
          '.MuiTableBody-root .MuiTableRow-root:hover': {
            backgroundColor: '#252525 !important',
          },
          '.MuiTableHead-root': {
            backgroundColor: '#2a2a2a !important',
          },
          '.MuiPaper-root': {
            overflow: 'visible !important',
          },
          '.MuiCard-root': {
            overflow: 'visible !important',
          },
          '.MuiTableContainer-root': {
            overflow: 'visible !important',
          },
          '.MuiTable-root': {
            overflow: 'visible !important',
          },
          '.css-k88ygv-MuiPaper-root-MuiCard-root': {
            overflow: 'visible !important',
          },
        }}
      />
      <Container maxWidth="xl" sx={{ py: 4, height: '100vh' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ height: 'calc(100% - 16px)' }}>
          <Grid item xs={2} sx={{ height: '100%' }}>
            <Paper sx={{ height: '100%', borderRadius: '12px', backgroundColor: '#1e1e1e', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <List component="nav" aria-label="功能导航">
                <ListItem disablePadding>
                  <ListItemButton
                    selected={activeTab === 'analysis'}
                    onClick={() => setActiveTab('analysis')}
                    sx={{
                      borderRadius: '8px',
                      m: 1,
                      '&.Mui-selected': {
                        backgroundColor: '#6abf4b',
                        color: '#fff',
                        '&:hover': {
                          backgroundColor: '#5aaf3b',
                        },
                      },
                    }}
                  >
                    <ListItemIcon>
                      <BarChart sx={{ color: activeTab === 'analysis' ? '#fff' : 'inherit' }} />
                    </ListItemIcon>
                    <ListItemText primary="数据筛选" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    selected={activeTab === 'chat'}
                    onClick={() => setActiveTab('chat')}
                    sx={{
                      borderRadius: '8px',
                      m: 1,
                      '&.Mui-selected': {
                        backgroundColor: '#6abf4b',
                        color: '#fff',
                        '&:hover': {
                          backgroundColor: '#5aaf3b',
                        },
                      },
                    }}
                  >
                    <ListItemIcon>
                      <Chat sx={{ color: activeTab === 'chat' ? '#fff' : 'inherit' }} />
                    </ListItemIcon>
                    <ListItemText primary="分析结果" />
                  </ListItemButton>
                </ListItem>
              </List>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ p: 2 }}>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={<Upload />}
                  fullWidth
                  sx={{ mb: 2, borderRadius: 2 }}
                >
                  上传 SQLite 文件
                  <input type="file" hidden accept=".sqlite3" onChange={handleUpload} />
                </Button>
                <Button
                  variant="contained"
                  onClick={handleAutoLoadVrcx}
                  fullWidth
                  sx={{ mb: 2, borderRadius: 2 }}
                  disabled={loading}
                >
                  自动加载VRCX数据库
                </Button>
                <Button
                  variant="contained"
                  onClick={saveFilteredDataAsJSON}
                  fullWidth
                  sx={{ mb: 2, borderRadius: 2 }}
                  disabled={tables.length === 0}
                >
                  保存筛选数据为 JSON
                </Button>
                <Button
                  variant="contained"
                  onClick={() => setSettingsOpen(true)}
                  fullWidth
                  sx={{ borderRadius: 2 }}
                >
                  设置
                </Button>
              </Box>
              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2, textAlign: 'center', color: 'text.secondary'}}>
                <Link
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      await window.electronAPI.openExternal('https://github.com/oniyakun/VRCX-Data-Analysis');
                    } catch (error) {
                      console.error('打开链接失败:', error);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'inherit',
                    '&:hover': { color: '#6abf4b' },
                    mb: 1,
                    cursor: 'pointer'
                  }}
                >
                  <GitHub sx={{ mr: 1 }} />
                  GitHub
                </Link>
                <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                  Made with ♥ by <Link
                    onClick={(e) => {
                      e.preventDefault();
                      window.electronAPI.openExternal('https://vrchat.com/home/user/usr_0e9c75fa-ec70-4043-9fca-264c9e0af6ba');
                    }}
                    sx={{ color: 'inherit', '&:hover': { color: '#6abf4b' }, cursor: 'pointer' }}
                  >Oniyakun</Link>
                </Typography>
                <Typography variant="caption" display="block" sx={{ opacity: 0.7 }}>
                  结果仅供娱乐，请勿当真！
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={10} sx={{ height: '100%', overflowY: 'auto' }}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {activeTab === 'analysis' && (
                <>
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

                    if (visibleColumns.length === 0) {
                      return (
                        <Card key={table.name} sx={{ mb: 4, borderRadius: 3 }}>
                          <CardContent>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                              {getDisplayNameAndHint(table.name).displayName}
                            </Typography>
                            <Alert severity="info">请选择至少一列以显示数据</Alert>
                            <div
                              style={{
                                display: 'flex',
                                gap: '12px',
                                flexWrap: 'wrap',
                                marginBottom: 24,
                                marginTop: 16,
                              }}
                            >
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
                          </CardContent>
                        </Card>
                      );
                    }

                    const tableFilters = filters[table.name] || {};
                    const filteredData = table.data.filter((row) =>
                      visibleColumns.every((col) => {
                        const filterValues = tableFilters[col] || [];
                        return (
                          filterValues.length === 0 ||
                          filterValues.some((f) =>
                            String(row[table.columns.indexOf(col)])
                              .toLowerCase()
                              .includes(f.toLowerCase())
                          )
                        );
                      })
                    );

                    const startIndex = (state.page - 1) * state.rowsPerPage;
                    const paginatedData = filteredData.slice(
                      startIndex,
                      startIndex + state.rowsPerPage
                    );

                    const { displayName, hint } = getDisplayNameAndHint(table.name);
                    return (
                      <Card key={table.name} sx={{ mb: 4, borderRadius: 3, overflow: 'visible' }}>
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 1 }}>
                            {displayName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            {hint}
                          </Typography>
                          <div
                            style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: 24 }}
                          >
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
                          <TableContainer
                            component={Paper}
                            sx={{
                              borderRadius: 2,
                              overflow: 'visible',
                              backgroundColor: '#1e1e1e',
                              '& .MuiTable-root': {
                                backgroundColor: '#1e1e1e',
                              },
                              '& .MuiTableHead-root': {
                                backgroundColor: '#2a2a2a',
                              },
                              '& .MuiTableCell-root': {
                                color: 'white',
                                borderBottom: '1px solid #333',
                              },
                              '& .MuiTableBody-root .MuiTableRow-root:hover': {
                                backgroundColor: '#252525',
                              },
                            }}
                          >
                            <Table>
                              {renderTableHeader(table, visibleColumns)}
                              <TableBody>
                                {paginatedData.length > 0 ? (
                                  paginatedData.map((row, rowIndex) => (
                                    <TableRow key={`row-${table.name}-${rowIndex}`}>
                                      {visibleColumns.map((col, colIndex) => {
                                        const cellIndex = table.columns.indexOf(col);
                                        let cellValue =
                                          cellIndex >= 0 && cellIndex < row.length
                                            ? row[cellIndex]
                                            : '';

                                        return (
                                          <TableCell
                                            key={`cell-${table.name}-${rowIndex}-${colIndex}`}
                                            sx={{
                                              maxWidth: '300px',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'normal',
                                              wordBreak: 'break-word',
                                              color: 'white !important',
                                              fontSize: '14px',
                                              padding: '8px 16px',
                                              backgroundColor:
                                                rowIndex % 2 === 0 ? '#1e1e1e' : '#252525',
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: 'block',
                                                color: 'white',
                                                visibility: 'visible',
                                                opacity: 1,
                                                overflow: 'visible',
                                              }}
                                            >
                                              {cellValue}
                                            </div>
                                          </TableCell>
                                        );
                                      })}
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={visibleColumns.length} align="center">
                                      没有数据
                                    </TableCell>
                                  </TableRow>
                                )}
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
                        {presetPrompts.map((option) => (
                          <MenuItem key={option} value={option}>
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
                </>
              )}

              {activeTab === 'chat' && (
                <ChatUI
                  apiConfig={apiConfig}
                  presetPrompts={presetPrompts}
                  selectedPreset={selectedPreset}
                  setSelectedPreset={setSelectedPreset}
                  chatHistory={chatHistory}
                  setChatHistory={setChatHistory}
                  getMergedFilteredData={getMergedFilteredData}
                  loading={loading}
                  setLoading={setLoading}
                  onError={setError}
                />
              )}
            </Box>
          </Grid>
        </Grid>

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

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>分析结果图片</DialogTitle>
          <DialogContent>
            {imageDataUrl && (
              <img
                src={imageDataUrl}
                alt="Analysis Result"
                style={{ maxWidth: '100%', borderRadius: '12px' }}
              />
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
  )};