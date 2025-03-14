import React from 'react';
import {
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Paper,
} from '@mui/material';

const DataAnalysisSelector = ({ includeAnalysisData, setIncludeAnalysisData }) => {
  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        mb: 2,
        backgroundColor: '#2a2a2a',
        borderRadius: '12px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeAnalysisData}
              onChange={(e) => setIncludeAnalysisData(e.target.checked)}
              sx={{
                color: '#6abf4b',
                '&.Mui-checked': {
                  color: '#6abf4b',
                },
              }}
            />
          }
          label={
            <Typography sx={{ color: '#fff' }}>
              包含数据分析页面的筛选数据
            </Typography>
          }
        />
      </Box>
      {includeAnalysisData && (
        <Typography
          variant="body2"
          sx={{
            mt: 1,
            color: 'rgba(255,255,255,0.7)',
            backgroundColor: 'rgba(106,191,75,0.1)',
            p: 1,
            borderRadius: '8px',
          }}
        >
          注意：选中此选项后，将会把数据分析页面中已筛选的数据一并发送给AI进行分析
        </Typography>
      )}
    </Paper>
  );
};

export default DataAnalysisSelector; 