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
  Collapse,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  CircularProgress,
  Alert
} from '@mui/material';
import { Upload, ExpandMore, ExpandLess } from '@mui/icons-material';
import axios from 'axios';
import * as XLSX from 'xlsx';

const TablePagination = ({ tableName, dataLength, pageState, onPageChange }) => {
  return (
    <Pagination
      count={Math.ceil(dataLength / (pageState?.rowsPerPage || 10))}
      page={pageState?.currentPage || 1}
      onChange={(_, value) => onPageChange(tableName, value)}
      sx={{ padding: '20px 0' }}
    />
  );
};

const DataTable = ({ columns, data }) => {
  return (
    <Table>
      <colgroup>
        <col style={{ width: '60%' }} />
        <col style={{ width: '40%' }} />
      </colgroup>
      <TableHead>
        <TableRow>
          {columns.map((col) => (
            <TableCell key={col}>{col}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default function App() {
  const [tables, setTables] = useState([]);
  const [expandedTable, setExpandedTable] = useState(null);
  const [tableStates, setTableStates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = useCallback(async (e) => {
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

      const validTables = response.data.tables_metadata.filter(
        (t) => Array.isArray(t?.columns) && Array.isArray(t?.data)
      );

      if (validTables.length === 0) {
        throw new Error('未找到有效表格数据');
      }

      setTables(validTables);
      setTableStates(
        validTables.reduce((acc, table) => ({
          ...acc,
          [table.name]: {
            currentPage: 1,
            rowsPerPage: 10,
            sortColumn: '',
            selectedColumns: table.columns.slice(0, 2) // 默认选择前两列
          }
        }), {})
      );
    } catch (err) {
      console.error('数据加载失败:', err);
      setError(err.message);
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePageChange = useCallback((tableName, newPage) => {
    setTableStates((prev) => ({
      ...prev,
      [tableName]: {
        ...prev[tableName],
        currentPage: newPage
      }
    }));
  }, []);

  const handleExport = useCallback((tableName) => {
    if (!tableStates[tableName]?.selectedColumns?.length) {
      setError('请先选择要导出的列');
      return;
    }
    const table = tables.find((t) => t.name === tableName);
    if (!table) return;

    const state = tableStates[tableName];
    const selectedIndices = state.selectedColumns.map((col) => table.columns.indexOf(col));
    const sortedData = [...table.data].sort((a, b) => {
      const sortColIndex = table.columns.indexOf(state.sortColumn);
      if (sortColIndex === -1) return 0;
      return String(a[sortColIndex] || '').localeCompare(String(b[sortColIndex] || ''));
    });

    try {
      const ws = XLSX.utils.aoa_to_sheet([
        state.selectedColumns,
        ...sortedData.map((row) => selectedIndices.map((i) => row[i]))
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 31));
      XLSX.writeFile(wb, `${tableName}_导出_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('导出失败:', err);
      setError('Excel文件生成失败');
    }
  }, [tables, tableStates]);

  const renderTableContent = (table) => {
    const state = tableStates[table.name] || {};
    const sortedData = [...table.data].sort((a, b) => {
      const sortColIndex = table.columns.indexOf(state.sortColumn);
      return sortColIndex >= 0
        ? String(a[sortColIndex] || '').localeCompare(String(b[sortColIndex] || ''))
        : 0;
    });

    const startIndex = (state.currentPage - 1) * state.rowsPerPage;
    const pageData = sortedData.slice(startIndex, startIndex + state.rowsPerPage);

    return (
      <>
        <FormControl fullWidth margin="normal">
          <InputLabel>选择导出的列</InputLabel>
          <Select
            multiple
            value={state.selectedColumns}
            onChange={(e) => setTableStates((prev) => ({
              ...prev,
              [table.name]: { ...prev[table.name], selectedColumns: e.target.value }
            }))}
          >
            {table.columns.map((col) => (
              <MenuItem key={col} value={col}>{col}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          onClick={() => handleExport(table.name)}
          sx={{ mt: 2, mb: 2 }}
          startIcon={<Upload />}
        >
          导出表格数据
        </Button>

        <FormControl fullWidth margin="normal">
          <InputLabel>选择排序列</InputLabel>
          <Select
            value={state.sortColumn}
            onChange={(e) => setTableStates((prev) => ({
              ...prev,
              [table.name]: { ...prev[table.name], sortColumn: e.target.value }
            }))}
          >
            {table.columns.map((col) => (
              <MenuItem key={col} value={col}>{col}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TablePagination
          tableName={table.name}
          dataLength={sortedData.length}
          pageState={state}
          onPageChange={handlePageChange}
        />

        <TableContainer component={Paper}>
          <DataTable columns={table.columns} data={pageData} />
        </TableContainer>

        <TablePagination
          tableName={table.name}
          dataLength={sortedData.length}
          pageState={state}
          onPageChange={handlePageChange}
        />
      </>
    );
  };

  return (
    <div style={{ padding: '2rem' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <CircularProgress sx={{ display: 'block', margin: '2rem auto' }} />
      ) : (
        <>
          <input
            accept=".sqlite3"
            style={{ display: 'none' }}
            id="upload-file"
            type="file"
            onChange={handleUpload}
          />
          <label htmlFor="upload-file">
            <Button variant="contained" component="span" startIcon={<Upload />}>
              上传 SQLite 文件
            </Button>
          </label>

          {tables.map((table) => (
            <Paper key={table.name} sx={{ mt: 2, p: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2>{table.name}</h2>
                <IconButton
                  onClick={() => setExpandedTable(
                    expandedTable === table.name ? null : table.name
                  )}
                >
                  {expandedTable === table.name ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </div>

              <Collapse in={expandedTable === table.name}>
                {renderTableContent(table)}
              </Collapse>
            </Paper>
          ))}
        </>
      )}
    </div>
  );
}