import React, { useState, useEffect } from 'react';
import { Modal, Box, Typography, TextField, Button } from '@mui/material';

const SettingsModal = ({ open, onClose, onSave, initialConfig }) => {
  // State for input fields
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');

  // Populate fields with initialConfig when it changes or modal opens
  useEffect(() => {
    if (initialConfig) {
      setEndpoint(initialConfig.endpoint || '');
      setApiKey(initialConfig.apiKey || '');
      setModel(initialConfig.model || '');
    }
  }, [initialConfig]);

  // Handle save action
  const handleSave = () => {
    const newConfig = { endpoint, apiKey, model };
    onSave(newConfig);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          API 设置
        </Typography>
        <TextField
          label="API Endpoint"
          fullWidth
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          label="API Key"
          type="password" // Mask the API key
          fullWidth
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          label="模型选择"
          fullWidth
          value={model}
          onChange={(e) => setModel(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button variant="contained" onClick={handleSave}>
          保存
        </Button>
      </Box>
    </Modal>
  );
};

export default SettingsModal;