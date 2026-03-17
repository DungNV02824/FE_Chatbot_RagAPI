import React, { useState } from 'react';
import './App.css';
import ChatBox from './components/ChatBox';
import StaffDashboard from './components/StaffDashboard';
import UploadExcel from './components/UploadExcel';
import UsersList from './components/UsersList';
import SystemAdminDashboard from './components/SystemAdminDashboard'; // Import component mới

function App() {
  // Thêm 'system_admin' vào các lựa chọn role
  const [role, setRole] = useState('customer'); // 'customer', 'staff', or 'system_admin'

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">
          <span className="title-icon">💬</span>
          RAG Chatbot System
        </h1>
        <p className="app-subtitle">Intelligent customer support with escalation management</p>
        
        <div className="role-selector">
          <button 
            className={`role-btn ${role === 'customer' ? 'active' : ''}`}
            onClick={() => setRole('customer')}
          >
            👤 Customer Interface
          </button>
          <button 
            className={`role-btn ${role === 'staff' ? 'active' : ''}`}
            onClick={() => setRole('staff')}
          >
            👨‍💼 Staff Dashboard
          </button>
          {/* Nút mới cho Quản trị hệ thống */}
          <button 
            className={`role-btn ${role === 'system_admin' ? 'active' : ''}`}
            onClick={() => setRole('system_admin')}
          >
            🛠️ System Admin
          </button>
        </div>
      </div>

      <div className="app-content">
        {role === 'customer' && (
          <>
            <div className="api-sections">
              <UploadExcel />
              <UsersList />
            </div>
            <ChatBox />
          </>
        )}
        
        {role === 'staff' && (
          <StaffDashboard />
        )}

        {/* Render Component Quản trị hệ thống */}
        {role === 'system_admin' && (
          <SystemAdminDashboard />
        )}
      </div>
    </div>
  );
}

export default App;