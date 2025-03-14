import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, Box, Collapse, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { Image } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import html2canvas from 'html2canvas';

const ChatMessage = ({ message, isUser, thinkContent = '', isThinking = false, showAlert }) => {
  const [expanded, setExpanded] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const messageRef = useRef(null);
  
  // 监听思考状态的变化，只在思考完成时自动折叠
  useEffect(() => {
    // 如果思考完成，则折叠
    if (!isThinking && thinkContent) {
      setExpanded(false);
    }
    // 如果开始思考，则展开
    if (isThinking) {
      setExpanded(true);
    }
  }, [isThinking, thinkContent]);
  
  const handleSaveAsImage = () => {
    if (!messageRef.current) return;

    const paperElement = messageRef.current;
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
      console.error('Error saving message as image:', error);
      setIsCapturing(false);
    });
  };

  const handleDownloadImage = () => {
    if (!imageDataUrl) return;
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `message_${new Date().toISOString().slice(0, 10)}.png`;
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
      showAlert('复制成功', 'success');  // 使用传入的 showAlert
    } catch (error) {
      console.error('复制失败:', error);
      showAlert('复制失败，请重试');     // 使用传入的 showAlert
    }
  };

  // 如果是用户消息，直接返回原始消息
  if (isUser) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          mb: 2,
        }}
      >
        <Paper
          elevation={1}
          sx={{
            p: 2,
            maxWidth: '80%',
            borderRadius: '12px',
            backgroundColor: '#6abf4b',
            color: '#fff',
            borderTopRightRadius: 0,
            borderTopLeftRadius: '12px',
          }}
        >
          <Typography>{message}</Typography>
        </Paper>
      </Box>
    );
  }
  
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-start',
        mb: 2,
      }}
    >
      <Paper
        ref={messageRef}
        elevation={1}
        sx={{
          p: 2,
          maxWidth: '80%',
          borderRadius: '12px',
          backgroundColor: '#2a2a2a',
          color: '#fff',
          borderTopRightRadius: '12px',
          borderTopLeftRadius: 0,
        }}
      >
        {/* 思考过程部分 */}
        {thinkContent && (
          <Box sx={{ mb: message ? 2 : 0, borderBottom: message ? '1px solid rgba(255,255,255,0.1)' : 'none', pb: 1 }}>
            {!isThinking && (
              <Button
                onClick={() => setExpanded(!expanded)}
                startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                size="small"
                sx={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  mb: 1
                }}
              >
                {expanded ? '收起思考过程' : '展开思考过程'}
              </Button>
            )}
            
            <Collapse in={expanded} timeout="auto">
              <Box 
                sx={{ 
                  backgroundColor: 'rgba(0,0,0,0.2)', 
                  p: 1.5, 
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: 'rgba(255,255,255,0.8)'
                }}
              >
                {isThinking && (
                  <Typography
                    variant="caption"
                    sx={{ 
                      color: 'rgba(255,255,255,0.5)',
                      display: 'block',
                      mb: 1,
                      fontStyle: 'italic'
                    }}
                  >
                    思考中...
                  </Typography>
                )}
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
                  {thinkContent}
                </ReactMarkdown>
              </Box>
            </Collapse>
          </Box>
        )}
        
        {/* 消息内容部分 */}
        {message && (
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
            {message}
          </ReactMarkdown>
        )}
        
        {/* 添加截图按钮 */}
        {!isUser && message && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="text"
              size="small"
              startIcon={<Image />}
              onClick={handleSaveAsImage}
              disabled={isCapturing}
              sx={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {isCapturing ? '截图中...' : '保存为图片'}
            </Button>
          </Box>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>保存消息</DialogTitle>
        <DialogContent>
          <img src={imageDataUrl} alt="消息截图" style={{ maxWidth: '100%', marginBottom: '16px' }} />
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
    </Box>
  );
};

export default ChatMessage;