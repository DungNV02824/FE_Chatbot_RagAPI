// API Service - Centralized API calls
const API_BASE_URL = 'http://127.0.0.1:8000';

export const ApiService = {
  // ==================== CHAT API ====================
  async sendMessage(message, anonymousId, userInfo = {}) {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        anonymous_id: anonymousId,
        ...userInfo
      })
    });
    if (!response.ok) throw new Error(`Chat API error: ${response.statusText}`);
    return response.json();
  },

  async getChatHistory(anonymousId, limit = 50) {
    const response = await fetch(
      `${API_BASE_URL}/chat/history/${anonymousId}?limit=${limit}`
    );
    if (!response.ok) throw new Error(`History API error: ${response.statusText}`);
    return response.json();
  },

  async getConversationMessages(conversationId, limit = 50) {
    const response = await fetch(
      `${API_BASE_URL}/chat/conversation/${conversationId}?limit=${limit}`
    );
    if (!response.ok) throw new Error(`Conversation API error: ${response.statusText}`);
    return response.json();
  },

  // ==================== USER API ====================
  async getUsers() {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error(`Users API error: ${response.statusText}`);
    return response.json();
  },

  async saveUserInfo(anonymousId, userInfo) {
    const response = await fetch(`${API_BASE_URL}/users/${anonymousId}/update-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  async uploadExcel(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/upload-excel`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error(`Upload API error: ${response.statusText}`);
    return response.json();
  },

  // ==================== ESCALATION API ====================
  async getPendingEscalations(limit = 50) {
    const response = await fetch(
      `${API_BASE_URL}/escalations/pending?limit=${limit}`
    );
    if (!response.ok) throw new Error(`Escalations API error: ${response.statusText}`);
    return response.json();
  },

  async updateEscalation(escalationId, status, assignedTo, note) {
    const response = await fetch(
      `${API_BASE_URL}/escalations/${escalationId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          assigned_to: assignedTo,
          note
        })
      }
    );
    if (!response.ok) throw new Error(`Update escalation error: ${response.statusText}`);
    return response.json();
  },

  async getUserEscalations(userId) {
    const response = await fetch(`${API_BASE_URL}/escalations/user/${userId}`);
    if (!response.ok) throw new Error(`User escalations API error: ${response.statusText}`);
    return response.json();
  },

  async sendStaffReply(escalationId, message, assignedTo) {
    const response = await fetch(
      `${API_BASE_URL}/escalations/${escalationId}/reply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          assigned_to: assignedTo
        })
      }
    );
    if (!response.ok) throw new Error(`Staff reply error: ${response.statusText}`);
    return response.json();
  },

  async disableBotResponse(conversationId, isDisabled) {
    const response = await fetch(
      `${API_BASE_URL}/chat/conversation/${conversationId}/disable-bot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_disabled: isDisabled
        })
      }
    );
    if (!response.ok) throw new Error(`Disable bot error: ${response.statusText}`);
    return response.json();
  }
};

export default ApiService;
