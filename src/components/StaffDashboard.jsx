import React, { useState, useEffect, useRef } from 'react';
import './StaffDashboard.css';
import ApiService from '../services/ApiService';

const StaffDashboard = () => {
  const [escalations, setEscalations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [staffName, setStaffName] = useState(localStorage.getItem('staffName') || '');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [error, setError] = useState(null);
  const [filterMode, setFilterMode] = useState('pending'); // 'pending' or 'all_users'
  const [isBotDisabledForTicket, setIsBotDisabledForTicket] = useState(false);
  const messagesEndRef = useRef(null);
  const shouldScrollRef = useRef(false);

  const fetchPendingTickets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ApiService.getPendingEscalations(50);
      setEscalations(Array.isArray(data) ? data : []);
    } catch (error) {
      setError(`Failed to fetch escalations: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ApiService.getUsers();
      setAllUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setError(`Failed to fetch users: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTicketMessages = async (conversationId) => {
    try {
      const data = await ApiService.getConversationMessages(conversationId, 100);
      if (data.messages) {
        // Backend returns newest first, so reverse to show oldest first
        setTicketMessages(data.messages.reverse());
      }
    } catch (error) {
      console.log('Error fetching ticket messages:', error);
      setError(`Failed to fetch messages: ${error.message}`);
    }
  };

  useEffect(() => {
    if (filterMode === 'pending') {
      fetchPendingTickets();
    } else {
      fetchAllUsers();
    }
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        if (filterMode === 'pending') {
          fetchPendingTickets();
        } else {
          fetchAllUsers();
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, filterMode]);

  useEffect(() => {
    if (selectedTicket && selectedTicket.conversation_id) {
      fetchTicketMessages(selectedTicket.conversation_id);
      
      // Auto-refresh messages every 2 seconds when ticket is selected
      const interval = setInterval(() => {
        fetchTicketMessages(selectedTicket.conversation_id);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [selectedTicket]);

  // Save staff name to localStorage
  useEffect(() => {
    localStorage.setItem('staffName', staffName);
  }, [staffName]);

  // Scroll to bottom only when user takes action
  useEffect(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldScrollRef.current = false;
    }
  }, [ticketMessages]);

  const handleSelectTicket = (ticket) => {
    shouldScrollRef.current = true;
    setSelectedTicket(ticket);
    setReplyMessage('');
    setIsBotDisabledForTicket(ticket.disable_bot_response || false);
  };

  const handleSelectUser = (user) => {
    // Convert user to ticket-like format
    const userTicket = {
      id: user.id,
      reason: `Cuộc trò chuyện của ${user.name || user.id}`,
      last_message: user.last_message || 'Không có tin nhắn',
      status: 'active',
      conversation_id: user.conversation_id || user.id,  // ✅ Dùng conversation_id từ backend
      created_at: user.created_at || new Date().toISOString(),
      assigned_to: null
    };
    shouldScrollRef.current = true;
    setSelectedTicket(userTicket);
    setReplyMessage('');
    setIsBotDisabledForTicket(user.disable_bot_response || false);
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket || !staffName.trim()) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    const messageToSend = replyMessage.trim();
    setReplyMessage(''); // Clear immediately for better UX
    shouldScrollRef.current = true;

    try {
      const result = await ApiService.sendStaffReply(
        selectedTicket.id,
        messageToSend,
        staffName
      );
      
      if (result.success) {
        // Automatically disable bot response when staff replies
        if (!isBotDisabledForTicket) {
          await ApiService.disableBotResponse(
            selectedTicket.conversation_id,
            true
          );
          setIsBotDisabledForTicket(true);
          console.log('🤐 Bot response tự động bị tắt - Nhân viên đang xử lý');
        }

        // Refresh messages after a short delay to ensure backend saved it
        setTimeout(async () => {
          if (selectedTicket.conversation_id) {
            await fetchTicketMessages(selectedTicket.conversation_id);
          }
          await fetchPendingTickets();
        }, 300);
        setError(null);
      } else {
        setReplyMessage(messageToSend); // Restore message if failed
        shouldScrollRef.current = false;
        setError(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setReplyMessage(messageToSend); // Restore message if failed
      shouldScrollRef.current = false;
      setError(`Error: ${error.message}`);
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      const result = await ApiService.updateEscalation(
        ticketId,
        newStatus,
        staffName || 'Support Team',
        selectedTicket?.note || ''
      );
      
      await fetchPendingTickets();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(result);
      }
      setError(null);
    } catch (error) {
      setError(`Error updating status: ${error.message}`);
    }
  };

  const handleToggleBotResponse = async () => {
    const newState = !isBotDisabledForTicket;
    setIsBotDisabledForTicket(newState);
    
    // Update selected ticket with the new bot disabled state
    if (selectedTicket) {
      setSelectedTicket({
        ...selectedTicket,
        disable_bot_response: newState
      });
    }
    
    try {
      // Call API to update bot response state for this conversation
      await ApiService.disableBotResponse(
        selectedTicket.conversation_id,
        newState
      );
      
      if (newState) {
        console.log('🤐 Bot response bị tắt - Nhân viên có thể chat với khách hàng');
      } else {
        console.log('🤖 Bot response được bật lại');
      }
    } catch (error) {
      console.log('Note: Bot response state updated locally. Backend API may return error:', error.message);
      // Keep local state even if backend API fails
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending':
        return '#ff9800';
      case 'in_progress':
        return '#2196f3';
      case 'resolved':
        return '#4caf50';
      default:
        return '#9e9e9e';
    }
  };

  return (
    <div className="staff-dashboard">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">🎫 Quản Lý Ticket Support</h2>
          <p className="dashboard-subtitle">Xử lý yêu cầu escalation từ khách hàng</p>
        </div>

        <div className="staff-info">
          <input
            type="text"
            className="staff-name-input"
            placeholder="Nhập tên của bạn"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
          />
          <label className="auto-refresh-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            🔄 Tự động làm mới
          </label>
          <button className="refresh-btn" onClick={fetchPendingTickets}>
            🔄 Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="dashboard-content">
      <div className="tickets-list">
          <div className="list-header">
            <h3>
              {filterMode === 'pending' 
                ? `📋 Pending Tickets (${escalations.length})` 
                : `👥 Tất cả Người Dùng (${allUsers.length})`}
            </h3>
            <div className="filter-tabs">
              <button 
                className={`filter-tab ${filterMode === 'pending' ? 'active' : ''}`}
                onClick={() => setFilterMode('pending')}
              >
                📌 Tickets Pending
              </button>
              <button 
                className={`filter-tab ${filterMode === 'all_users' ? 'active' : ''}`}
                onClick={() => setFilterMode('all_users')}
              >
                👥 Tất cả Users
              </button>
            </div>
          </div>

          {isLoading && escalations.length === 0 && allUsers.length === 0 ? (
            <div className="loading">⏳ Đang tải dữ liệu...</div>
          ) : filterMode === 'pending' && escalations.length === 0 ? (
            <div className="no-tickets">✅ Tất cả ticket đã xử lý!</div>
          ) : filterMode === 'all_users' && allUsers.length === 0 ? (
            <div className="no-tickets">📭 Không có người dùng</div>
          ) : (
            <div className="tickets-scroll">
              {filterMode === 'pending' ? (
                // Render pending tickets
                escalations.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`ticket-item ${selectedTicket?.id === ticket.id ? 'selected' : ''}`}
                    onClick={() => handleSelectTicket(ticket)}
                  >
                    <div className="ticket-header">
                      <span className="ticket-id">#{ticket.id}</span>
                      <span
                        className="ticket-status"
                        style={{ backgroundColor: getStatusBadgeColor(ticket.status) }}
                      >
                        {ticket.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="ticket-info">
                      <div className="ticket-reason">📌 {ticket.reason}</div>
                      <div className="ticket-message">
                        💬 {ticket.last_message.substring(0, 50)}...
                      </div>
                      {ticket.assigned_to && (
                        <div className="ticket-assigned">👤 {ticket.assigned_to}</div>
                      )}
                    </div>
                    <div className="ticket-time">
                      {new Date(ticket.created_at).toLocaleString('vi-VN')}
                    </div>
                  </div>
                ))
              ) : (
                // Render all users
                allUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`ticket-item ${selectedTicket?.id === user.id ? 'selected' : ''}`}
                    onClick={() => handleSelectUser(user)}
                  >
                    <div className="ticket-header">
                      <span className="ticket-id">👤 {user.name || user.id}</span>
                      <span className="ticket-status" style={{ backgroundColor: '#9e9e9e' }}>
                        ACTIVE
                      </span>
                    </div>
                    <div className="ticket-info">
                      <div className="ticket-reason">📧 {user.email || 'N/A'}</div>
                      <div className="ticket-message">
                        💬 {user.last_message ? user.last_message.substring(0, 50) : 'Chưa có tin nhắn'}...
                      </div>
                      {user.phone && (
                        <div className="ticket-assigned">📱 {user.phone}</div>
                      )}
                    </div>
                    <div className="ticket-time">
                      {user.created_at ? new Date(user.created_at).toLocaleString('vi-VN') : 'N/A'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Ticket Details & Chat */}
        {selectedTicket ? (
          <div className="ticket-detail">
            <div className="detail-header">
              <div>
                <h3>
                  {filterMode === 'pending' 
                    ? `🎫 Ticket #${selectedTicket.id}` 
                    : `👤 ${selectedTicket.reason}`}
                </h3>
                <p className="detail-reason">📌 {selectedTicket.reason}</p>
              </div>
              <div className="detail-actions">
                {filterMode === 'pending' && (
                  <select
                    className="status-select"
                    value={selectedTicket.status}
                    onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value)}
                  >
                    <option value="pending">Pending (Chờ xử lý)</option>
                    <option value="in_progress">In Progress (Đang xử lý)</option>
                    <option value="resolved">Resolved (Đã giải quyết)</option>
                  </select>
                )}
                <button
                  className={`toggle-bot-btn ${isBotDisabledForTicket ? 'disabled' : 'enabled'}`}
                  onClick={handleToggleBotResponse}
                  title={isBotDisabledForTicket ? "Bật lại chatbot phản hồi" : "Tắt chatbot phản hồi"}
                >
                  {isBotDisabledForTicket ? '🤐 Bot Tắt' : '🤖 Bot Bật'}
                </button>
              </div>
            </div>

            {/* Bot Disabled Banner */}
            {isBotDisabledForTicket && (
              <div className="bot-disabled-banner">
                <span>🤐 Chatbot phản hồi bị tắt cho cuộc trò chuyện này</span>
              </div>
            )}

            {/* Chat Messages */}
            <div className="ticket-messages">
              {ticketMessages.length === 0 ? (
                <div className="no-messages">Không có tin nhắn</div>
              ) : (
                <>
                  {ticketMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`message ${msg.role === 'user' ? 'user-msg' : 'assistant-msg'}`}
                    >
                      <div className="message-header">
                        <span className="message-role">
                          {msg.role === 'user' ? '👤 Khách hàng' : '👨‍💼 Nhân viên hỗ trợ'}
                        </span>
                        {msg.created_at && (
                          <span className="message-time">
                            {new Date(msg.created_at).toLocaleTimeString('vi-VN')}
                          </span>
                        )}
                      </div>
                      <div className="message-content">{msg.content}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Reply Box */}
            {filterMode === 'pending' ? (
              selectedTicket.status !== 'resolved' && (
                <div className="reply-box">
                  <textarea
                    className="reply-textarea"
                    placeholder="Nhập phản hồi cho khách hàng..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={3}
                  />
                  <div className="reply-actions">
                    <button
                      className="send-reply-btn"
                      onClick={handleSendReply}
                      disabled={!replyMessage.trim() || !staffName.trim()}
                    >
                      📤 Gửi Phản Hồi
                    </button>
                    <button
                      className="resolve-btn"
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')}
                    >
                      ✅ Đánh Dấu Là Xong
                    </button>
                  </div>
                </div>
              )
            ) : (
              // For all users mode, show reply box without status options
              <div className="reply-box">
                <textarea
                  className="reply-textarea"
                  placeholder="Nhập phản hồi cho khách hàng..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  rows={3}
                />
                <div className="reply-actions">
                  <button
                    className="send-reply-btn"
                    onClick={handleSendReply}
                    disabled={!replyMessage.trim() || !staffName.trim()}
                  >
                    📤 Gửi Phản Hồi
                  </button>
                </div>
              </div>
            )}

            {filterMode === 'pending' && selectedTicket.status === 'resolved' && (
              <div className="resolved-info">
                ✅ Ticket này đã được giải quyết
              </div>
            )}
          </div>
        ) : (
          <div className="no-selection">
            <p>👈 Chọn một ticket để xem chi tiết</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
