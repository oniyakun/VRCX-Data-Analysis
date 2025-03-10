import React, { useState, useCallback } from 'react';
import {
  Button,
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
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl
} from '@mui/material';
import { Upload } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';

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
    textStyle: {
      color: '#999',
      fontSize: 16
    }
  },
  xAxis: { show: false },
  yAxis: { show: false }
});
  const navigate = useNavigate();

  const handleUpload = useCallback(async (e) => {
    // 后续补充筛选逻辑和可视化组件
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post('http://localhost:5000/upload', formData);

      if (!response.data?.tables_metadata) {
        throw new Error('无效的响应格式');
      }

      if (!Array.isArray(response.data.tables_metadata)) {
        throw new Error('无效的表格元数据格式');
      }

      const initialState = response.data.tables_metadata.reduce((acc, table) => ({
        ...acc,
        [table.name]: {
          page: 1,
          rowsPerPage: 10,
          filters: {}
        }
      }), {});

      const columnsState = response.data.tables_metadata.reduce((acc, table) => ({
        ...acc,
        [table.name]: table.columns.reduce((cols, col) => ({
          ...cols,
          [col]: false
        }), {})
      }), {});

      setTables(response.data.tables_metadata);
      setPagination(initialState);
      setSelectedColumns(columnsState);
    } catch (err) {
      console.error('文件解析失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const [combinedData, setCombinedData] = useState([]);

  // 添加字段筛选输入框到表格头部
  const renderTableHeader = (table, visibleColumns) => (
    <TableHead>
      <TableRow>
        {visibleColumns.map(col => (
          <TableCell key={col}>
            <TextField
              size="small"
              label="筛选"
              variant="outlined"
              onChange={(e) => setFilters(prev => ({
                ...prev,
                [table.name]: {
                  ...prev[table.name],
                  [col]: e.target.value
                }
              }))}
              sx={{ width: 120 }}
            />
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );

  // 修改后的applyFilters实现多表联合筛选
  const applyFilters = useCallback(() => {
    const filtered = tables.flatMap(table => {
      const tableFilters = filters[table.name] || {};
      return table.data.filter(row => 
        table.columns.every((col, index) => {
          const filterValue = (tableFilters[col] || '').toLowerCase();
          return !filterValue || String(row[index]).toLowerCase().includes(filterValue);
        })
      );
    });
    
    setCombinedData(filtered);
    updateChart(filtered);
  }, [tables, filters]);
  
  

  const handleColumnToggle = (tableName, column) => {
    setSelectedColumns(prev => ({
      ...prev,
      [tableName]: {
        ...prev[tableName],
        [column]: !(prev[tableName]?.[column] ?? false)
      }
    }));
    
    // 清除已隐藏列的筛选值
    setFilters(prev => ({
      ...prev,
      [tableName]: Object.fromEntries(
        Object.entries(prev[tableName] || {})
          .filter(([col]) => prev[tableName]?.[col])
      )
    }));
    console.log('Column toggle:', tableName, column, {
      ...selectedColumns,
      [tableName]: {
        ...selectedColumns[tableName],
        [column]: !selectedColumns[tableName]?.[column]
      }
    });
  };
      
  

  
  
  // 该初始化逻辑已迁移至handleUpload回调中
  
  // 更新列选择Checkbox绑定逻辑
  {/* 原错误位置的visibleColumns已迁移至renderTable函数内部 */}
  
  const renderTable = (table) => {
    const state = pagination[table.name] || {};
    const visibleColumns = table.columns.filter(col => !!selectedColumns[table.name]?.[col]);

    // 删除错误位置的visibleColumns遍历逻辑

    const filteredData = table.data.filter(row => 
      visibleColumns.every(col => {
        const colIndex = table.columns.indexOf(col);
        const filterValue = (filters[table.name]?.[col] || '').toLowerCase();
        return !filterValue || String(row[colIndex]).toLowerCase().includes(filterValue);
      })
    );
  
    const startIndex = (state.page - 1) * state.rowsPerPage;
    const paginatedData = filteredData.slice(startIndex, startIndex + state.rowsPerPage);
  
    return (
      <div key={table.name} style={{ marginBottom: '40px' }}>
        <h3>{table.name}</h3>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          {table.columns.map(col => (
            <FormControlLabel
              key={col}
              control={
                <Checkbox
                  checked={!!selectedColumns[table.name]?.[col]}
                  onChange={() => handleColumnToggle(table.name, col)}
                />
              }
              label={col}
            />
          ))}
        </div>

        <TableContainer component={Paper}>
          <Table>
            {renderTableHeader(table, visibleColumns)}
            <TableBody>
              {paginatedData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {visibleColumns.map(col => {
                    const colIndex = table.columns.indexOf(col);
                    return (
                      <TableCell key={colIndex}>
                        {String(row[colIndex])}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
  
        <Pagination
          count={Math.ceil(filteredData.length / state.rowsPerPage)}
          page={state.page}
          onChange={(_, page) => handlePageChange(table.name, page)}
          sx={{ mt: 2 }}
        />
      </div>
    );
  };

const handlePageChange = (tableName, newPage) => {
  setPagination(prev => ({
    ...prev,
    [tableName]: {
      ...prev[tableName],
      page: newPage
    }
  }));
};

  return (
    <div style={{ padding: '20px' }}>
      <h1>高级数据分析</h1>
      
      <Button
        variant="contained"
        component="label"
        startIcon={<Upload />}
        sx={{ marginBottom: '20px' }}
      >
        上传SQLite文件
        <input
          type="file"
          hidden
          accept=".sqlite3"
          onChange={handleUpload}
        />
      </Button>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <div style={{ 
          height: '500px',
          marginTop: '40px',
          border: '1px solid #eee',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <ReactECharts option={chartOption} style={{ height: '100%' }} />
        </div>
{tables.map(renderTable)}
    </div>
  );
}

const validateChartOption = (option) => {
  if (!option?.series || !option.xAxis) {
    return {
      title: {
        text: '数据加载中',
        subtext: '请稍候...',
        left: 'center',
        top: 'center'
      },
      xAxis: { show: false },
      yAxis: { show: false }
    };
  }
  return option;
};