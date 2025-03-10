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
  Autocomplete,
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
  const [filters, setFilters] = useState({}); // 结构变为 { [tableName]: { [column]: string[] } }
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
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              size="small"
              sx={{ width: 180 }}
              onChange={(_, value) => setFilters(prev => ({
                ...prev,
                [table.name]: {
                  ...prev[table.name],
                  [col]: value
                }
              }))}
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

  // 修改后的applyFilters实现多表联合筛选
  const applyFilters = useCallback(() => {
    const filtered = tables.flatMap(table => {
      const tableFilters = filters[table.name] || {};
      return table.data.filter(row => 
        table.columns.every(col => {
          const filterValues = (filters[table.name]?.[col] || []);
          return filterValues.length === 0 || 
            filterValues.some(f => 
              String(row[table.columns.indexOf(col)]).toLowerCase().includes(String(f).toLowerCase())
            );
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
    
    // 清除已隐藏列的筛选值，同时不影响其他列的筛选状态
    setFilters(prev => {
      const newFilters = { ...prev };
      if (newFilters[tableName]) {
        delete newFilters[tableName][column];
      }
      return newFilters;
    });
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
        const filterValues = (filters[table.name]?.[col] || []);
        return filterValues.length === 0 || 
          filterValues.some(f => 
            String(row[table.columns.indexOf(col)]).toLowerCase().includes(String(f).toLowerCase())
          );
      })
    );

    // 新增排序逻辑：按当前筛选列内容分组排序
    const activeFilters = Object.keys(filters[table.name] || {});
    if (activeFilters.length > 0) {
      filteredData.sort((a, b) => {
        for (const col of activeFilters) {
          const aVal = String(a[table.columns.indexOf(col)]).toLowerCase();
          const bVal = String(b[table.columns.indexOf(col)]).toLowerCase();
          const compareResult = aVal.localeCompare(bVal);
          if (compareResult !== 0) return compareResult;
        }
        return 0;
      });
    }
  
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

  const saveFilteredDataAsJSON = useCallback(() => {
    // 重新计算筛选后的数据
    const updatedFilters = filters;
    tables.forEach(table => {
      const state = pagination[table.name] || {};
      const visibleColumns = table.columns.filter(col => !!selectedColumns[table.name]?.[col]);
      if (visibleColumns.length === 0) return; // 只处理有选中列的表
      const filteredData = table.data.filter(row => 
        visibleColumns.every(col => {
          const filterValues = (updatedFilters[table.name]?.[col] || []);
          return filterValues.length === 0 || 
            filterValues.some(f => 
              String(row[table.columns.indexOf(col)]).toLowerCase().includes(String(f).toLowerCase())
            );
        })
      );
      const startIndex = (state.page - 1) * state.rowsPerPage;
      const paginatedData = filteredData; // 保存所有筛选后的数据
      // 按第一列排序
      paginatedData.sort((a, b) => {
        const firstColumnIndex = table.columns.indexOf(visibleColumns[0]);
        return String(a[firstColumnIndex]).localeCompare(String(b[firstColumnIndex]));
      });
      const selectedData = paginatedData.map(row => {
        return visibleColumns.reduce((acc, col) => {
          const colIndex = table.columns.indexOf(col);
          acc[col] = row[colIndex];
          return acc;
        }, {});
      });
      const jsonData = JSON.stringify(selectedData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${table.name}_filtered.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [tables, filters, pagination, selectedColumns]);

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
      <Button
        variant="contained"
        onClick={saveFilteredDataAsJSON}
        sx={{ marginBottom: '20px', marginLeft: '20px' }}
      >
        保存筛选数据为JSON
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