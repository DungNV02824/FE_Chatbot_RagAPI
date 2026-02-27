import React, { useState } from 'react';
import './App.css';
import ChatBox from './components/ChatBox';
import StaffDashboard from './components/StaffDashboard';
import UploadExcel from './components/UploadExcel';
import UsersList from './components/UsersList';

function App() {
  const [role, setRole] = useState('customer'); // 'customer' or 'staff'

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
        </div>
      </div>

      <div className="app-content">
        {role === 'customer' ? (
          <>
            <div className="api-sections">
              <UploadExcel />
              <UsersList />
            </div>
            <ChatBox />
          </>
        ) : (
          <StaffDashboard />
        )}
      </div>
    </div>
  );
}

export default App;
