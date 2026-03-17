import { useEffect, useState } from "react";
import { ApiService } from "../services/ApiService";
import { getAnonymousId } from "../utils/anonymous";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const anonymousId = getAnonymousId();

  useEffect(() => {
    ApiService.initApiKey();
    const loadHistory = async () => {
      try {
        const history = await ApiService.getChatHistory(anonymousId);
        setMessages(history.messages || []);
      } catch (err) {
        console.error(err);
      }
    };

    loadHistory();
  }, []);

  // Auto-poll lịch sử chat để nhận tin nhắn mới từ nhân viên/bot
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const history = await ApiService.getChatHistory(anonymousId);
        setMessages(history.messages || []);
      } catch (err) {
        console.error(err);
      }
    }, 3000); // 3s/lần

    return () => clearInterval(interval);
  }, [anonymousId]);

  const handleSend = async (text) => {
    const newMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, newMessage]);

    try {
      const response = await ApiService.sendMessage(text, anonymousId);
      const botContent =
        response.answer || response.response || JSON.stringify(response);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: botContent }
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <MessageBubble key={index} message={msg} />
        ))}
      </div>

      <ChatInput onSend={handleSend} />
    </div>
  );
};

export default ChatWindow;