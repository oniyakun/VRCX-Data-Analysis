import React, { useState, useCallback } from 'react';
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
  Checkbox,
  FormControlLabel,
  Autocomplete,
  TextField,
} from '@mui/material';
import { Upload } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function AnalysisPage() {
  // 状态定义保持不变
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

  const CHATGPT_CONFIG = {
    API_KEY: '',
    ENDPOINT: 'http://localhost:11435/v1/chat/completions',
  };

  // 获取合并后的筛选数据
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

  // 处理智能分析请求
  const handleChatAnalysis = async () => {
    try {
      setLoading(true);
      setApiResponse('');
      const mergedData = getMergedFilteredData();
      const payload = {
        model: 'deepseek-r1:8b',
        messages: [{ role: 'user', content: `${promptInput}\n${JSON.stringify(mergedData)}` }],
        stream: true,
      };

      const response = await fetch(CHATGPT_CONFIG.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHATGPT_CONFIG.API_KEY}`,
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

  // 渲染表格头部
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

  // 处理列切换
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

  // 处理文件上传
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
        (t) => Array.isArray(t?.columns) && Array.isArray(t?.data)
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

  // 保存筛选后的数据为 JSON
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

  // 主渲染函数
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 工具栏 */}
      <Toolbar sx={{ justifyContent: 'space-between', mb: 3 }}>
        <Button
          variant="contained"
          component="label"
          startIcon={<Upload />}
          sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
        >
          上传 SQLite 文件
          <input type="file" hidden accept=".sqlite3" onChange={handleUpload} />
        </Button>
        <Button
          variant="contained"
          onClick={saveFilteredDataAsJSON}
          sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
        >
          保存筛选数据为 JSON
        </Button>
      </Toolbar>

      {/* 加载和错误提示 */}
      {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 图表区域 */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <CardContent>
          <ReactECharts option={chartOption} style={{ height: '500px' }} />
        </CardContent>
      </Card>

      {/* 数据表格 */}
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
          <Card
            key={table.name}
            sx={{ mb: 3, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {table.name}
              </Typography>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', mb: 2 }}>
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

      {/* Prompt 输入区域 */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
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
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleChatAnalysis}
            disabled={loading}
            sx={{ borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            {loading ? <CircularProgress size={24} /> : '开始智能分析'}
          </Button>
        </CardContent>
      </Card>

      {/* API 响应区域 */}
      {apiResponse && (
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            maxHeight: '500px',
            overflow: 'auto',
          }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              分析结果
            </Typography>
            <div style={{ fontFamily: 'monospace' }}>
              {apiResponse.split(/(\<think\>[\s\S]*?\<\/think\>)/g).map((part, index) => {
                if (part.match(/\<think\>[\s\S]*?\<\/think\>/)) {
                  return (
                    <div
                      key={index}
                      style={{
                        backgroundColor: '#f5f5f5',
                        padding: '12px',
                        borderRadius: '4px',
                        margin: '12px 0',
                        fontStyle: 'italic',
                        color: '#666',
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
  );
}