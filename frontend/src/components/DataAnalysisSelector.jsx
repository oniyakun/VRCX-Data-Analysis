import React from 'react';
import {
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Paper,
  Tooltip,
} from '@mui/material';

const DataAnalysisSelector = ({ includeAnalysisData, setIncludeAnalysisData }) => {
  return (
    <Paper
      elevation={1}
      sx={{
        p: 1.5,
        backgroundColor: '#2a2a2a',
        borderRadius: '12px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip title="选中后将把数据分析页面中已筛选的数据一并发送给AI进行分析">
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
                  padding: '4px',
                }}
                size="small"
              />
            }
            label={
              <Typography sx={{ color: '#fff', fontSize: '0.9rem' }}>
                包含数据分析页面的筛选数据
              </Typography>
            }
            sx={{ margin: 0 }}
          />
        </Tooltip>
      </Box>
      {includeAnalysisData && (
        <Typography
          variant="body2"
          sx={{
            mt: 0.5,
            color: 'rgba(255,255,255,0.7)',
            backgroundColor: 'rgba(106,191,75,0.1)',
            p: 0.75,
            borderRadius: '6px',
            fontSize: '0.8rem',
          }}
        >
          注意：将会把数据分析页面中已筛选的数据一并发送给AI
        </Typography>
      )}
    </Paper>
  );
};

export default DataAnalysisSelector;