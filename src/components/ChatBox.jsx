 import React, { useState, useRef, useEffect } from 'react';
  import './ChatBox.css';
  import ApiService from '../services/ApiService';
  import LocalStorageService from '../services/LocalStorageService';

  const ChatBox = () => {
    // Initialize guest_id from localStorage (tạo nếu chưa có)
    const [guestId] = useState(() => LocalStorageService.getOrCreateGuestId());
    
    // Initialize API key on mount
    useEffect(() => {
      ApiService.initApiKey();
      // console.log(`🔑 Initialized API Key from storage`);
    }, []);
    
    const [messages, setMessages] = useState([
      { text: 'Xin chào! Tôi là nhân viên hỗ trợ khách hàng. Bạn cần giúp gì không?', isUser: false }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);  
    const [anonymousId, setAnonymousId] = useState(guestId);
    const [conversationId, setConversationId] = useState(null);
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
    const staffWsRef = useRef(null);
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
    // Khi BE disable bot, FE sẽ hiển thị 1 lần thông báo chờ.
    // Sau khi nhân viên đã nhắn (staff reply) thì các lần user gửi tiếp sẽ không hiển thị lại câu chờ này.
    const [hasStaffRepliedSinceDisable, setHasStaffRepliedSinceDisable] = useState(false);
    const [waitingMessageVisible, setWaitingMessageVisible] = useState(false);
    const [waitingMessageText, setWaitingMessageText] = useState(
      'Nhân viên support sẽ sớm phản hồi lại anh/chị ạ. Vui lòng chờ xíu nhé!'
    );
    const hasWaitingShownSinceDisableRef = useRef(false);
    const disableFlagRef = useRef(false);
    const lastStaffReplyTsRef = useRef(null);
    const disableAtTsRef = useRef(null);
    const scrollPositionRef = useRef(0);
    const sendInFlightRef = useRef(false); // Chặn gửi trùng khi Enter bị bấm nhanh
    const pendingAssistantTextRef = useRef(null); // Chờ server sync assistant message

    // ===== Load chat history from localStorage on mount =====
    useEffect(() => {
      const savedHistory = LocalStorageService.getChatHistory();
      if (savedHistory && savedHistory.length > 0) {
        // console.log('📂 Found saved chat history:', savedHistory.length, 'messages');
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

    const scrollToTop = () => {
      const messagesContainer = document.querySelector('.chat-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = 0;
      }
    };

    // Save current scroll position
    const saveScrollPosition = () => {
      const messagesContainer = document.querySelector('.chat-messages');
      if (messagesContainer) {
        scrollPositionRef.current = messagesContainer.scrollTop;
      }
    };

    // Preserve scroll position when messages change
    useEffect(() => {
      const messagesContainer = document.querySelector('.chat-messages');
      if (messagesContainer) {
        // Always scroll to bottom to show new messages
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, [messages]);



    // Auto-fetch messages to check for staff replies and disable_bot_response flag
    useEffect(() => {
      // console.log(`🔄 useEffect: Auto-fetch enabled`);

      // console.log('🚀 Auto-fetch starting...');
      const fetchRecentMessages = async () => {
        try {
          // console.log(`📡 Fetching messages for ${anonymousId}...`);

          const data = await ApiService.getChatHistory(anonymousId, 50);

          // console.log('✅ Got messages from API:', data.messages?.length || 0);
          // console.log(`🤐 disable_bot_response: ${data.disable_bot_response}`);

          const disableBot = !!data.disable_bot_response;
          if (disableBot && !disableFlagRef.current) {
            // Vừa mới bị disable bot => reset trạng thái đã có staff reply
            disableFlagRef.current = true;
            disableAtTsRef.current = Date.now();
            setHasStaffRepliedSinceDisable(false);
            lastStaffReplyTsRef.current = null;
            hasWaitingShownSinceDisableRef.current = false;
            setWaitingMessageVisible(false);
            setWaitingMessageText(
              'Nhân viên support sẽ sớm phản hồi lại anh/chị ạ. Vui lòng chờ xíu nhé!'
            );
          } else if (!disableBot && disableFlagRef.current) {
            // Vừa mới bật lại bot => reset
            disableFlagRef.current = false;
            disableAtTsRef.current = null;
            setHasStaffRepliedSinceDisable(false);
            lastStaffReplyTsRef.current = null;
            hasWaitingShownSinceDisableRef.current = false;
            setWaitingMessageVisible(false);
          }

          // Sync escalation mode with backend flag
          if (disableBot) {
            if (!hasActiveEscalation) {
              // console.log('🔔 Bot response disabled - enabling escalation mode');
              setHasActiveEscalation(true);
            }
          } else {
            if (hasActiveEscalation) {
              // console.log('🔔 Bot response re-enabled - disabling escalation mode');
              setHasActiveEscalation(false);
            }
          }

          if (!data.messages || data.messages.length === 0) return;

        let apiMessages = data.messages
          .map((msg) => {

            const content = msg.content ?? msg.text ?? '';
            const isImage = typeof content === 'string' && content.startsWith("http");

            return {
              id: msg.id, // có thể undefined vì BE history không trả id
              text: content,
              isUser: msg.role === 'user',
              isImage: isImage,
              isStaffReply: msg.is_staff_reply ?? msg.isStaffReply ?? false,
              staffName: msg.staff_name ?? msg.staffName ?? null,
              created_at: msg.created_at,
              key: `msg-${msg.created_at || 'na'}-${content || 'na'}`
            };

          })
          // Loại bỏ các tin nhắn "đang chờ nhân viên" do BE đẩy vào history
          // để tránh bị trùng với bubble chờ mà FE tự hiển thị.
          .filter((m) => {
            if (!disableBot) return true;
            if (m.isUser) return true;
            if (m.isStaffReply) return true;
            if (typeof m.text !== 'string') return true;

            const normalized = m.text.trim();
            const defaultWaiting = 'Nhân viên support sẽ sớm phản hồi lại anh/chị ạ. Vui lòng chờ xíu nhé!';

            // Nếu BE push đúng message chờ mặc định thì bỏ qua,
            // FE sẽ tự hiển thị 1 bubble chờ riêng.
            if (normalized === defaultWaiting) {
              return false;
            }

            return true;
          })
          .sort((a, b) => {
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
          });

        // Nếu bot đang bị disable, và trong history có staff reply sau thời điểm disable
        // thì lần user gửi tiếp sẽ KHÔNG hiển thị lại câu chờ.
        if (disableBot) {
          const staffReplies = apiMessages
            .filter((m) => m.isStaffReply && m.created_at)
            .map((m) => ({ created_at: m.created_at, ts: new Date(m.created_at).getTime() }))
            .filter((x) => Number.isFinite(x.ts));

          if (staffReplies.length > 0) {
            const latest = staffReplies.reduce((max, cur) => (cur.ts > max.ts ? cur : max), staffReplies[0]);
            const threshold = disableAtTsRef.current ?? -Infinity;

            if (latest.ts >= threshold) {
              setHasStaffRepliedSinceDisable(true);
              lastStaffReplyTsRef.current = Math.max(lastStaffReplyTsRef.current ?? 0, latest.ts);
              setWaitingMessageVisible(false);
            }
          }
        }

        setMessages(prev => {
          if (!apiMessages || apiMessages.length === 0) return prev;

          // Nếu đang gửi message (local đang có message tạm), tránh ghi đè UI khi poll.
          if (isLoading || sendInFlightRef.current) return prev;

          // Nếu đang chờ một assistant message vừa gửi nhưng server chưa kịp lưu,
          // thì không ghi đè UI để tránh hiện rồi mất.
          if (pendingAssistantTextRef.current) {
            const apiLast = apiMessages[apiMessages.length - 1];
            if (apiLast && apiLast.text !== pendingAssistantTextRef.current) {
              return prev;
            }
          }

          // BE history response hiện chưa trả `id` cho từng message,
          // nên không thể dùng id để detect message mới.
          const prevLast = prev[prev.length - 1];
          const apiLast = apiMessages[apiMessages.length - 1];

          // Nếu server đã trả assistant message đang chờ thì clear pending
          if (
            pendingAssistantTextRef.current &&
            apiLast &&
            apiLast.text === pendingAssistantTextRef.current
          ) {
            pendingAssistantTextRef.current = null;
          }

          const prevSig = prevLast
            ? `${prevLast.text}|${prevLast.created_at}|${prevLast.isStaffReply}|${prevLast.staffName}`
            : '';
          const apiSig = apiLast
            ? `${apiLast.text}|${apiLast.created_at}|${apiLast.isStaffReply}|${apiLast.staffName}`
            : '';

          if (prevSig !== apiSig || apiMessages.length !== prev.length) {
            // console.log('✅ Syncing messages from server...');
            return apiMessages;
          }

          // console.log('ℹ️ No meaningful change from server');
          return prev;
        });

        } catch (error) {
          console.log('Auto-fetch messages error:', error);
        }
      };
      // Gọi ngay lần đầu, rồi gọi lại theo interval
      fetchRecentMessages();
      const interval = setInterval(fetchRecentMessages, 3000);
      pollIntervalRef.current = interval;

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }, [anonymousId, hasActiveEscalation]);

    // WebSocket realtime: nhận tin nhắn từ nhân viên (staff_reply)
    useEffect(() => {
      if (!conversationId) {
        // Nếu chưa có conversation thì đóng WS nếu đang mở
        if (staffWsRef.current) {
          staffWsRef.current.close();
          staffWsRef.current = null;
        }
        return;
      }

      // Tránh mở trùng nếu đã có kết nối còn sống
      if (staffWsRef.current && staffWsRef.current.readyState === WebSocket.OPEN) {
        return;
      }

      // Kết nối trực tiếp tới BE (cùng host với API_BASE_URL: http://127.0.0.1:8000)
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsHost = '127.0.0.1:8000';
      const wsUrl = `${wsProtocol}://${wsHost}/ws/staff-messages/${conversationId}`;

      console.log('🔌 Opening staff WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      staffWsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data || !data.content) return;

          console.log('👨‍💼 Realtime staff message:', data);

          const createdAt = data.created_at || new Date().toISOString();

          setMessages(prev => [
            ...prev,
            {
              text: data.content,
              isUser: false,
              isStaffReply: data.is_staff_reply,
              staffName: data.staff_name,
              created_at: createdAt,
              key: `staff-${createdAt}-${data.id || Math.random()}`
            }
          ]);

          // Khi đã có nhân viên trả lời, ẩn bubble chờ
          setHasStaffRepliedSinceDisable(true);
          setWaitingMessageVisible(false);
        } catch (e) {
          console.log('⚠️ Error parsing staff WS message:', e);
        }
      };

      ws.onclose = () => {
        console.log('🔌 Staff WebSocket closed');
        staffWsRef.current = null;
      };

      ws.onerror = (err) => {
        console.log('⚠️ Staff WebSocket error:', err);
      };

      // Gửi ping nhẹ để giữ kết nối sống (optional)
      ws.onopen = () => {
        try {
          ws.send('ping');
        } catch (e) {
          console.log('⚠️ Staff WebSocket ping failed:', e);
        }
      };

      return () => {
        if (staffWsRef.current) {
          staffWsRef.current.close();
          staffWsRef.current = null;
        }
      };
    }, [conversationId]);

    const sendMessage = async () => {
      const message = input.trim();
      // `isLoading` là state async => có thể chưa kịp set khi user bấm Enter 2 lần nhanh.
      // Dùng ref để chặn gửi trùng ngay lập tức.
      if (!message || isChatDisabled) return;
      if (sendInFlightRef.current || isLoading) return;

      sendInFlightRef.current = true;
      const hadConversationId = conversationId != null;

      // Add message with temporary created_at timestamp to prevent duplicates from auto-fetch
      const now = new Date().toISOString();
      const uniqueId = Math.random().toString(36).substr(2, 9);
      setMessages(prev => [...prev, { 
        text: message, 
        isUser: true, 
        created_at: now,
        key: `msg-${now}-${uniqueId}`
      }]);
      setInput('');

      try {
        // shouldScrollRef.current = true;
        setIsLoading(true);

        const data = await ApiService.sendMessage(message, anonymousId, conversationId, userInfo);

        // Nếu FE chưa có conversationId (thường xảy ra ở lượt chat đầu tiên),
        // BE chưa kịp/không trả conversation_id qua SSE done event => admin poll không thấy tin nhắn bot.
        // Giải pháp: tìm conversation_id qua /users rồi persist câu trả lời bot vào DB.
        const resolvedConversationIdFromApi = data.conversation_id ?? conversationId;
        if (!hadConversationId && resolvedConversationIdFromApi == null && data.answer) {
          try {
            const usersData = await ApiService.getUsers();
            const match = Array.isArray(usersData)
              ? usersData.find((u) => String(u.id) === String(anonymousId))
              : null;

            if (match?.conversation_id != null) {
              setConversationId(match.conversation_id);
              await ApiService.saveChatResponse(match.conversation_id, data.answer);
            }
          } catch (e) {
            console.log('⚠️ Could not resolve conversation_id for manual save:', e?.message || e);
          }
        }

        // Update conversationId from response if available
        if (data.conversation_id) {
          setConversationId(data.conversation_id);
        }

        console.log('📨 Got response:', data);

        // Handle different response types
        if (data.images && data.images.length > 0) {
          // hiện text trước
          if (data.answer) {
            setMessages(prev => [...prev, {
              text: data.answer,
              isUser: false
            }]);
          }

          // hiện từng ảnh
          data.images.forEach((img) => {
            setMessages(prev => [...prev, {
              text: img,
              isUser: false,
              isImage: true
            }]);
          });

        } else if (data.type === 'order_form') {
          // Hiển thị form đặt hàng
          const botMessage = data.answer || 'Vui lòng điền thông tin đặt hàng';
          pendingAssistantTextRef.current = botMessage;
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
          // Chỉ hiển thị 1 lần sau khi bot bị disable.
          // Không push vào messages để tránh bị auto-poll ghi đè gây "ẩn hiện".
          if (!hasStaffRepliedSinceDisable && !hasWaitingShownSinceDisableRef.current) {
            hasWaitingShownSinceDisableRef.current = true;
            setWaitingMessageText(botMessage);
            setWaitingMessageVisible(true);
          }
          // ✅ Không set hasActiveEscalation ở đây - chỉ là bot bị tắt tạm thời
          // Khi bật lại bot, chatbot sẽ trả lời bình thường
        } else {
          const botMessage = data.answer || data.response || JSON.stringify(data);
          console.log('📝 Displaying bot message:', botMessage);
          pendingAssistantTextRef.current = botMessage;
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
          setMessages(prev => [...prev, {
            text: staffMsg,
            isUser: false,
            isStaffNotification: true
          }]);
        } else if (data.type === 'escalated') {
          setHasActiveEscalation(true);
        }
      } catch (error) {
        console.error('❌ Error sending message:', error);
        setMessages(prev => [...prev, {
          text: `❌ Lỗi: ${error.message}`,
          isUser: false,
          isError: true
        }]);
      } finally {
        setIsLoading(false);
        sendInFlightRef.current = false;
      }

      // Luôn tắt guard
      // (setIsLoading(false) ở finally phía trên đảm bảo UX)
      sendInFlightRef.current = false;
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
        saveScrollPosition();
        const initialMessage = { text: 'Xin chào! Tôi là nhân viên hỗ trợ khách hàng. Bạn cần giúp gì không?', isUser: false };
        setMessages([initialMessage, ...savedHistory]);
        setShowLoadHistory(false);
        console.log('📂 Loaded', savedHistory.length, 'messages from storage');
      }
    };

    const clearChatHistoryFromStorage = () => {
      if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat? Hành động này không thể hoàn tác.')) {
        LocalStorageService.clearChatHistory();
        
        saveScrollPosition();
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
      const confirmMsg = `Tên: ${orderFormData.fullName}\nSĐT: ${orderFormData.phone}\nEmail: ${orderFormData.email || '(không có)'}\nĐịa chỉ: ${orderFormData.address}`;
      setMessages(prev => [...prev, { text: confirmMsg, isUser: true }]);
      setShowOrderForm(false);
      
      setIsLoading(true);
      try {
        const data = await ApiService.sendMessage('', anonymousId, conversationId, {
          name: orderFormData.fullName,
          phone: orderFormData.phone,
          email: orderFormData.email,
          address: orderFormData.address
        });

        // Update conversationId from response if available
        if (data.conversation_id) {
          setConversationId(data.conversation_id);
        }

        const botMessage = data.answer || 'Tạo đơn hàng thành công!';
        setMessages(prev => [...prev, { 
          text: botMessage, 
          isUser: false,
          isType: data.type
        }]);
      } catch (error) {
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
          const apiMessages = data.messages.map((msg) => ({
            id: msg.id,
            text: msg.content,
            isUser: msg.role === 'user',
            isStaffReply: msg.is_staff_reply || false,
            staffName: msg.staff_name || null,
            created_at: msg.created_at,
            key: `msg-${msg.id}`
          }));
          setMessages(apiMessages);
          setViewingUserId(searchUserId);
          setAnonymousId(searchUserId);
          localStorage.setItem('anonymousId', searchUserId);
          console.log('✅ Loaded', apiMessages.length, 'messages for user:', searchUserId);
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
          saveScrollPosition();
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
      // shouldScrollRef.current = true;
      saveScrollPosition();
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

    // Render messages: loại bỏ các message waiting cũ khỏi state để tránh nhấp nháy
    const messagesForRender = messages.filter((m) => !m.isWaitingForStaff);
    const waitingMessageObj =
      waitingMessageVisible && !hasStaffRepliedSinceDisable
        ? {
            text: waitingMessageText,
            isUser: false,
            isType: 'waiting_for_staff',
            isWaitingForStaff: true
          }
        : null;

    const renderedMessages = waitingMessageObj
      ? [...messagesForRender, waitingMessageObj]
      : messagesForRender;

    // Whenever waiting bubble is toggled, scroll to bottom
    useEffect(() => {
      if (!waitingMessageVisible) return;
      const messagesContainer = document.querySelector('.chat-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, [waitingMessageVisible]);

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
              {/* {[...messages].reverse().map((msg) => ( */}
                {renderedMessages.map((msg, index) => (
                  <div key={msg.id || index}>
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