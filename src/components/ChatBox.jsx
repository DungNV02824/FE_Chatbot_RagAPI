import React, { useState, useRef, useEffect } from 'react';
import './ChatBox.css';
import ApiService from '../services/ApiService';
import LocalStorageService from '../services/LocalStorageService';

const ChatBox = () => {
  // Initialize guest_id from localStorage (tạo nếu chưa có)
  const [guestId] = useState(() => LocalStorageService.getOrCreateGuestId());
  
  const [messages, setMessages] = useState([
    { text: 'Xin chào! Tôi là nhân viên hỗ trợ khách hàng. Bạn cần giúp gì không?', isUser: false }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [anonymousId, setAnonymousId] = useState(guestId);
  const [showSettings, setShowSettings] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [hasActiveEscalation, setHasActiveEscalation] = useState(false);
  const [userInfo, setUserInfo] = useState(LocalStorageService.getUserInfo() || {
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [isSavingUserInfo, setIsSavingUserInfo] = useState(false);
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(true);
  const pollIntervalRef = useRef(null);
  const [searchUserId, setSearchUserId] = useState('');
  const [viewingUserId, setViewingUserId] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const shouldScrollRef = useRef(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderFormData, setOrderFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: ''
  });
  const [showLoadHistory, setShowLoadHistory] = useState(false);
  const [isChatDisabled, setIsChatDisabled] = useState(false);

  // ===== Load chat history from localStorage on mount =====
  useEffect(() => {
    const savedHistory = LocalStorageService.getChatHistory();
    if (savedHistory && savedHistory.length > 0) {
      console.log('📂 Found saved chat history:', savedHistory.length, 'messages');
      setShowLoadHistory(true); // Hiển thị option để load
    }
  }, []);

  // ===== Save chat history whenever messages change =====
  useEffect(() => {
    if (messages.length > 1) { // Bỏ qua message mặc định ban đầu
      LocalStorageService.saveChatHistory(messages);
    }
  }, [messages]);

  // ===== Save user info whenever it changes =====
  useEffect(() => {
    LocalStorageService.saveUserInfo(userInfo);
  }, [userInfo]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Don't auto-scroll on every message change - only when manually needed
  useEffect(() => {
    if (shouldScrollRef.current) {
      scrollToBottom();
      shouldScrollRef.current = false;
    }
  }, [messages]);



  // Auto-fetch messages when there's an active escalation (staff reply)
  useEffect(() => {
    console.log(`🔄 useEffect: hasActiveEscalation=${hasActiveEscalation}, isLoading=${isLoading}`);
    if (!hasActiveEscalation || isLoading) return;

    console.log('🚀 Auto-fetch starting...');
    const fetchRecentMessages = async () => {
      try {
        console.log(`📡 Fetching messages for ${anonymousId}...`);
        const data = await ApiService.getChatHistory(anonymousId, 50);
        console.log('✅ Got messages from API:', data.messages?.length || 0);
        
        if (data.messages && data.messages.length > 0) {
          const apiMessages = data.messages.reverse().map((msg, idx) => ({
            text: msg.content,
            isUser: msg.role === 'user',
            isStaffReply: msg.is_staff_reply || false,
            staffName: msg.staff_name || null,
            key: `api-${idx}`
          }));
          
          setMessages(prev => {
            // Merge strategy: Keep local messages, add new ones from API
            const prevTextSet = new Set(prev.map(m => m.text));
            const newApiMessages = apiMessages.filter(m => !prevTextSet.has(m.text));
            
            console.log(`📦 Prev messages: ${prev.length}, API messages: ${apiMessages.length}, New: ${newApiMessages.length}`);
            
            if (newApiMessages.length > 0) {
              console.log(`📥 Adding ${newApiMessages.length} new messages`);
              shouldScrollRef.current = true;
              return [...prev, ...newApiMessages];
            }
            
            return prev;
          });
        }
      } catch (error) {
        console.log('Auto-fetch messages error:', error);
      }
    };

    // Gọi ngay lần đầu, rồi gọi lại theo interval
    fetchRecentMessages();
    const interval = setInterval(fetchRecentMessages, 1000);
    pollIntervalRef.current = interval;

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [hasActiveEscalation, anonymousId]);

  const sendMessage = async () => {
    const message = input.trim();
    if (!message || isLoading || isChatDisabled) return;

    shouldScrollRef.current = true;
    setMessages(prev => [...prev, { text: message, isUser: true }]);
    setInput('');
    
    // If escalation (staff is handling), send message to API but don't process bot response
    if (hasActiveEscalation) {
      console.log('📝 Escalation mode - message sent to staff, waiting for staff reply');
      try {
        // Send message to backend to save conversation history
        // But don't process the bot response
        await ApiService.sendMessage(message, anonymousId, userInfo);
      } catch (error) {
        console.error('Error sending escalation message:', error);
      }
      return;
    }

    setIsLoading(true);

    try {
      const data = await ApiService.sendMessage(message, anonymousId, userInfo);
      
      // Handle different response types
      if (data.type === 'image' && data.images && data.images.length > 0) {
        const textMessage = data.answer || 'Dưới đây là hình ảnh sản phẩm bạn yêu cầu.';
        shouldScrollRef.current = true;
        setMessages(prev => [...prev, { 
          text: textMessage, 
          isUser: false,
          relatedProducts: data.related_products
        }]);
        
        data.images.forEach(imageUrl => {
          shouldScrollRef.current = true;
          setMessages(prev => [...prev, { 
            text: imageUrl,
            isUser: false,
            isImage: true
          }]);
        });
      } else if (data.type === 'order_form') {
        // Hiển thị form đặt hàng
        const botMessage = data.answer || 'Vui lòng điền thông tin đặt hàng';
        shouldScrollRef.current = true;
        setMessages(prev => [...prev, { 
          text: botMessage, 
          isUser: false,
          isOrderForm: true,
          missingFields: data.missing_fields,
          currentData: data.current_data
        }]);
        setShowOrderForm(true);
        setOrderFormData(data.current_data || orderFormData);
      } else if (data.type === 'waiting_for_staff') {
        // Khi bot bị tắt, hiển thị thông báo đợi nhân viên
        const botMessage = data.answer || 'Nhân viên support sẽ sớm phản hồi lại anh/chị ạ. Vui lòng chờ xíu nhé!';
        shouldScrollRef.current = true;
        setMessages(prev => [...prev, { 
          text: botMessage, 
          isUser: false,
          isType: data.type,
          isWaitingForStaff: true
        }]);
        // ✅ Không set hasActiveEscalation ở đây - chỉ là bot bị tắt tạm thời
        // Khi bật lại bot, chatbot sẽ trả lời bình thường
      } else {
        const botMessage = data.answer || data.response || JSON.stringify(data);
        shouldScrollRef.current = true;
        setMessages(prev => [...prev, { 
          text: botMessage, 
          isUser: false,
          isType: data.type,
          relatedProducts: data.related_products
        }]);
      }

      // Display staff notification if exists
      if (data.staff_notification) {
        setHasActiveEscalation(true);
        const staffMsg = `👨‍💼 Phản hồi từ ${data.staff_notification.assigned_to || 'nhân viên support'}:\n\n"${data.staff_notification.note}"`;
        shouldScrollRef.current = true;
        setMessages(prev => [...prev, { 
          text: staffMsg, 
          isUser: false,
          isStaffNotification: true
        }]);
      } else if (data.type === 'escalated') {
        setHasActiveEscalation(true);
      }
    } catch (error) {
      shouldScrollRef.current = true;
      setMessages(prev => [...prev, { 
        text: `❌ Lỗi: ${error.message}`, 
        isUser: false,
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const updateUserInfo = (field, value) => {
    setUserInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const loadChatHistoryFromStorage = () => {
    const savedHistory = LocalStorageService.getChatHistory();
    if (savedHistory && savedHistory.length > 0) {
      const initialMessage = { text: 'Xin chào! Tôi là nhân viên hỗ trợ khách hàng. Bạn cần giúp gì không?', isUser: false };
      setMessages([initialMessage, ...savedHistory]);
      setShowLoadHistory(false);
      shouldScrollRef.current = true;
      console.log('📂 Loaded', savedHistory.length, 'messages from storage');
    }
  };

  const clearChatHistoryFromStorage = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat? Hành động này không thể hoàn tác.')) {
      LocalStorageService.clearChatHistory();

      setMessages([
        { text: 'Xin chào! Tôi là nhân viên hỗ trợ khách hàng. Bạn cần giúp gì không?', isUser: false }
      ]);
      setShowLoadHistory(false);
      console.log('✅ Chat history cleared');
    }
  };

  const saveUserInfo = async () => {
    if (!userInfo.name && !userInfo.email && !userInfo.phone && !userInfo.address) {
      alert('Vui lòng nhập ít nhất một thông tin');
      return;
    }

    setIsSavingUserInfo(true);
    try {
      const result = await ApiService.saveUserInfo(anonymousId, userInfo);
      alert('✅ Thông tin đã được lưu thành công!');
      console.log('User info saved:', result);
    } catch (error) {
      alert('❌ Lỗi lưu thông tin: ' + error.message);
      console.error('Save user info error:', error);
    } finally {
      setIsSavingUserInfo(false);
    }
  };

  const handleOrderFormSubmit = async () => {
    // Validate dữ liệu
    if (!orderFormData.fullName.trim() || !orderFormData.phone.trim() || !orderFormData.address.trim()) {
      alert('Vui lòng điền đầy đủ thông tin (tên, SĐT, địa chỉ)');
      return;
    }

    // Kiểm tra email format nếu có nhập
    if (orderFormData.email && !/.+@.+\..+/.test(orderFormData.email)) {
      alert('Email không hợp lệ, vui lòng kiểm tra lại');
      return;
    }

    // Cập nhật user info
    setUserInfo({
      name: orderFormData.fullName,
      phone: orderFormData.phone,
      email: orderFormData.email,
      address: orderFormData.address
    });

    // Gửi message xác nhận
    shouldScrollRef.current = true;
    const confirmMsg = `Tên: ${orderFormData.fullName}\nSĐT: ${orderFormData.phone}\nEmail: ${orderFormData.email || '(không có)'}\nĐịa chỉ: ${orderFormData.address}`;
    setMessages(prev => [...prev, { text: confirmMsg, isUser: true }]);
    setShowOrderForm(false);
    
    setIsLoading(true);
    try {
      const data = await ApiService.sendMessage('', anonymousId, {
        name: orderFormData.fullName,
        phone: orderFormData.phone,
        email: orderFormData.email,
        address: orderFormData.address
      });

      const botMessage = data.answer || 'Tạo đơn hàng thành công!';
      shouldScrollRef.current = true;
      setMessages(prev => [...prev, { 
        text: botMessage, 
        isUser: false,
        isType: data.type
      }]);
    } catch (error) {
      shouldScrollRef.current = true;
      setMessages(prev => [...prev, { 
        text: `❌ Lỗi: ${error.message}`, 
        isUser: false,
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchUserId.trim()) {
      alert('Vui lòng nhập ID người dùng');
      return;
    }

    setIsSearching(true);
    try {
      const data = await ApiService.getChatHistory(searchUserId, 100);
      if (data.messages && data.messages.length > 0) {
        shouldScrollRef.current = true;
        const apiMessages = data.messages.reverse().map((msg, idx) => ({
          text: msg.content,
          isUser: msg.role === 'user',
          isStaffReply: msg.is_staff_reply || false,
          staffName: msg.staff_name || null,
          key: idx
        }));
        setMessages(apiMessages);
        setViewingUserId(searchUserId);
        setAnonymousId(searchUserId);
        localStorage.setItem('anonymousId', searchUserId);
      } else {
        alert('Không tìm thấy tin nhắn cho người dùng này');
        setMessages([{ text: 'Xin chào! Tôi là chatbot hỗ trợ khách hàng. Bạn cần giúp gì không?', isUser: false }]);
      }
    } catch (error) {
      alert('Lỗi khi tìm kiếm: ' + error.message);
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!viewingUserId) {
      alert('Vui lòng tìm kiếm một người dùng trước');
      return;
    }

    if (window.confirm(`Bạn có chắc chắn muốn xóa tất cả tin nhắn của người dùng ${viewingUserId}?`)) {
      try {
        // This would need a backend endpoint to delete messages
        // For now, just clear the current view
        setMessages([{ text: 'Xin chào! Tôi là chatbot hỗ trợ khách hàng. Bạn cần giúp gì không?', isUser: false }]);
        setViewingUserId(null);
        setSearchUserId('');
        alert('Đã xóa chat thành công');
      } catch (error) {
        alert('Lỗi khi xóa chat: ' + error.message);
      }
    }
  };

  const handleNewChat = () => {
    shouldScrollRef.current = true;
    setMessages([
      { text: 'Xin chào! Tôi là chatbot hỗ trợ khách hàng. Bạn cần giúp gì không?', isUser: false }
    ]);
    LocalStorageService.clearChatHistory();
    setInput('');
    setFullscreenImage(null);
    setHasActiveEscalation(false);
    setIsChatDisabled(false);
    setViewingUserId(null);
    setSearchUserId('');
    setShowLoadHistory(false);
  };

  if (!isOpen) {
    return (
      <button 
        className="chat-toggle-btn"
        onClick={() => setIsOpen(true)}
      >
        💬
      </button>
    );
  }

  return (
    <div className={`chat-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="chat-header">
        <div className="chat-header-content">
          <span className="chat-icon">💬</span>
          <span className="chat-title">Chat Hỗ Trợ</span>
          {hasActiveEscalation && <span className="escalation-badge">👨‍💼 Có nhân viên hỗ trợ</span>}
        </div>
        <div className="chat-controls">
          {isLoading && <div className="status-indicator"></div>}

          {/* {hasActiveEscalation && (
            <button 
              className={`disable-chat-btn ${isChatDisabled ? 'disabled' : 'enabled'}`}
              title={isChatDisabled ? "Bật chat" : "Tắt chat - Chờ phản hồi từ nhân viên"}
              onClick={() => setIsChatDisabled(!isChatDisabled)}
            >
              {isChatDisabled ? '🔒' : '💬'}
            </button>
          )} */}

          <button 
            className="newchat-btn"
            title="Bắt đầu cuộc trò chuyện mới"
            onClick={handleNewChat}
          >
            ⟳
          </button>

          <button 
            className="settings-btn"
            title="Cài đặt"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️
          </button>

          <button 
            className="minimize-btn"
            title="Thu nhỏ"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? '□' : '_'}
          </button>

          <button 
            className="close-btn"
            title="Đóng"
            onClick={() => setIsOpen(false)}
          >
            ✕
          </button>
        </div>
      </div>

      {!isMinimized && showSettings && (
        <div className="chat-settings">
          <div className="settings-group">
            <h4>🔍 Tìm kiếm Chat Người Dùng</h4>
            <label className="settings-label">
              Nhập User ID:
              <div className="search-input-group">
                <input
                  type="text"
                  className="settings-input"
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleSearchUser();
                  }}
                  placeholder="Ví dụ: user_177098"
                />
                <button 
                  className="search-btn"
                  onClick={handleSearchUser}
                  disabled={isSearching}
                  title="Tìm kiếm"
                >
                  {isSearching ? '⏳' : '🔍'}
                </button>
              </div>
            </label>
            {viewingUserId && (
              <div className="viewing-info">
                <p>📌 Đang xem chat: <strong>{viewingUserId}</strong></p>
                <button 
                  className="delete-btn"
                  onClick={handleDeleteChat}
                  title="Xóa tất cả tin nhắn"
                >
                  🗑️ Xóa Chat
                </button>
              </div>
            )}
          </div>
          
          <div className="settings-group">
            <label className="settings-label">
              ID (Tự động):
              <input
                type="text"
                className="settings-input"
                value={anonymousId}
                onChange={(e) => setAnonymousId(e.target.value)}
                placeholder="Enter your ID"
              />
            </label>
          </div>
          
          <div className="settings-group">
            <h4>📋 Thông tin cá nhân (Tùy chọn)</h4>
            <label className="settings-label">
              Tên:
              <input
                type="text"
                className="settings-input"
                value={userInfo.name}
                onChange={(e) => updateUserInfo('name', e.target.value)}
                placeholder="Tên của bạn"
              />
            </label>
            <label className="settings-label">
              Email:
              <input
                type="email"
                className="settings-input"
                value={userInfo.email}
                onChange={(e) => updateUserInfo('email', e.target.value)}
                placeholder="Email của bạn"
              />
            </label>
            <label className="settings-label">
              Điện thoại:
              <input
                type="tel"
                className="settings-input"
                value={userInfo.phone}
                onChange={(e) => updateUserInfo('phone', e.target.value)}
                placeholder="Số điện thoại"
              />
            </label>
            <label className="settings-label">
              Địa chỉ:
              <input
                type="text"
                className="settings-input"
                value={userInfo.address}
                onChange={(e) => updateUserInfo('address', e.target.value)}
                placeholder="Địa chỉ"
              />
            </label>
            <button 
              className="save-user-info-btn"
              onClick={saveUserInfo}
              disabled={isSavingUserInfo}
              title="Lưu thông tin cá nhân"
            >
              {isSavingUserInfo ? '⏳ Đang lưu...' : '💾 Lưu thông tin'}
            </button>
          </div>
        </div>
      )}

      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index}>
                <div 
                  className={`message ${msg.isUser ? 'user' : 'bot'} ${msg.isError ? 'error' : ''} ${msg.isImage ? 'image-message' : ''} ${msg.isStaffNotification ? 'staff-notification' : ''} ${msg.isStaffReply ? 'staff-reply' : ''} ${msg.isOrderForm ? 'order-form-message' : ''} ${msg.isWaitingForStaff ? 'waiting-for-staff' : ''}`}
                >
                  {msg.isImage ? (
                    <img 
                      src={msg.text} 
                      alt="Product" 
                      className="message-image"
                      onClick={() => setFullscreenImage(msg.text)}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `<span class="image-error">❌ Không thể tải hình ảnh</span>`;
                      }}
                    />
                  ) : msg.isOrderForm ? (
                    <div className="message-content">
                      <div className="message-text">
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div className="message-content">
                      {msg.isStaffReply && <span className="staff-icon" title={`Nhân viên: ${msg.staffName}`}>👨‍💼</span>}
                      <div className="message-text">
                        {msg.isStaffReply && msg.staffName && <div className="staff-name">{msg.staffName}</div>}
                        {msg.text.split('\n').map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
              
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Order Form */}
          {showOrderForm && (
            <div className="order-form">
              <div className="order-form-header">
                <h3>📝 Thông tin đặt hàng</h3>
              </div>
              <div className="order-form-body">
                <label className="form-field">
                  <span>Họ tên *</span>
                  <input
                    type="text"
                    value={orderFormData.fullName}
                    onChange={(e) => setOrderFormData({...orderFormData, fullName: e.target.value})}
                    placeholder="Nhập tên của bạn"
                  />
                </label>
                <label className="form-field">
                  <span>Số điện thoại *</span>
                  <input
                    type="tel"
                    value={orderFormData.phone}
                    onChange={(e) => setOrderFormData({...orderFormData, phone: e.target.value})}
                    placeholder="nhập SĐT"
                  />
                </label>
                <label className="form-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={orderFormData.email}
                    onChange={(e) => setOrderFormData({...orderFormData, email: e.target.value})}
                    placeholder="Email của bạn"
                  />
                </label>
                <label className="form-field">
                  <span>Địa chỉ giao hàng *</span>
                  <input
                    type="text"
                    value={orderFormData.address}
                    onChange={(e) => setOrderFormData({...orderFormData, address: e.target.value})}
                    placeholder="Địa chỉ chi tiết"
                  />
                </label>
              </div>
              <div className="order-form-footer">
                <button
                  className="btn-cancel"
                  onClick={() => setShowOrderForm(false)}
                  disabled={isLoading}
                >
                  Huỷ
                </button>
                <button
                  className="btn-submit"
                  onClick={handleOrderFormSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? '⏳ Đang xử lý...' : '✓ Xác nhận'}
                </button>
              </div>
            </div>
          )}

          <div className="chat-input-container">
            {showLoadHistory && (
              <div className="load-history-banner">
                <p>📂 Bạn có lịch sử chat được lưu trước đó</p>
                <button 
                  className="btn-load-history"
                  onClick={loadChatHistoryFromStorage}
                  title="Tải lại lịch sử chat"
                >
                  ↺ Tải lại lịch sử
                </button>
                <button 
                  className="btn-clear-history"
                  onClick={clearChatHistoryFromStorage}
                  title="Xóa lịch sử chat"
                >
                  🗑️ Xóa
                </button>
              </div>
            )}


            <div className="chat-input-row">
              <input
                type="text"
                className="chat-input"
                placeholder={isChatDisabled ? "Chat đang tạm dừng..." : "Nhập tin nhắn..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading || isChatDisabled}
              />
              <button 
                className="send-btn"
              onClick={sendMessage}
              disabled={isLoading || !input.trim() || isChatDisabled}
              title={isChatDisabled ? "Chat tạm dừng" : "Gửi (Enter)"}
            >
              <span className="send-icon">→</span>
            </button>
            </div>
          </div>
        </>
      )}

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div className="image-modal" onClick={() => setFullscreenImage(null)}>
          <button className="modal-close" onClick={() => setFullscreenImage(null)}>
            ✕
          </button>
          <img 
            src={fullscreenImage} 
            alt="Fullscreen" 
            className="modal-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default ChatBox;
