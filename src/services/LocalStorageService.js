/**
 * LocalStorageService - Quản lý lưu trữ dữ liệu cục bộ
 * - Guest ID (tạo & lưu lần đầu)
 * - Chat history (persist message history)
 * - User info (tư dương thông tin khách)
 */

const GUEST_ID_KEY = 'guest_id';
const CHAT_HISTORY_KEY = 'chat_history';
const USER_INFO_KEY = 'user_info';
const LAST_TIMESTAMP_KEY = 'last_chat_timestamp';

class LocalStorageService {
  /**
   * Tạo hoặc lấy guest_id
   * @returns {string} Guest ID duy nhất
   */
  static getOrCreateGuestId() {
    let guestId = localStorage.getItem(GUEST_ID_KEY);
    
    if (!guestId) {
      // Tạo guest_id nếu chưa có
      guestId = this.generateGuestId();
      localStorage.setItem(GUEST_ID_KEY, guestId);
      console.log('✅ Created new guest_id:', guestId);
    }
    
    return guestId;
  }

  /**
   * Generate guest_id duy nhất
   * Format: guest_TIMESTAMP_RANDOM
   */
  static generateGuestId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `guest_${timestamp}_${random}`;
  }

  /**
   * Lưu chat message vào localStorage
   * @param {Array} messages - Danh sách messages
   */
  static saveChatHistory(messages) {
    try {
      // Chỉ lưu content quan trọng, không lưu tất cả
      const simplifiedMessages = messages.map(msg => ({
        text: msg.text,
        isUser: msg.isUser,
        timestamp: msg.timestamp || new Date().toISOString(),
        isStaffReply: msg.isStaffReply || false,
        staffName: msg.staffName || null
      }));

      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(simplifiedMessages));
      localStorage.setItem(LAST_TIMESTAMP_KEY, new Date().toISOString());
      // console.log('✅ Chat history saved:', simplifiedMessages.length, 'messages');
    } catch (e) {
      console.warn('⚠️ Failed to save chat history:', e);
      // Có thể localStorage quá full, xóa 50% message cù nhất
      this.clearOldChatMessages();
    }
  }

  /**
   * Lấy chat history từ localStorage
   * @returns {Array} Danh sách chat messages
   */
  static getChatHistory() {
    try {
      const history = localStorage.getItem(CHAT_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (e) {
      console.warn('⚠️ Failed to parse chat history:', e);
      return [];
    }
  }

  /**
   * Xóa chat history
   */
  static clearChatHistory() {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(LAST_TIMESTAMP_KEY);
    console.log('✅ Chat history cleared');
  }

  /**
   * Xóa các message cũ nếu storage quá full (giữ 50% mới nhất)
   */
  static clearOldChatMessages() {
    try {
      const history = this.getChatHistory();
      if (history.length > 100) {
        // Giữ 50 message mới nhất
        const recentMessages = history.slice(-50);
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(recentMessages));
        console.log('♻️ Cleaned old messages, kept latest 50');
      }
    } catch (e) {
      console.warn('⚠️ Failed to clean old messages:', e);
    }
  }

  /**
   * Lưu user info
   * @param {Object} userInfo - {name, email, phone, address}
   */
  static saveUserInfo(userInfo) {
    try {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
      // console.log('✅ User info saved');
    } catch (e) {
      console.warn('⚠️ Failed to save user info:', e);
    }
  }

  /**
   * Lấy user info
   * @returns {Object} User info
   */
  static getUserInfo() {
    try {
      const info = localStorage.getItem(USER_INFO_KEY);
      return info ? JSON.parse(info) : {};
    } catch (e) {
      console.warn('⚠️ Failed to parse user info:', e);
      return {};
    }
  }

  /**
   * Lấy thời gian chat cuối cùng
   * @returns {string|null} ISO timestamp
   */
  static getLastChatTime() {
    return localStorage.getItem(LAST_TIMESTAMP_KEY);
  }

  /**
   * Xóa toàn bộ dữ liệu (reset session)
   */
  static clearAll() {
    localStorage.removeItem(GUEST_ID_KEY);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    localStorage.removeItem(LAST_TIMESTAMP_KEY);
    console.log('✅ All local data cleared');
  }

  /**
   * Xem dung lượng localStorage hiện tại
   * @returns {Object} {used, available, percentage}
   */
  static getStorageInfo() {
    try {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
      const approxKB = (total / 1024).toFixed(2);
      return {
        used: approxKB + ' KB',
        estimate: '5-10 MB typical limit',
        total: total
      };
    } catch (e) {
      return { used: 'unknown', estimate: '5-10 MB' };
    }
  }
}

export default LocalStorageService;
