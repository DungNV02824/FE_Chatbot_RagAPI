import React, { useState } from 'react';
import './SystemAdminDashboard.css';

const SystemAdminDashboard = () => {
  // ==========================================
  // 1. STATE CHÍNH: DANH SÁCH TENANT (WEB)
  // ==========================================
  const [tenants, setTenants] = useState([
    { 
      id: 1, name: 'default', description: 'Default tenant', api_key: 'key-default-123', is_active: true,
      documents: [{ docId: 101, filename: 'FAQ_Chung.pdf', size: '1.2 MB', uploadedAt: '2023-10-20' }],
      staff: [{ staffId: 1, name: 'Admin Tổng', email: 'admin@system.com', role: 'manager' }]
    },
    { 
      id: 2, name: 'chatbot-web-1', description: 'Web bán hàng 1', api_key: 'key-web-1-123', is_active: true,
      documents: [{ docId: 102, filename: 'Bang_Gia_2023.xlsx', size: '450 KB', uploadedAt: '2023-10-22' }],
      staff: [{ staffId: 2, name: 'Nguyễn Văn A', email: 'nva@web1.com', role: 'staff' }]
    },
    { 
      id: 3, name: 'chatbot-web-2', description: 'Tập luyện', api_key: 'key-web-2-123', is_active: true,
      documents: [],
      staff: []
    },
  ]);

  // State cho Form Tenant
  const [formData, setFormData] = useState({ name: '', description: '', api_key: '' });
  const [editingId, setEditingId] = useState(null);

  // State cho Modal Dữ liệu RAG
  const [managingTenant, setManagingTenant] = useState(null); 
  const [selectedFile, setSelectedFile] = useState(null);

  // State cho Modal Nhân Viên
  const [managingStaffTenant, setManagingStaffTenant] = useState(null);
  const [staffFormData, setStaffFormData] = useState({ name: '', email: '', role: 'staff' });
  const [editingStaffId, setEditingStaffId] = useState(null);

  // ==========================================
  // 2. CRUD CHO TENANT (WEBSITE)
  // ==========================================
  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.description || !formData.api_key) return alert("Vui lòng điền đủ thông tin!");

    if (editingId) {
      setTenants(tenants.map(t => t.id === editingId ? { ...t, ...formData } : t));
    } else {
      setTenants([...tenants, {
        id: tenants.length > 0 ? Math.max(...tenants.map(t => t.id)) + 1 : 1,
        ...formData,
        is_active: true,
        documents: [], // Khởi tạo rỗng
        staff: []      // Khởi tạo rỗng
      }]);
    }
    resetForm();
  };

  const handleEditClick = (tenant) => {
    setFormData({ name: tenant.name, description: tenant.description, api_key: tenant.api_key });
    setEditingId(tenant.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (id, name) => {
    if (window.confirm(`⚠️ Bạn chắc chắn muốn xóa website: "${name}"? Toàn bộ file và nhân viên sẽ bị xóa!`)) {
      setTenants(tenants.filter(t => t.id !== id));
      if (editingId === id) resetForm();
    }
  };

  const toggleActiveStatus = (id) => setTenants(tenants.map(t => t.id === id ? { ...t, is_active: !t.is_active } : t));
  const resetForm = () => { setFormData({ name: '', description: '', api_key: '' }); setEditingId(null); };

  // ==========================================
  // 3. CRUD CHO DỮ LIỆU RAG (FILES)
  // ==========================================
  const openDataManager = (tenant) => { setManagingTenant(tenant); setSelectedFile(null); };
  const closeDataManager = () => { setManagingTenant(null); setSelectedFile(null); };

  const handleUploadDocument = () => {
    if (!selectedFile) return alert("Vui lòng chọn 1 file!");
    const newDoc = { docId: Date.now(), filename: selectedFile.name, size: (selectedFile.size / 1024).toFixed(1) + ' KB', uploadedAt: new Date().toISOString().split('T')[0] };
    
    setTenants(tenants.map(t => {
      if (t.id === managingTenant.id) {
        const updatedDocs = [...t.documents, newDoc];
        setManagingTenant({ ...t, documents: updatedDocs });
        return { ...t, documents: updatedDocs };
      }
      return t;
    }));
    alert("Upload thành công!");
    setSelectedFile(null); document.getElementById("modal-file-upload").value = "";
  };

  const handleDeleteDocument = (docId, filename) => {
    if (window.confirm(`Xóa file "${filename}"?`)) {
      setTenants(tenants.map(t => {
        if (t.id === managingTenant.id) {
          const filteredDocs = t.documents.filter(d => d.docId !== docId);
          setManagingTenant({ ...t, documents: filteredDocs });
          return { ...t, documents: filteredDocs };
        }
        return t;
      }));
    }
  };

  // ==========================================
  // 4. CRUD CHO NHÂN VIÊN (STAFF)
  // ==========================================
  const openStaffManager = (tenant) => { setManagingStaffTenant(tenant); resetStaffForm(); };
  const closeStaffManager = () => { setManagingStaffTenant(null); resetStaffForm(); };

  const handleStaffInputChange = (e) => setStaffFormData({ ...staffFormData, [e.target.name]: e.target.value });
  const resetStaffForm = () => { setStaffFormData({ name: '', email: '', role: 'staff' }); setEditingStaffId(null); };

  const handleStaffSubmit = (e) => {
    e.preventDefault();
    if (!staffFormData.name || !staffFormData.email) return alert("Nhập đủ Tên và Email!");

    setTenants(tenants.map(t => {
      if (t.id === managingStaffTenant.id) {
        let updatedStaff;
        if (editingStaffId) {
          // Sửa nhân viên
          updatedStaff = t.staff.map(s => s.staffId === editingStaffId ? { ...s, ...staffFormData } : s);
        } else {
          // Thêm nhân viên
          const newStaff = { staffId: Date.now(), ...staffFormData };
          updatedStaff = [...t.staff, newStaff];
        }
        setManagingStaffTenant({ ...t, staff: updatedStaff }); // Update Modal state
        return { ...t, staff: updatedStaff }; // Update Global state
      }
      return t;
    }));
    resetStaffForm();
  };

  const handleEditStaffClick = (staff) => {
    setStaffFormData({ name: staff.name, email: staff.email, role: staff.role });
    setEditingStaffId(staff.staffId);
  };

  const handleDeleteStaff = (staffId, name) => {
    if (window.confirm(`Xóa nhân viên "${name}" khỏi website này?`)) {
      setTenants(tenants.map(t => {
        if (t.id === managingStaffTenant.id) {
          const filteredStaff = t.staff.filter(s => s.staffId !== staffId);
          setManagingStaffTenant({ ...t, staff: filteredStaff });
          return { ...t, staff: filteredStaff };
        }
        return t;
      }));
      if (editingStaffId === staffId) resetStaffForm();
    }
  };

  // ==========================================
  // GIAO DIỆN (RENDER)
  // ==========================================
  return (
    <div className="system-admin-dashboard">
      <h2>🛠️ Quản Trị Hệ Thống (Multi-Tenant)</h2>
      
      {/* --- FORM THÊM/SỬA TENANT --- */}
      <div className={`admin-card ${editingId ? 'editing-mode' : ''}`}>
        <h3>{editingId ? '✏️ Cập Nhật Thông Tin Website' : '➕ Thêm Website / Tenant Mới'}</h3>
        <form onSubmit={handleSubmit} className="admin-form">
          <input type="text" name="name" placeholder="Tên Tenant (VD: chatbot-web-3)" value={formData.name} onChange={handleInputChange} />
          <input type="text" name="description" placeholder="Mô tả" value={formData.description} onChange={handleInputChange} />
          <input type="text" name="api_key" placeholder="Nhập API Key" value={formData.api_key} onChange={handleInputChange} />
          <div className="form-actions">
            <button type="submit" className={editingId ? "btn-update" : "btn-submit"}>{editingId ? 'Cập Nhật' : 'Thêm Mới'}</button>
            {editingId && <button type="button" className="btn-cancel" onClick={resetForm}>Hủy</button>}
          </div>
        </form>
      </div>

      {/* --- BẢNG DANH SÁCH TENANT --- */}
      <div className="admin-card">
        <h3>Danh Sách DB: `public.tenants`</h3>
        <div className="table-responsive">
          <table className="web-list-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Website</th>
                <th>Mô tả</th>
                <th>API Key</th>
                <th>Trạng thái</th>
                <th>Thao tác DB</th>
                <th>Cấu hình Ứng dụng</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className={!tenant.is_active ? 'inactive-row' : ''}>
                  <td>{tenant.id}</td>
                  <td><strong>{tenant.name}</strong></td>
                  <td>{tenant.description}</td>
                  <td><code className="api-key">{tenant.api_key}</code></td>
                  <td>
                    <span className={`status-badge ${tenant.is_active ? 'active' : 'inactive'}`} onClick={() => toggleActiveStatus(tenant.id)}>
                      {tenant.is_active ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  
                  {/* ================================================== */}
                  {/* CỘT SỐ 6: Thao tác DB (Chỉ chứa Sửa / Xóa) */}
                  {/* ================================================== */}
                  <td className="action-buttons-cell">
                    <button onClick={() => handleEditClick(tenant)} className="btn-icon edit" title="Sửa Web">✏️</button>
                    <button onClick={() => handleDeleteClick(tenant.id, tenant.name)} className="btn-icon delete" title="Xóa Web">🗑️</button>
                  </td>

                  {/* ================================================== */}
                  {/* CỘT SỐ 7: Cấu hình Ứng dụng (Chỉ chứa File / Nhân viên) */}
                  {/* ================================================== */}
                  <td className="app-config-cell">
                    <button className="btn-manage-data" onClick={() => openDataManager(tenant)} disabled={!tenant.is_active}>
                      📂 File RAG ({tenant.documents?.length || 0})
                    </button>
                    <button className="btn-manage-staff" onClick={() => openStaffManager(tenant)} disabled={!tenant.is_active}>
                      👨‍💼 Nhân viên ({tenant.staff?.length || 0})
                    </button>
                  </td>

                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan="7" className="text-center">Chưa có website nào được cấu hình.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL 1: QUẢN LÝ DỮ LIỆU RAG               */}
      {/* ========================================== */}
      {managingTenant && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>📂 Dữ liệu RAG: <span>{managingTenant.name}</span></h3>
              <button className="btn-close-modal" onClick={closeDataManager}>✖</button>
            </div>
            <div className="modal-body">
              <div className="upload-zone">
                <input id="modal-file-upload" type="file" accept=".pdf, .xlsx, .csv, .txt" onChange={(e) => setSelectedFile(e.target.files[0])} />
                <button className="btn-upload" onClick={handleUploadDocument}>⬆️ Upload & Nhúng File</button>
              </div>
              <div className="document-list-container">
                <table className="inner-table">
                  <thead><tr><th>Tên File</th><th>Size</th><th>Ngày Upload</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {managingTenant.documents.length === 0 ? <tr><td colSpan="4" className="text-center">Chưa có file nào</td></tr> : 
                      managingTenant.documents.map(doc => (
                        <tr key={doc.docId}>
                          <td>📄 {doc.filename}</td><td>{doc.size}</td><td>{doc.uploadedAt}</td>
                          <td><button className="btn-icon delete" onClick={() => handleDeleteDocument(doc.docId, doc.filename)}>🗑️</button></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: QUẢN LÝ NHÂN VIÊN                 */}
      {/* ========================================== */}
      {managingStaffTenant && (
        <div className="modal-overlay">
          <div className="modal-content modal-large">
            <div className="modal-header">
              <h3>👨‍💼 Nhân viên: <span>{managingStaffTenant.name}</span></h3>
              <button className="btn-close-modal" onClick={closeStaffManager}>✖</button>
            </div>
            <div className="modal-body">
              
              {/* Form Thêm / Sửa Nhân Viên */}
              <div className={`modal-form-zone ${editingStaffId ? 'editing-staff' : ''}`}>
                <h4>{editingStaffId ? '✏️ Cập nhật Nhân viên' : '➕ Thêm Nhân viên mới'}</h4>
                <form onSubmit={handleStaffSubmit} className="staff-form">
                  <input type="text" name="name" placeholder="Tên nhân viên" value={staffFormData.name} onChange={handleStaffInputChange} required />
                  <input type="email" name="email" placeholder="Email đăng nhập" value={staffFormData.email} onChange={handleStaffInputChange} required />
                  <select name="role" value={staffFormData.role} onChange={handleStaffInputChange}>
                    <option value="staff">Nhân viên (Staff)</option>
                    <option value="manager">Quản lý (Manager)</option>
                  </select>
                  <button type="submit" className={editingStaffId ? "btn-update" : "btn-submit"}>
                    {editingStaffId ? "Cập nhật" : "Thêm"}
                  </button>
                  {editingStaffId && <button type="button" className="btn-cancel" onClick={resetStaffForm}>Hủy</button>}
                </form>
              </div>

              {/* Bảng Danh sách Nhân viên */}
              <div className="document-list-container">
                <table className="inner-table">
                  <thead><tr><th>Tên</th><th>Email</th><th>Phân quyền</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {managingStaffTenant.staff.length === 0 ? <tr><td colSpan="4" className="text-center">Chưa có nhân viên nào</td></tr> : 
                      managingStaffTenant.staff.map(staff => (
                        <tr key={staff.staffId}>
                          <td><strong>{staff.name}</strong></td>
                          <td>{staff.email}</td>
                          <td><span className={`role-badge ${staff.role}`}>{staff.role === 'manager' ? 'Quản lý' : 'Nhân viên'}</span></td>
                          <td className="action-buttons-cell">
                            <button className="btn-icon edit" onClick={() => handleEditStaffClick(staff)}>✏️</button>
                            <button className="btn-icon delete" onClick={() => handleDeleteStaff(staff.staffId, staff.name)}>🗑️</button>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SystemAdminDashboard;