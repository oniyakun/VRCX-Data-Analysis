import React, { useState, useMemo, memo } from 'react';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Collapse, IconButton, Select, MenuItem, FormControl, InputLabel, Pagination } from '@mui/material';
import { Upload, ExpandMore, ExpandLess } from '@mui/icons-material';
import axios from 'axios';
import * as XLSX from 'xlsx';

function App() {
  const [tables, setTables] = useState([]);
  const [expandedTable, setExpandedTable] = useState(null);
  const [tableStates, setTableStates] = useState({});
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post('http://localhost:5000/upload', formData);
      
      console.log('后端返回数据:', response.data);
      
      if (response.data.tables_metadata?.length > 0) {
        console.log('第一个表数据结构:', response.data.tables_metadata[0]);
        setTables(response.data.tables_metadata);
        setTableStates(response.data.tables_metadata.reduce((acc, table) => ({
          ...acc,
          [table.name]: {
            currentPage: 1,
            rowsPerPage: 10,
            sortColumn: '',
            selectedColumns: []
          }
        }), {}));
      } else {
        setTables([]);
      }
    } catch (error) {
      console.error('上传失败:', error);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (tableName, newPage) => {
    setTableStates(prev => ({
      ...prev,
      [tableName]: {
        ...prev[tableName],
        currentPage: newPage
      }
    }));
  };

  const handleExport = (tableName) => {
    const table = tables.find(t => t.name === tableName);
    const state = tableStates[tableName];
    
    // 处理非法字符并截断名称
    const sanitizedName = tableName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 24);
    const hashSuffix = Math.random().toString(36).substring(2, 6).padEnd(4, '0');
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const sheetName = `${sanitizedName}_${hashSuffix}`.slice(0, 31);
    const fileName = `${sanitizedName}_导出_${timestamp}.xlsx`;
  
    // 获取选中列索引
    const selectedIndices = state.selectedColumns.map(col => table.columns.indexOf(col));
    
    // 处理全部数据（非分页数据）
    // 应用排序规则
const sortedData = [...table.data].sort((a, b) => {
  const sortColIndex = table.columns.indexOf(state.sortColumn);
  console.log('[调试] 排序列:', state.sortColumn, '可用列:', table.columns, '匹配索引:', sortColIndex);
  
  if (sortColIndex === -1) {
    console.log('[警告] 未找到匹配的排序列索引');
    return 0;
  }
  
  const valA = String(a[sortColIndex] || '');
  const valB = String(b[sortColIndex] || '');
  console.log(`[比较] '${valA}' vs '${valB}' => ${valA.localeCompare(valB)}`);
  
  return valA.localeCompare(valB) || 0;
});

const exportData = sortedData.map(row => 
  selectedIndices.map(i => row[i])
);
    
    // 创建工作表
    const ws = XLSX.utils.aoa_to_sheet([
      state.selectedColumns, // 表头
      ...exportData          // 数据
    ]);
    
    // 创建工作簿并下载
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div style={{ padding: '2rem' }}>
      {loading && 
        <div style={{ margin: '1rem 0', padding: '1rem', background: '#f0f0f0' }}>
          正在加载数据...
        </div>}

      {!loading && tables.length === 0 && 
        <div style={{ margin: '1rem 0', padding: '1rem', background: '#fff3cd' }}>
          暂无数据，请先上传SQLite文件
        </div>}
      <input
        accept=".sqlite3"
        style={{ display: 'none' }}
        id="upload-file"
        type="file"
        onChange={handleUpload}
      />
      <label htmlFor="upload-file">
        <Button
          variant="contained"
          component="span"
          startIcon={<Upload />}
        >
          上传 SQLite 文件
        </Button>
      </label>

      {tables.map((table) => (
        <Paper key={table.name} style={{ marginTop: '1rem', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h2>{table.name}</h2>
            <IconButton
              onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
            >
              {expandedTable === table.name ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </div>

          <Collapse in={expandedTable === table.name}>
            <FormControl fullWidth style={{ margin: '1rem 0' }}>
              <InputLabel>选择排序列</InputLabel>
              <Select
                value={tableStates[table.name]?.sortColumn || ''}
                onChange={(e) => setTableStates(prev => ({
                  ...prev,
                  [table.name]: {
                    ...prev[table.name],
                    sortColumn: e.target.value
                  }
                }))}
                label="选择排序列"
              >
                {table.columns.map((col) => (
                  <MenuItem key={col} value={col}>{col}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth style={{ marginBottom: '1rem' }}>
              <InputLabel>选择导出列</InputLabel>
              <Select
                multiple
                value={tableStates[table.name]?.selectedColumns || []}
                onChange={(e) => setTableStates(prev => ({
                  ...prev,
                  [table.name]: {
                    ...prev[table.name],
                    selectedColumns: e.target.value
                  }
                }))}
                label="选择导出列"
                renderValue={(selected) => selected.join(', ')}
              >
                {table.columns.map((col) => (
                  <MenuItem key={col} value={col}>{col}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              onClick={() => handleExport(table.name)}
              disabled={!tableStates[table.name]?.selectedColumns?.length}
              style={{ marginBottom: '1rem' }}
            >
              导出为 Excel
            </Button>

            <TableContainer component={Paper}>
              <Table>
                <colgroup>
                  <col style={{ width: '60%' }} />
                  <col style={{ width: '40%' }} />
                </colgroup>
                <TableHead>
                  <TableRow>
                    {table.columns.map((col) => (
                      <TableCell key={col}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    let sortedData = table.data.slice();
                    const columnIndex = table.columns.indexOf(tableStates[table.name]?.sortColumn || '');
                    
                    if (columnIndex >= 0) {
                      // 创建分组索引优化排序性能
                      const valueMap = new Map();
                      table.data.forEach((row, index) => {
                        const key = String(row[columnIndex] ?? '');
                        if (!valueMap.has(key)) {
                          valueMap.set(key, []);
                        }
                        valueMap.get(key).push(index);
                      });

                      // 按分组顺序生成新数组
                      const sortedIndexes = [...valueMap.entries()]
                        .sort(([a], [b]) => a.localeCompare(b, 'zh', {
                          numeric: true,
                          sensitivity: 'base'
                        }))
                        .flatMap(([_, indexes]) => indexes);

                      sortedData = sortedIndexes.map((i) => table.data[i]);
                    }

                    const slicedData = sortedData
                      .slice(
                        (tableStates[table.name]?.currentPage - 1) * (tableStates[table.name]?.rowsPerPage || 10),
                        (tableStates[table.name]?.currentPage || 1) * (tableStates[table.name]?.rowsPerPage || 10)
                      );

                    console.log('当前页数据:', {
                      page: tableStates[table.name]?.currentPage,
                      pageSize: tableStates[table.name]?.rowsPerPage,
                      total: sortedData.length,
                      firstItem: slicedData[0],
                      lastItem: slicedData[slicedData.length-1]
                    });
    
                    console.log('当前分页参数:', {
                      table: table.name,
                      currentPage: tableStates[table.name]?.currentPage,
                      rowsPerPage: tableStates[table.name]?.rowsPerPage,
                      slicedLength: slicedData.length
                    });
                    return (
                      <>
                        <Pagination
                          count={Math.ceil(table.data.length / (tableStates[table.name]?.rowsPerPage || 10))}
                          page={tableStates[table.name]?.currentPage || 1}
                          onChange={(e, value) => handlePageChange(table.name, value)}
                          sx={{ padding: '20px 0' }}
                        />
                        {(() => {
                        // 虚拟滚动优化
                        const visibleItems = 20;
                        const start = Math.max(0, (tableStates[table.name]?.currentPage - 1) * visibleItems);
                        return slicedData
                          .slice(start, start + visibleItems)
                          .map((row, i) => (
                            <TableRow key={`${start + i}`}>
                              {row.map((cell, j) => (
                                <MemoCell key={j} content={cell} />
                              ))}
                            </TableRow>
                          ));
                      })()}
                        <Pagination
                          count={Math.ceil(table.data.length / (tableStates[table.name]?.rowsPerPage || 10))}
                          page={tableStates[table.name]?.currentPage || 1}
                          onChange={(e, value) => handlePageChange(table.name, value)}
                          sx={{ padding: '20px 0' }}
                        />
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
              <Pagination
                count={Math.ceil(table.data.length / (tableStates[table.name]?.rowsPerPage || 10))}
                page={tableStates[table.name]?.currentPage || 1}
                onChange={(event, value) => handlePageChange(table.name, value)}
                color="primary"
              />
            </div>
          </Collapse>
        </Paper>
      ))}
    </div>
  );
}

const MemoCell = memo(({ content }) => (
  <TableCell>{content}</TableCell>
));

export default App;