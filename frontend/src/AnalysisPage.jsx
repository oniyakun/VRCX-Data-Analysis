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
  // State definitions
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

  // Settings modal state and API configuration
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState({
    endpoint: '',
    apiKey: '',
    model: '',
  });

  // Reference for AI analysis result area (for screenshot)
  const responseContainerRef = useRef(null);

  // Allowed feed types
  const allowedFeedTypes = ['feed_gps', 'feed_status', 'feed_bio', 'feed_avatar'];

  // Load API config from localStorage on mount
  useEffect(() => {
    const savedEndpoint = localStorage.getItem('apiEndpoint') || '';
    const savedApiKey = localStorage.getItem('apiKey') || '';
    const savedModel = localStorage.getItem('model') || '';
    setApiConfig({ endpoint: savedEndpoint, apiKey: savedApiKey, model: savedModel });
    if (!savedEndpoint || !savedApiKey || !savedModel) {
      setSettingsOpen(true); // Open settings if any config is missing
    }
  }, []);

  // Function to get display name for tables
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

  // Handle file upload
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

  // Get merged filtered data
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

  // Handle chat analysis request
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

  // Auto-scroll to bottom of response
  useEffect(() => {
    if (responseContainerRef.current) {
      responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight;
    }
  }, [apiResponse]);

  // Export AI analysis result as image
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

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const newTab = window.open(url, '_blank');
        if (newTab) {
          newTab.onload = () => URL.revokeObjectURL(url);
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = 'analysis_result.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error saving analysis as image:', error);
    }
  };

  // Render table header with filters
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

  // Toggle column visibility
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

  // Save filtered data as JSON
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

  // Main UI
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container
        maxWidth="lg"
        sx={{
          py: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {/* Toolbar */}
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            mb: 3,
            px: 0,
          }}
        >
          <Button
            variant="contained"
            component="label"
            startIcon={<Upload />}
            sx={{ borderRadius: 2 }}
          >
            上传 SQLite 文件
            <input type="file" hidden accept=".sqlite3" onChange={handleUpload} />
          </Button>
          <Button
            variant="contained"
            onClick={saveFilteredDataAsJSON}
            sx={{ borderRadius: 2 }}
          >
            保存筛选数据为 JSON
          </Button>
          <Button
            variant="contained"
            onClick={() => setSettingsOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            设置
          </Button>
        </Toolbar>

        {/* Settings Modal with initialConfig */}
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onSave={(config) => {
            localStorage.setItem('apiEndpoint', config.endpoint);
            localStorage.setItem('apiKey', config.apiKey);
            localStorage.setItem('model', config.model);
            setApiConfig(config);
          }}
          initialConfig={apiConfig} // Pass current apiConfig to modal
        />

        {/* Loading and error indicators */}
        {loading && (
          <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Chart area */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent>
            <ReactECharts option={chartOption} style={{ height: '500px' }} />
          </CardContent>
        </Card>

        {/* Data tables */}
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

        {/* Prompt input area */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent>
            <TextField
              label="输入分析 Prompt"
              multiline
              rows={4}
              fullWidth
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="请输入您的分析需求..."
              variant="outlined"
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
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

        {/* AI analysis result area */}
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
      </Container>
    </ThemeProvider>
  );
}