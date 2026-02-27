import React, { useState, useEffect } from 'react';
import ApiService from '../services/ApiService';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await ApiService.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(`❌ ${err.message}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="api-card">
      <div className="api-header">
        <h2 className="api-title">👥 Danh Sách Khách Hàng</h2>
        <span className="method-badge method-get">GET</span>
      </div>

      <div className="api-url">/users</div>

      <button 
        className="btn" 
        onClick={fetchUsers}
        disabled={isLoading}
      >
        {isLoading ? '⏳ Đang tải...' : '🔄 Làm mới danh sách'}
      </button>

      {error && (
        <div className="response-container error">
          <pre>{error}</pre>
        </div>
      )}

      {isLoading && !users.length && (
        <div className="response-container">
          <pre>⏳ Đang tải dữ liệu...</pre>
        </div>
      )}

      {users.length > 0 && (
        <div className="users-grid">
          {users.map((user, index) => (
            <div key={index} className="user-item">
              <div className="user-id">ID: {user.id || 'N/A'}</div>
              <div className="user-field">
                <strong>📱 Điện thoại:</strong> {user.phone || 'N/A'}
              </div>
              <div className="user-field">
                <strong>👤 Tên:</strong> {user.full_name || user.name || 'N/A'}
              </div>
              <div className="user-field">
                <strong>📧 Email:</strong> {user.email || 'N/A'}
              </div>
              <div className="user-field">
                <strong>🏠 Địa chỉ:</strong> {user.address || 'N/A'}
              </div>
              {user.created_at && (
                <div className="user-field">
                  <strong>📅 Tạo lúc:</strong> {new Date(user.created_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && users.length === 0 && (
        <div className="response-container">
          <pre>📭 Chưa có khách hàng nào trong hệ thống</pre>
        </div>
      )}
    </div>
  );
};

export default UsersList;
