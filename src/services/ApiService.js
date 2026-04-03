// API Service - Centralized API calls with API Key based authentication
const API_BASE_URL = 'http://127.0.0.1:8000';

// Default API key - can be set via setApiKey()
// This is set during application initialization and sent in all requests
let API_KEY = ' key-default-123';

export const ApiService = {
  // ==================== CONFIGURATION ====================
  /**
   * Set the API key for this web instance
   * The API key is stored in localStorage and used to authenticate all requests
   * Backend maps the API key to the corresponding tenant_id
   * 
   * @param {string} apiKey - The API key for this web instance
   */
  setApiKey(apiKey) {
    API_KEY = apiKey;
    console.log(`✅ API Key set (hidden for security)`);
    localStorage.setItem('apiKey', apiKey);
  },

  getApiKey() {
    return API_KEY;
  },

  /**
   * Initialize API key from localStorage
   * Called on application startup by components
   */
  initApiKey() {
    const saved = localStorage.getItem('apiKey');
    if (saved) {
      API_KEY = saved;
    }
    // console.log(`🔑 API Key initialized from storage: ${API_KEY}`);
    return API_KEY;
  },

  /**
   * Get request headers with API key authentication
   * All API requests include the x-api-key header
   */
  _getHeaders(additionalHeaders = {}) {
    return {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      ...additionalHeaders
    };
  },

  // ==================== CHAT API ====================
  /**
   * Send a message to the chatbot
   * The backend automatically resolves tenant_id from the x-api-key header
   */
  async sendMessage(message, anonymousId, conversationId, userInfo = {}, onToken) {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify({
        message,
        anonymous_id: anonymousId,
        ...userInfo
      })
    });

    if (!response.ok) throw new Error(`Chat API error: ${response.statusText}`);

    const contentType = response.headers.get('content-type') || '';

    // BE có thể trả về JSON thường (semantic cache / bot disabled) thay vì SSE.
    if (!contentType.includes('text/event-stream')) {
      const data = await response.json().catch(() => ({}));

      const answer = data.answer ?? data.full_response ?? '';
      const cid = data.conversation_id ?? conversationId;

      // Một số nhánh BE trả JSON thường nhưng chưa save vào DB (ví dụ image).
      // Chỉ persist trong các case cần thiết để admin poll DB nhìn thấy được.
      const shouldPersist =
        cid != null &&
        answer &&
        !data.cached &&
        (data.type === 'image');

      if (shouldPersist) {
        await fetch(
          `${API_BASE_URL}/chat/save-response?conversation_id=${cid}&answer=${encodeURIComponent(answer)}`,
          {
            method: 'POST',
            headers: this._getHeaders()
          }
        ).catch(() => {});
      }

      return {
        ...data,
        // Nơi FE luôn mong `answer`
        answer,
        conversation_id: cid
      };
    }

    // SSE stream
    const reader = response.body?.getReader?.();
    if (!reader) {
      // Trường hợp hiếm: content-type là event-stream nhưng body không đọc được
      const data = await response.json().catch(() => ({}));
      return {
        ...data,
        answer: data.answer ?? data.full_response ?? '',
        conversation_id: data.conversation_id ?? conversationId
      };
    }

    const decoder = new TextDecoder();

    let fullText = '';
    let lastResponseData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (let line of lines) {
        if (!line.startsWith("data:")) continue;

        const parsed = JSON.parse(line.replace("data:", "").trim());
        lastResponseData = parsed;

        // Token streaming
        if (parsed.token !== undefined) {
          fullText += parsed.token;
          onToken && onToken(parsed.token);
        }

        // Fake stream (khi bot escalation intent)
        if (parsed.done === true) {
          const cid = parsed.conversation_id ?? conversationId;

          // 🔥 SAVE RESPONSE (chỉ khi có conversationId hợp lệ)
          if (cid != null) {
            await fetch(`${API_BASE_URL}/chat/save-response?conversation_id=${cid}&answer=${encodeURIComponent(fullText)}`, {
              method: "POST",
              headers: this._getHeaders()
            }).catch(() => {});
          }

          return {
            answer: fullText,
            ...parsed,
            conversation_id: cid
          };
        }

        // Real SSE done event (BE trả về full_response, không trả done:true)
        if (parsed.full_response !== undefined) {
          const answer = parsed.full_response ?? fullText;
          const cid = parsed.conversation_id ?? conversationId;

          if (cid != null) {
            await fetch(`${API_BASE_URL}/chat/save-response?conversation_id=${cid}&answer=${encodeURIComponent(answer)}`, {
              method: "POST",
              headers: this._getHeaders()
            }).catch(() => {});
          }

          return {
            answer,
            ...parsed,
            conversation_id: cid
          };
        }
      }
    }

    // Fallback nếu stream kết thúc nhưng không gặp event done
    return {
      answer: lastResponseData?.full_response ?? fullText ?? '',
      conversation_id: conversationId
    };
  },



  async getChatHistory(anonymousId, limit = 50) {
    const response = await fetch(
      `${API_BASE_URL}/chat/history/${anonymousId}?limit=${limit}`,
      {
        headers: this._getHeaders()
      }
    );
    if (!response.ok) throw new Error(`History API error: ${response.statusText}`);
    return response.json();
  },

  // Persist assistant response vào DB để staff dashboard có thể poll hiển thị
  async saveChatResponse(conversationId, answer) {
    if (conversationId == null) return null;
    const response = await fetch(
      `${API_BASE_URL}/chat/save-response?conversation_id=${conversationId}&answer=${encodeURIComponent(answer ?? '')}`,
      {
        method: 'POST',
        headers: this._getHeaders()
      }
    );
    if (!response.ok) return null;
    return response.json().catch(() => ({}));
  },

  /**
   * Get all messages in a conversation
   * Backend verifies tenant access via x-api-key
   */
  async getConversationMessages(conversationId, limit = 50) {
    const response = await fetch(
      `${API_BASE_URL}/chat/conversation/${conversationId}?limit=${limit}`,
      {
        headers: this._getHeaders()
      }
    );
    if (!response.ok) throw new Error(`Conversation API error: ${response.statusText}`);
    return response.json();
  },

  // ==================== USER API ====================
  /**
   * Get all users for this tenant
   * Tenant is automatically resolved from x-api-key
   */
  async getUsers() {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: this._getHeaders()
    });
    if (!response.ok) throw new Error(`Users API error: ${response.statusText}`);
    return response.json();
  },

  /**
   * Update user profile information
   */
  async saveUserInfo(anonymousId, userInfo) {
    const response = await fetch(`${API_BASE_URL}/users/${anonymousId}/update-info`, {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify({
        name: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone,
        address: userInfo.address
      })
    });
    if (!response.ok) throw new Error(`Save user info error: ${response.statusText}`);
    return response.json();
  },

  // ==================== DOCUMENT INGESTION API ====================
  /**
   * Upload Excel file with QA documents
   * Tenant is automatically resolved from x-api-key
   * 
   * @param {File} file - The Excel file to upload
   * @param {string} customApiKey - Optional custom API key (uses default if not provided)
   */
  async uploadExcel(file, customApiKey = null) {
    const formData = new FormData();
    formData.append('file', file);
    
    const apiKeyToUse = customApiKey || API_KEY;
    const response = await fetch(`${API_BASE_URL}/upload-excel`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKeyToUse
        // Note: Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData
    });
    if (!response.ok) throw new Error(`Upload API error: ${response.statusText}`);
    return response.json();
  },

  // ==================== ESCALATION API ====================
  /**
   * Get escalation tickets for this tenant
   * Tenant is automatically resolved from x-api-key
   * 
   * @param {number} limit - Maximum number of tickets to return
   * @param {string} status - Filter by status: 'pending', 'in_progress', 'resolved'
   */
  async getPendingEscalations(limit = 50, status = 'pending') {
    const response = await fetch(
      `${API_BASE_URL}/staff/escalations?status=${status}&limit=${limit}`,
      {
        headers: this._getHeaders()
      }
    );
    if (!response.ok) throw new Error(`Escalations API error: ${response.statusText}`);
    return response.json();
  },

  /**
   * Get detailed information about a specific escalation ticket
   * Includes conversation history and user information
   */
  async getEscalationDetail(escalationId) {
    const response = await fetch(
      `${API_BASE_URL}/staff/escalation/${escalationId}`,
      {
        headers: this._getHeaders()
      }
    );
    if (!response.ok) throw new Error(`Get escalation detail error: ${response.statusText}`);
    return response.json();
  },

  /**
   * Send a staff reply to a customer in an escalation ticket
   */
  async sendStaffReply(conversationId, message, staffName) {
    const response = await fetch(
      `${API_BASE_URL}/staff/reply`,
      {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          conversation_id: conversationId,
          message,
          staff_name: staffName
        })
      }
    );
    if (!response.ok) throw new Error(`Staff reply error: ${response.statusText}`);
    return response.json();
  },


  /**
   * Assign an escalation ticket to a staff member
   */
  async updateEscalation(escalationId, status, assignedTo, note) {
    const response = await fetch(
      `${API_BASE_URL}/staff/escalation/${escalationId}/assign?staff_name=${encodeURIComponent(assignedTo)}`,
      {
        method: 'PUT',
        headers: this._getHeaders()
      }
    );
    if (!response.ok) throw new Error(`Update escalation error: ${response.statusText}`);
    return response.json();
  },

  /**
   * Mark an escalation ticket as resolved
   */
  async resolveEscalation(escalationId, note = null) {
    let url = `${API_BASE_URL}/staff/escalation/${escalationId}/resolve`;
    if (note) {
      url += `?resolution_note=${encodeURIComponent(note)}`;
    }
    const response = await fetch(url, {
      method: 'PUT',
      headers: this._getHeaders()
    });
    if (!response.ok) throw new Error(`Resolve escalation error: ${response.statusText}`);
    return response.json();
  },

  /**
   * Get escalations for a specific user
   */
  async getUserEscalations(userId) {
    const response = await fetch(
      `${API_BASE_URL}/staff/escalations?user_id=${userId}`,
      {
        headers: this._getHeaders()
      }
    );
    if (!response.ok) throw new Error(`User escalations error: ${response.statusText}`);
    return response.json();
  },

  /**
   * Disable or enable bot responses for a conversation
   * Useful when staff is actively handling a ticket
   */
  async disableBotResponse(conversationId, isDisabled) {
    const response = await fetch(
      `${API_BASE_URL}/chat/disable-bot/${conversationId}`,
      {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          disable: isDisabled
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Disable bot error: ${response.statusText}`);
    }

    console.log(
      `Bot response ${isDisabled ? 'disabled' : 'enabled'} for conversation ${conversationId}`
    );

    return response.json();
  },


  
  // ==========================================
  // QUẢN LÝ TENANT (SYSTEM ADMIN - KHÔNG CẦN API KEY HEADER)
  // ==========================================

  async getTenants() {
    const response = await fetch(`${API_BASE_URL}/tenants/`, {
      method: 'GET',
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error("Lỗi lấy danh sách Tenant");
    return response.json();
  },

  async createTenant(tenantData) {
    const response = await fetch(`${API_BASE_URL}/tenants/`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tenantData)
    });
    if (!response.ok) throw new Error("Lỗi khi tạo tenant");
    return response.json();
  },

  async updateTenant(tenantId, tenantData) {
    const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tenantData)
    });
    if (!response.ok) throw new Error("Lỗi khi cập nhật tenant");
    return response.json();
  },

  // THÊM HÀM XÓA DỰA THEO CODE BACKEND CỦA BẠN
  async deleteTenant(tenantId) {
    const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}`, {
      method: 'DELETE',
      headers: { 'accept': 'application/json' }
    });
    // Trạng thái 204 No Content không có body trả về, nên chỉ cần check ok
    if (!response.ok) throw new Error("Lỗi khi xóa tenant");
    return true; 
  },



  /**
   * Xóa toàn bộ dữ liệu RAG của 1 Tenant
   * @param {string} customApiKey - API Key của Website cần xóa
   */
  async clearRagData(customApiKey) {
    const response = await fetch(`${API_BASE_URL}/documents/clear`, {
      method: 'DELETE',
      headers: {
        'x-api-key': customApiKey,
        'accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Lỗi khi xóa dữ liệu trên Server");
    }
    return response.json();
  },
  /**
   * Lấy danh sách Người truy cập / Khách hàng của 1 Website cụ thể
   * @param {string} customApiKey - API Key của Website cần xem
   */
  async getTenantUsers(customApiKey) {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'GET',
      headers: {
        'x-api-key': customApiKey,
        'accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Lỗi lấy danh sách khách hàng: ${response.statusText}`);
    }
    return response.json();
  },


};

export default ApiService;
