import React, { useState, useEffect } from 'react';
import ApiService from '../services/ApiService';

const UploadExcel = () => {
  const [file, setFile] = useState(null);
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize API key on mount
  useEffect(() => {
    ApiService.initApiKey();
    // console.log(`🔑 Upload Excel - API Key initialized`);
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx')) {
        setError('⚠️ Chỉ hỗ trợ file .xlsx');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResponse(null);
    }
  };

  const uploadFile = async () => {
    if (!file) {
      setError('Vui lòng chọn file!');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await ApiService.uploadExcel(file);
      setResponse({
        success: true,
        data: result
      });
      setFile(null);
      // Reset file input
      document.querySelector('.form-file').value = '';
    } catch (err) {
      setError(`❌ Lỗi: ${err.message}`);
      setResponse({
        success: false,
        error: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="api-card">
      <div className="api-header">
        <h2 className="api-title">📥 Upload Excel</h2>
        <span className="method-badge method-post">POST</span>
      </div>
      
      <div className="api-url">/upload-excel</div>

      <div className="form-group">
        <label className="form-label" htmlFor="excel-file">
          Chọn file Excel (.xlsx) với cột: A (Câu hỏi), B (Trả lời)
        </label>
        <input
          type="file"
          id="excel-file"
          className="form-file"
          accept=".xlsx"
          onChange={handleFileChange}
        />
        {file && (
          <div className="file-info">
            ✓ File: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </div>
        )}
      </div>

      <button 
        className="btn" 
        onClick={uploadFile}
        disabled={isLoading || !file}
      >
        {isLoading ? '⏳ Đang Upload...' : '🚀 Upload File'}
      </button>

      {error && (
        <div className="response-container error">
          <pre>{error}</pre>
        </div>
      )}

      {response && (
        <div className={`response-container ${!response.success ? 'error' : ''}`}>
          <pre>
            {JSON.stringify(response.data || response.error, null, 2)}
          </pre>
        </div>
      )}

      <div className="api-info">
        <p>📋 Format file Excel:</p>
        <ul>
          <li><strong>Cột A:</strong> "A (Câu hỏi)" - câu hỏi từ khách hàng</li>
          <li><strong>Cột B:</strong> "B (Trả lời)" - câu trả lời</li>
          <li><strong>Cột C (Tùy chọn):</strong> "C (Key work)" - từ khóa</li>
          <li><strong>Cột D (Tùy chọn):</strong> "D(image_url)" - URL hình ảnh</li>
        </ul>
      </div>
    </div>
  );
};

export default UploadExcel;
