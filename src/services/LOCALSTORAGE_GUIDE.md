# 📂 LocalStorage Strategy - Hướng Dẫn Sử Dụng

## 🎯 Mục Đích

Lưu trữ dữ liệu chat cục bộ trên browser để:
- ✅ Persist chat history khi user quay lại
- ✅ Tạo guest_id duy nhất cho mỗi device
- ✅ Không cần đăng nhập vẫn được lưu lịch sử
- ✅ Tự động load lịch sử chat khi quay lại

---

## 🔧 Cách Hoạt Động

### 1. **Lần đầu User Vào Web**
```
┌─────────────────────────────┐
│ User vào web lần đầu        │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ ChatBox mount               │
│ → LocalStorageService       │
│   .getOrCreateGuestId()     │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ guest_id không có →         │
│ Tạo mới: guest_TIMESTAMP... │
│ Lưu vào localStorage        │
└────────────────────────────┘
```

### 2. **Khi User Gửi Message**
```
✉️ User: "Sản phẩm nào tốt nhất?"
         ↓
    Lưu message vào state
         ↓
    useEffect tự động trigger
         ↓
    LocalStorageService
    .saveChatHistory(messages)
         ↓
    Lưu toàn bộ messages
    vào localStorage
```

### 3. **Khi User Quay Lại**
```
┌─────────────────────────────┐
│ User mở web lại             │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ ChatBox mount               │
│ → Load lịch sử từ storage   │
│ → Hiện "Load history" button│
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│ User click "Load history"   │
│ → Merge saved messages      │
│ → Display toàn bộ chat cũ   │
└────────────────────────────┘
```

---

## 📦 Data Structure

### Guest ID Format
```javascript
// Format: guest_TIMESTAMP_RANDOM
guest_1708675200000_a1b2c3d4e5

// Ví dụ:
{
  created_at: "2026-02-23T10:30:15Z",
  device_id: "a1b2c3d4e5",
  unique: true // Không bao giờ trùng lặp
}
```

### Chat History Storage
```javascript
localStorage['chat_history'] = [
  {
    text: "Sản phẩm nào tốt nhất?",
    isUser: true,
    timestamp: "2026-02-23T10:30:15Z",
    isStaffReply: false,
    staffName: null
  },
  {
    text: "Sản phẩm A rất tốt ạ...",
    isUser: false,
    timestamp: "2026-02-23T10:30:20Z",
    isStaffReply: false,
    staffName: null
  },
  ...
]
```

### User Info Storage
```javascript
localStorage['user_info'] = {
  name: "Nguyễn Văn A",
  email: "a@example.com",
  phone: "0123456789",
  address: "123 Đường ABC, TP.HCM"
}
```

---

## 🎮 LocalStorageService API

### `getOrCreateGuestId()`
```javascript
const guestId = LocalStorageService.getOrCreateGuestId();
// Output: "guest_1708675200000_a1b2c3d4e5"
// Tạo nếu chưa có, lấy nếu đã có
```

### `saveChatHistory(messages)`
```javascript
LocalStorageService.saveChatHistory(messages);
// Lưu toàn bộ messages vào localStorage
// Tự động clean old messages nếu quá 100
```

### `getChatHistory()`
```javascript
const history = LocalStorageService.getChatHistory();
// Output: [{text, isUser, timestamp, ...}, ...]
```

### `clearChatHistory()`
```javascript
LocalStorageService.clearChatHistory();
// Xóa toàn bộ chat history
```

### `clearAll()`
```javascript
LocalStorageService.clearAll();
// Xóa guest_id, chat_history, user_info
// = Reset hoàn toàn session
```

### `getStorageInfo()`
```javascript
const info = LocalStorageService.getStorageInfo();
// Output: {used: "125.45 KB", estimate: "5-10 MB"}
```

---

## 🔄 Flow Chi Tiết

### 1. **Component Mount**
```javascript
useEffect(() => {
  // Lần 1: Tạo/lấy guest_id
  const guestId = LocalStorageService.getOrCreateGuestId();
  
  // Lần 2: Kiểm tra có lịch sử không
  const savedHistory = LocalStorageService.getChatHistory();
  if (savedHistory.length > 0) {
    setShowLoadHistory(true); // Hiện button
  }
}, []);
```

### 2. **Mỗi Khi Messages Thay Đổi**
```javascript
useEffect(() => {
  if (messages.length > 1) {
    LocalStorageService.saveChatHistory(messages);
    // Tự động lưu sau mỗi message mới
  }
}, [messages]);
```

### 3. **Load History**
```javascript
const loadChatHistoryFromStorage = () => {
  const savedHistory = LocalStorageService.getChatHistory();
  const merged = [initialMessage, ...savedHistory];
  setMessages(merged);
  setShowLoadHistory(false);
};
```

### 4. **Clear History**
```javascript
const clearChatHistoryFromStorage = () => {
  if (confirm("Xóa cả lịch sử?")) {
    LocalStorageService.clearChatHistory();
    // Reset messages
  }
};
```

---

## 📊 Browser Compatibility

| Browser | localStorage | Max Size | Status |
|---------|------------|----------|--------|
| Chrome | ✅ | ~10 MB | ✅ Supported |
| Firefox | ✅ | ~10 MB | ✅ Supported |
| Safari | ✅ | ~5 MB | ✅ Supported |
| IE11 | ✅ | ~10 MB | ✅ Supported |
| Mobile | ✅ | ~5 MB | ✅ Supported |

---

## 🛡️ Security & Privacy

### ⚠️ Lưu Ý Quan Trọng

1. **Dữ liệu không mã hóa**
   - localStorage lưu text bình thường
   - Ai xem Devtools console thì thấy được
   - ❌ KHÔNG nên lưu password, token nhạy cảm

2. **Shared Device Risk**
   - Nếu multiple users dùng cùng device
   - Các messages không riêng tư
   - ✅ Hãy có nút "Clear History"

3. **Privacy**
   - Chỉ client-side, server không biết
   - Data được xóa nếu xóa browser cache
   - ✅ An toàn cho dữ liệu chat

---

## 🧹 Auto-Cleanup

### Khi Storage Quá Full
```javascript
// Mặc định localStorage ~5-10 MB
// Khi quá 100 messages:
// → Giữ 50 message mới nhất
// → Xóa 50 message cũ nhất
// → Tự động trigger

LocalStorageService.clearOldChatMessages();
```

---

## 📱 UI Components

### Load History Banner
```jsx
{showLoadHistory && (
  <div className="load-history-banner">
    <p>📂 Bạn có lịch sử chat được lưu trước đó</p>
    <button onClick={loadChatHistoryFromStorage}>
      ↺ Tải lại lịch sử
    </button>
    <button onClick={clearChatHistoryFromStorage}>
      🗑️ Xóa
    </button>
  </div>
)}
```

### Guest ID Display (Optional)
```jsx
// Có thể hiện guest_id ở settings
<span>ID: {guestId}</span>
// Người dùng có thể share ID này để support trích xuất lịch sử
```

---

## 🐛 Troubleshooting

### Vấn đề: "History không load được"
**Giải pháp:**
- Check `localStorage` trong DevTools (F12 → Application)
- Xem `chat_history` key có data không
- Thử `clearChatHistory()` rồi làm lại

### Vấn đề: "Storage quá full"
**Giải pháp:**
- Tự động cleanup khi → 100 messages
- Có thể phân trang history (lưu paginated)
- Backup to server nếu cần lâu dài

### Vấn đề: "Guest ID khác mỗi lần vào"
**Giải pháp:**
- Check `localStorage.getItem('guest_id')`
- Nếu nil → tạo mới (đúng)
- Nếu private browsing → localStorage reset

---

## 🎯 Best Practices

### ✅ Nên Làm
- ✅ Lưu chat history cho user convenience
- ✅ Lưu user info (name, email) để không nhập lại
- ✅ Hiện warning khi xóa history
- ✅ Auto-cleanup cũ messages
- ✅ Cho phép export/share history

### ❌ Không Nên Làm
- ❌ Lưu password, token, sensitive data
- ❌ Lưu quá lâu (>1 năm)
- ❌ Override user choice (lưu mà không hỏi)
- ❌ Lưu metadata nhạy cảm (IP, location)

---

## 📈 Future Enhancements

1. **Export Chat History**
   - Tải file PDF/TXT lịch sử chat
   - Share via email/link

2. **Cloud Sync** (Backend)
   - Lưu to server database
   - Sync multiple devices
   - Persistent across browsers

3. **Encryption**
   - Mã hóa localStorage data
   - Password-protect history
   - Privacy encryption

4. **Analytics**
   - Track conversation length
   - User engagement metrics
   - Common questions

---

## 📞 Support

Để sử dụng `LocalStorageService`:

```javascript
import LocalStorageService from '../services/LocalStorageService';

// Tạo/lấy guest_id
const guestId = LocalStorageService.getOrCreateGuestId();

// Lưu chat history
LocalStorageService.saveChatHistory(messages);

// Lấy chat history
const history = LocalStorageService.getChatHistory();

// Xóa history
LocalStorageService.clearChatHistory();
```

---

**Last Updated:** Feb 23, 2026  
**Status:** ✅ Production Ready
