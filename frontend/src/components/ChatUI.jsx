import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  IconButton,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  Snackbar,
  MenuItem
} from '@mui/material';
import { Send, Delete, Image, Stop } from '@mui/icons-material';
import ChatMessage from './ChatMessage';
import DataAnalysisSelector from './DataAnalysisSelector';
import { handleStreamResponse, sendMessageToAPI } from '../services/messageService';
import html2canvas from 'html2canvas';

const ChatUI = ({
  apiConfig,
  presetPrompts,
  selectedPreset,
  setSelectedPreset,
  chatHistory = [],
  setChatHistory,
  getMergedFilteredData,
  loading,
  setLoading,
  onError,
}) => {
  const [input, setInput] = useState('');
  const [includeAnalysisData, setIncludeAnalysisData] = useState(false);
  const messagesEndRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const chatContainerRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const readerRef = useRef(null);
  const [alertInfo, setAlertInfo] = useState({ open: false, message: '', severity: 'error' });

  // 滚动到最新消息
  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // 关闭提示信息
  const handleCloseAlert = () => {
    setAlertInfo({ ...alertInfo, open: false });
  };

  // 显示提示信息
  const showAlert = (message, severity = 'error') => {
    setAlertInfo({ open: true, message, severity });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // 添加消息事件监听器
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === 'showAlert') {
        showAlert(event.data.message, event.data.severity);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 发送消息
  const handleStopGeneration = async () => {
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
        setIsGenerating(false);
        setLoading(false);
      } catch (error) {
        console.error('停止生成失败:', error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    try {
      setLoading(true);
      setIsGenerating(true);

      // 构建消息内容（仅用于发送给 API）
      let messageContent = input;
      if (includeAnalysisData) {
        const analysisData = getMergedFilteredData();
        if (analysisData && Object.keys(analysisData).length > 0) {
          messageContent = `${input}\n\n以下是数据分析页面的筛选数据：\n${JSON.stringify(analysisData, null, 2)}`;
        } else {
          showAlert('未找到筛选数据，请先在数据分析页面进行数据筛选', 'warning');
          setLoading(false);
          setIsGenerating(false);
          return;
        }
      }

      // 添加用户消息到历史记录，使用实际输入内容
      setChatHistory(prev => [...prev, { content: input, isUser: true }]);
      setInput('');

      // 添加一个空的 AI 响应到历史记录
      const newMessageIndex = chatHistory.length;
      setChatHistory(prev => [...prev, { content: '', thinkContent: '', isUser: false }]);

      // 构建完整的对话历史（用于发送给 API）
      const messages = chatHistory.map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.isUser ? msg.content : 
          msg.thinkContent ? `${msg.content}\n<think>${msg.thinkContent}</think>` : msg.content
      }));
      messages.push({ role: 'user', content: messageContent });

      // 发送消息到 API
      const response = await sendMessageToAPI(messages, apiConfig);
      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();

      // 处理流式响应
      await handleStreamResponse(reader, decoder, {
        onThinkContent: (content) => {
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory[newMessageIndex + 1]) {
              newHistory[newMessageIndex + 1].thinkContent = content;
              newHistory[newMessageIndex + 1].isThinking = true;
            }
            return newHistory;
          });
        },
        onDisplayContent: (content) => {
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory[newMessageIndex + 1]) {
              newHistory[newMessageIndex + 1].content = content;
            }
            return newHistory;
          });
        },
        onComplete: () => {
          setChatHistory(prev => {
            const newHistory = [...prev];
            if (newHistory[newMessageIndex + 1]) {
              newHistory[newMessageIndex + 1].isThinking = false;
            }
            return newHistory;
          });
        },
        onError: (error) => {
          showAlert(`错误: ${error}`, 'error');
          onError(error);
          setChatHistory(prev => [...prev, { content: `错误: ${error}`, isUser: false }]);
        },
      });
    } catch (error) {
      onError(`发送消息失败: ${error.message}`);
      setChatHistory(prev => [...prev, { content: `错误: ${error.message}`, isUser: false }]);
    } finally {
      setLoading(false);
      setIsGenerating(false);
      readerRef.current = null;
      setIncludeAnalysisData(false); // 每次发送消息后取消勾选
    }
  };

  // 清空聊天历史
  const clearChat = () => {
    setChatHistory([]);
  };

  const handleSaveAsImage = () => {
    // 获取最后一条AI消息
    const lastAiMessage = chatHistory.filter(msg => !msg.isUser).pop();
    if (!lastAiMessage) {
      showAlert('没有找到AI回复内容');
      return;
    }

    // 获取最后一条消息的DOM元素
    const lastMessageElement = chatContainerRef.current.lastElementChild.previousElementSibling;
    if (!lastMessageElement) return;

    // 直接获取Paper元素（实际内容区域）
    const paperElement = lastMessageElement.querySelector('.MuiPaper-root');
    if (!paperElement) return;

    setIsCapturing(true);
    html2canvas(paperElement, {
      backgroundColor: '#2a2a2a',
      scale: 2,
      useCORS: true,
    }).then((canvas) => {
      const dataUrl = canvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);
      setDialogOpen(true);
      setIsCapturing(false);
    }).catch((error) => {
      console.error('Error saving chat as image:', error);
      setIsCapturing(false);
    });
  };

  const handleDownloadImage = () => {
    if (!imageDataUrl) return;
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `chat_${new Date().toISOString().slice(0, 10)}.png`;
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
      showAlert('复制成功', 'success');
    } catch (error) {
      console.error('复制失败:', error);
      showAlert('复制失败，请重试');
    }
  };

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '92vh',
          borderRadius: '16px',
          overflow: 'hidden', // 确保外层容器不显示滚动条
          backgroundColor: '#1e1e1e',
        }}
      >
        {/* 聊天头部 */}
        <Box
          sx={{
            p: '8px 16px',
            backgroundColor: '#2a2a2a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '48px',
          }}
        >
          <Typography variant="h6">聊天</Typography>
          <Box>
            <IconButton onClick={handleSaveAsImage} color="primary" title="保存为图片">
              <Image />
            </IconButton>
            <IconButton onClick={clearChat} color="error" title="清空聊天记录">
              <Delete />
            </IconButton>
          </Box>
        </Box>

        <Divider />

        {/* 聊天消息区域 */}
        <Box
          ref={chatContainerRef}
          sx={{
            p: 2,
            flex: '1 1 auto',
            backgroundColor: '#2c2c2c',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto', // 只保留一个overflow设置
            height: 0, // 设置height为0，让flex-grow接管高度计算
            flexGrow: 1, // 确保填充所有可用空间
          }}
        >
          {chatHistory.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999',
              }}
            >
              {loading ? '正在思考中...' : '开始新的对话'}
              <Typography variant="body2" sx={{ mt: 1 }}>
                {apiConfig.endpoint ? '已连接到API' : '请先设置API'}
              </Typography>
            </Box>
          ) : (
            chatHistory.map((msg, index) => (
              !msg.isAnalysisRequest && (
                <ChatMessage
                  key={`${index}-${msg.content.length}`}
                  message={msg.content}
                  thinkContent={msg.thinkContent}
                  isUser={msg.isUser}
                  isThinking={msg.isThinking}
                  showAlert={showAlert}  // 添加这一行
                />
              )
            ))
          )}
          <div ref={messagesEndRef} />
        </Box>

        <Divider />

        {/* 输入区域 */}
        <Box
          sx={{
            p: '12px 16px',
            backgroundColor: '#2a2a2a',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {/* 上部控制区：数据分析选择器和预设提示词选择器并排 */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {/* 数据分析选择器 - 调整为紧凑型 */}
            <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
              <DataAnalysisSelector
                includeAnalysisData={includeAnalysisData}
                setIncludeAnalysisData={setIncludeAnalysisData}
              />
            </Box>
            
            {/* 预设提示词选择 */}
            {presetPrompts && presetPrompts.length > 0 && (
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  select
                  label="预设提示词"
                  value={selectedPreset}
                  onChange={(e) => {
                    setSelectedPreset(e.target.value);
                    setInput(e.target.value);
                  }}
                  fullWidth
                  size="small"
                  SelectProps={{
                    MenuProps: {
                      PaperProps: {
                        sx: {
                          maxWidth: '50%',
                          width: 'auto',
                          maxHeight: 'none',
                          overflowY: 'visible',
                          '& .MuiMenuItem-root': {
                            whiteSpace: 'normal',
                            wordWrap: 'break-word',
                            padding: '8px 16px',
                            width: '100%',
                            // 移除maxHeight和overflowY设置，防止每个菜单项出现滚动条
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.08)'
                            }
                          }
                        }
                      }
                    }
                  }}
                >
                  {presetPrompts.map(option => (
                    <MenuItem 
                      key={option} 
                      value={option}
                    >
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            )}
          </Box>

          {/* 输入框和发送按钮 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="输入消息..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              multiline
              maxRows={5}
              minRows={2}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: '#333',
                  padding: '8px 12px',
                },
                '& .MuiInputBase-inputMultiline': {
                  lineHeight: '1.5',
                }
              }}
              disabled={loading}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={isGenerating ? handleStopGeneration : handleSendMessage}
                disabled={!input.trim() && !isGenerating}
                sx={{
                  minWidth: 0,
                  p: 0.75,
                  height: '40px',
                  width: '40px',
                  borderRadius: '10px',
                  '& .MuiSvgIcon-root': {
                    fontSize: '1.3rem',
                  },
                }}
              >
                {isGenerating ? <Stop /> : <Send />}
              </Button>
            </Box>
          </Box>
        </Box>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>保存对话</DialogTitle>
        <DialogContent>
          <img src={imageDataUrl} alt="对话截图" style={{ maxWidth: '100%', marginBottom: '16px' }} />
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button onClick={handleCopyToClipboard} variant="contained" color="primary">
              复制到剪贴板
            </Button>
            <Button onClick={handleDownloadImage} variant="contained" color="secondary">
              下载图片
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar 
        open={alertInfo.open} 
        autoHideDuration={6000} 
        onClose={handleCloseAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseAlert} 
          severity={alertInfo.severity} 
          sx={{ width: '100%' }}
        >
          {alertInfo.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ChatUI;