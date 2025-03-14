export const handleStreamResponse = async (reader, decoder, callbacks) => {
  const {
    onThinkContent,
    onDisplayContent,
    onComplete,
    onError,
  } = callbacks;

  let buffer = '';
  let isInThinkTag = false;
  let thinkContent = '';
  let displayContent = '';
  let sentence = '';

  const flushSentence = () => {
    if (sentence.trim()) {
      if (isInThinkTag) {
        thinkContent += sentence;
        onThinkContent?.(thinkContent);
      } else {
        displayContent += sentence;
        onDisplayContent?.(displayContent);
      }
      sentence = '';
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        flushSentence();
        onComplete?.();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          flushSentence();
          onComplete?.();
          return;
        }

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content || '';
          if (!content) continue;

          let i = 0;
          while (i < content.length) {
            if (content.slice(i).startsWith('<think>')) {
              flushSentence();
              isInThinkTag = true;
              i += 6;
              continue;
            }
            
            if (content.slice(i).startsWith('</think>')) {
              flushSentence();
              isInThinkTag = false;
              i += 7;
              continue;
            }

            sentence += content[i];
            if ('.。!！?？\n'.includes(content[i]) || i === content.length - 1) {
              flushSentence();
            }
            i++;
          }
        } catch (e) {
          console.error('解析消息失败:', e);
          onError?.(`解析消息失败: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.error('处理流失败:', e);
    onError?.(`处理流失败: ${e.message}`);
  }
};

export const sendMessageToAPI = async (messages, apiConfig) => {
  const payload = {
    model: apiConfig.model,
    messages: messages,
    stream: true,
  };

  const response = await fetch(apiConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.statusText}`);
  }

  return response;
};