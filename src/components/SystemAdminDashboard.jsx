

// export default SystemAdminDashboard;
import React, { useState, useEffect } from 'react';
import './SystemAdminDashboard.css';
import { ApiService } from '../services/ApiService'; // Import API Service

const SystemAdminDashboard = () => {
  // ==========================================
  // 1. STATE CHÍNH
  // ==========================================
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // State cho Form Tenant
  const [formData, setFormData] = useState({ name: '', description: '', api_key: '' });
  const [editingId, setEditingId] = useState(null);

  // State cho Modal Dữ liệu RAG
  const [managingTenant, setManagingTenant] = useState(null); 
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);


// State cho Modal Khách hàng (Người truy cập)
  const [viewingUsersTenant, setViewingUsersTenant] = useState(null);
  const [tenantUsers, setTenantUsers] = useState([]); // Chứa danh sách khách hàng lấy từ API
  const [loadingUsers, setLoadingUsers] = useState(false); // Hiệu ứng loading khi chờ API

  // ==========================================
  // 2. GỌI API THÔNG QUA ApiService
  // ==========================================
  useEffect(() => {
    fetchTenants();
  }, []);

const fetchTenants = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getTenants();
      
      // Đọc lịch sử File và Nhân viên đã lưu trong LocalStorage
      const savedDocs = JSON.parse(localStorage.getItem('ragDocuments') || '{}');
      const savedStaff = JSON.parse(localStorage.getItem('tenantStaff') || '{}');
      
      const processedData = data.map(tenant => ({
        ...tenant,
        // Nếu trong LocalStorage có data của tenant này thì lấy ra, không thì mảng rỗng []
        documents: savedDocs[tenant.id] || [], 
        staff: savedStaff[tenant.id] || []     
      }));
      setTenants(processedData);
    } catch (error) {
      console.error(error);
      alert("Không thể kết nối đến Backend: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.description || !formData.api_key) return alert("Vui lòng điền đủ thông tin!");

    try {
      if (editingId) {
        // --- CẬP NHẬT (GỌI QUA SERVICE) ---
        const tenantToUpdate = tenants.find(t => t.id === editingId);
        const payload = {
          name: formData.name,
          description: formData.description,
          api_key: formData.api_key,
          is_active: tenantToUpdate.is_active
        };

        const updatedData = await ApiService.updateTenant(editingId, payload);
        setTenants(tenants.map(t => t.id === editingId ? { ...t, ...updatedData } : t));
        alert("Cập nhật thành công!");

      } else {
        // --- TẠO MỚI (GỌI QUA SERVICE) ---
        const payload = {
          name: formData.name,
          description: formData.description,
          api_key: formData.api_key
        };

        const newData = await ApiService.createTenant(payload);
        setTenants([...tenants, { ...newData, documents: [], staff: [] }]);
        alert("Tạo mới thành công!");
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const toggleActiveStatus = async (id) => {
    const tenant = tenants.find(t => t.id === id);
    const newStatus = !tenant.is_active;

    try {
      // --- ĐỔI TRẠNG THÁI (GỌI QUA SERVICE) ---
      await ApiService.updateTenant(id, {
        name: tenant.name,
        description: tenant.description,
        api_key: tenant.api_key,
        is_active: newStatus
      });
      setTenants(tenants.map(t => t.id === id ? { ...t, is_active: newStatus } : t));
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  // Nút Sửa
  const handleEditClick = (tenant) => {
    setFormData({ name: tenant.name, description: tenant.description, api_key: tenant.api_key });
    setEditingId(tenant.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => { setFormData({ name: '', description: '', api_key: '' }); setEditingId(null); };

  // XÓA (Giữ nguyên Mock Data)
 const handleDeleteClick = async (id, name) => {
    const isConfirm = window.confirm(`⚠️ Bạn chắc chắn muốn xóa website: "${name}"?\nToàn bộ dữ liệu RAG và cấu hình sẽ bị mất vĩnh viễn!`);
    
    if (isConfirm) {
      try {
        // GỌI API XÓA THẬT TRÊN DATABASE
        await ApiService.deleteTenant(id);
        
        // Cập nhật lại UI sau khi DB đã xóa thành công
        setTenants(tenants.filter(t => t.id !== id));
        if (editingId === id) resetForm();
        
        alert(`Đã xóa thành công website "${name}"`);
      } catch (error) {
        console.error(error);
        alert("Xóa thất bại: " + error.message);
      }
    }
  };

  // ==========================================
  // 3. CRUD LOCAL CHO FILE RAG & NHÂN VIÊN (Giữ nguyên)
  // ==========================================
  const openDataManager = (tenant) => { setManagingTenant(tenant); setSelectedFile(null); };
  const closeDataManager = () => { setManagingTenant(null); setSelectedFile(null); };

// const handleUploadDocument = async () => {
//     if (!selectedFile) return alert("Vui lòng chọn 1 file!");

//     // Backend yêu cầu file .xlsx
//     if (!selectedFile.name.endsWith(".xlsx")) {
//       return alert("Lỗi: Hệ thống chỉ hỗ trợ định dạng file Excel (.xlsx).");
//     }

//     try {
//       setLoading(true); // Hoặc bạn có thể dùng state isUploading riêng

//       // --- LOG ĐỂ BẠN KIỂM TRA ---
//       console.log(`Bắt đầu Upload cho Website: ${managingTenant.name}`);
//       console.log(`Tenant ID: ${managingTenant.id}`);
//       console.log(`Dùng API Key: ${managingTenant.api_key}`);

//       // GỌI API: Truyền chính xác API Key của web đang được mở Modal
//     const result = await ApiService.uploadExcel(selectedFile, managingTenant.api_key);

//       // --- NẾU THÀNH CÔNG ---
//       // Dựa vào code Python của bạn, backend trả về: { status: "success", rows_embedded: count, tenant_id: tenant_id }
//      alert(`✅ Upload thành công!\nĐã băm và nhúng ${result.rows_embedded} câu hỏi.`);

//       // Cập nhật giao diện ảo (Thêm file vào mảng documents để hiển thị ngay lập tức)
//       const newDoc = { 
//         docId: Date.now(), 
//         filename: selectedFile.name, 
//         size: (selectedFile.size / 1024).toFixed(1) + ' KB', 
//         uploadedAt: new Date().toISOString().split('T')[0] 
//       };
      
//       setTenants(tenants.map(t => {
//         if (t.id === managingTenant.id) { // <-- Gắn file vào đúng ID của Web này trên giao diện
//           const updatedDocs = [...t.documents, newDoc];
//           setManagingTenant({ ...t, documents: updatedDocs });
//           return { ...t, documents: updatedDocs };
//         }
//         return t;
//       }));

//       // Reset ô input file
//       setSelectedFile(null); 
//       document.getElementById("modal-file-upload").value = "";

//     } catch (error) {
//       console.error("Lỗi Upload RAG:", error);
//       alert("Tải lên thất bại: " + error.message);
//     } finally {
//       setLoading(false);
//     }
//   };
const handleUploadDocument = async () => {
    if (!selectedFile) return alert("Vui lòng chọn 1 file!");
    
    // (Tuỳ chọn) Validate file excel
    // if (!selectedFile.name.endsWith(".xlsx")) return alert("Chỉ hỗ trợ file .xlsx");

    try {
      // Gọi API Upload (Chạy thật xuống Backend)
      const result = await ApiService.uploadExcel(selectedFile, managingTenant.api_key);
      alert(`✅ Upload thành công!\nĐã băm và nhúng ${result.rows_embedded} câu hỏi.`);
      
      // Tạo cục data ảo để hiển thị trên UI
      const newDoc = { 
        docId: Date.now(), 
        filename: selectedFile.name, 
        size: (selectedFile.size / 1024).toFixed(1) + ' KB', 
        uploadedAt: new Date().toISOString().split('T')[0] 
      };
      
      setTenants(tenants.map(t => {
        if (t.id === managingTenant.id) {
          const updatedDocs = [...t.documents, newDoc];
          
          // LƯU VÀO LOCAL STORAGE
          const savedDocs = JSON.parse(localStorage.getItem('ragDocuments') || '{}');
          savedDocs[t.id] = updatedDocs;
          localStorage.setItem('ragDocuments', JSON.stringify(savedDocs));

          setManagingTenant({ ...t, documents: updatedDocs });
          return { ...t, documents: updatedDocs };
        }
        return t;
      }));

      setSelectedFile(null); 
      document.getElementById("modal-file-upload").value = "";

    } catch (error) {
      alert("Tải lên thất bại: " + error.message);
    }
  };

const handleClearAllData = async () => {
    if (window.confirm(`⚠️ BẠN CÓ CHẮC CHẮN?\n\nHành động này sẽ xóa TOÀN BỘ kiến thức của AI trên Website "${managingTenant.name}". AI sẽ không thể trả lời câu hỏi cho đến khi bạn upload file mới!`)) {
      try {
        // GỌI API BACKEND XÓA THẬT TRONG DATABASE
        const result = await ApiService.clearRagData(managingTenant.api_key);
        alert(`✅ ${result.message}`);

        // Cập nhật lại UI (Làm rỗng danh sách File ảo)
        setTenants(tenants.map(t => {
          if (t.id === managingTenant.id) {
            // XÓA LOCAL STORAGE
            const savedDocs = JSON.parse(localStorage.getItem('ragDocuments') || '{}');
            savedDocs[t.id] = []; 
            localStorage.setItem('ragDocuments', JSON.stringify(savedDocs));

            // Đưa mảng documents về rỗng
            setManagingTenant({ ...t, documents: [] });
            return { ...t, documents: [] };
          }
          return t;
        }));

      } catch (error) {
        alert("Xóa thất bại: " + error.message);
      }
    }
  };


  const closeStaffManager = () => { setManagingStaffTenant(null); resetStaffForm(); };
  const handleStaffInputChange = (e) => setStaffFormData({ ...staffFormData, [e.target.name]: e.target.value });
  const resetStaffForm = () => { setStaffFormData({ name: '', email: '', role: 'staff' }); setEditingStaffId(null); };

 // Mở Modal xem danh sách Khách hàng
  const openUserManager = async (tenant) => {
    setViewingUsersTenant(tenant); // Mở Modal lên ngay lập tức
    setLoadingUsers(true);         // Bật loading
    try {
      // Gọi API lấy danh sách user của Tenant này
      const usersData = await ApiService.getTenantUsers(tenant.api_key);
      setTenantUsers(usersData);
    } catch (error) {
      console.error(error);
      alert("Không thể tải danh sách khách hàng: " + error.message);
      setTenantUsers([]); // Lỗi thì gán mảng rỗng
    } finally {
      setLoadingUsers(false);
    }
  };

  // Đóng Modal
  const closeUserManager = () => {
    setViewingUsersTenant(null);
    setTenantUsers([]);
  };

  const handleEditStaffClick = (staff) => { setStaffFormData({ name: staff.name, email: staff.email, role: staff.role }); setEditingStaffId(staff.staffId); };
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
  // GIAO DIỆN
  // ==========================================
  return (
    <div className="system-admin-dashboard">
      <h2>🛠️ Quản Trị Hệ Thống (Multi-Tenant)</h2>
      
      {/* FORM */}
      <div className={`admin-card ${editingId ? 'editing-mode' : ''}`}>
        <h3>{editingId ? '✏️ Cập Nhật Thông Tin Website' : '➕ Thêm Website / Tenant Mới'}</h3>
        <form onSubmit={handleSubmit} className="admin-form">
          <input type="text" name="name" placeholder="Tên Tenant" value={formData.name} onChange={handleInputChange} disabled={loading}/>
          <input type="text" name="description" placeholder="Mô tả" value={formData.description} onChange={handleInputChange} disabled={loading}/>
          <input type="text" name="api_key" placeholder="API Key" value={formData.api_key} onChange={handleInputChange} disabled={loading}/>
          <div className="form-actions">
            <button type="submit" className={editingId ? "btn-update" : "btn-submit"} disabled={loading}>
              {loading ? 'Đang xử lý...' : (editingId ? 'Cập Nhật' : 'Thêm Mới')}
            </button>
            {editingId && <button type="button" className="btn-cancel" onClick={resetForm} disabled={loading}>Hủy</button>}
          </div>
        </form>
      </div>

      {/* BẢNG */}
      <div className="admin-card">
        <h3>Danh Sách DB: `public.tenants`</h3>
        <div className="table-responsive">
          <table className="web-list-table">
            <thead>
              <tr><th>ID</th><th>Website</th><th>Mô tả</th><th>API Key</th><th>Trạng thái</th><th>Thao tác DB</th><th>Cấu hình Ứng dụng</th></tr>
            </thead>
            <tbody>
              {loading && tenants.length === 0 ? (
                <tr><td colSpan="7" className="text-center">⏳ Đang tải dữ liệu từ Server...</td></tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id} className={!tenant.is_active ? 'inactive-row' : ''}>
                    <td>{tenant.id}</td><td><strong>{tenant.name}</strong></td><td>{tenant.description}</td><td><code className="api-key">{tenant.api_key}</code></td>
                    <td><span className={`status-badge ${tenant.is_active ? 'active' : 'inactive'}`} onClick={() => toggleActiveStatus(tenant.id)}>{tenant.is_active ? 'Hoạt động' : 'Đã khóa'}</span></td>
                    <td className="action-buttons-cell">
                      <button onClick={() => handleEditClick(tenant)} className="btn-icon edit" title="Sửa Web">✏️</button>
                      <button onClick={() => handleDeleteClick(tenant.id, tenant.name)} className="btn-icon delete" title="Xóa Web">🗑️</button>
                    </td>
                    <td className="app-config-cell">
                      <button className="btn-manage-data" onClick={() => openDataManager(tenant)} disabled={!tenant.is_active}>
                        📂 File RAG ({tenant.documents?.length || 0})
                      </button>
                      {/* ĐỔI TÊN NÚT VÀ HÀM ONCLICK Ở ĐÂY */}
                      <button className="btn-manage-staff" onClick={() => openUserManager(tenant)} disabled={!tenant.is_active}>
                        👥 Khách hàng
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!loading && tenants.length === 0 && <tr><td colSpan="7" className="text-center">Chưa có website nào trong Database.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Dữ liệu RAG */}
      {managingTenant && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>📂 Dữ liệu RAG: <span>{managingTenant.name}</span></h3><button className="btn-close-modal" onClick={closeDataManager}>✖</button></div>
            <div className="modal-body">
              <div className="upload-zone"><input id="modal-file-upload" type="file" accept=".pdf, .xlsx, .csv, .txt" onChange={(e) => setSelectedFile(e.target.files[0])} /><button 
              className="btn-upload" 
              onClick={handleUploadDocument}
              disabled={isUploading}
              style={{ opacity: isUploading ? 0.7 : 1, cursor: isUploading ? 'wait' : 'pointer' }}
            >
              {isUploading ? '⏳ Đang xử lý AI...' : '⬆️ Upload & Nhúng File'}
            </button></div>
<div className="document-list-container">
                {/* --- NÚT MỚI: XÓA TOÀN BỘ --- */}
                {managingTenant.documents.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0 }}>Danh sách File đã học</h4>
                    <button 
                      onClick={handleClearAllData} 
                      style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      🗑️ Xóa sạch dữ liệu AI
                    </button>
                  </div>
                )}

                <table className="inner-table">
                  <thead><tr><th>Tên File ảo</th><th>Size</th><th>Ngày Upload</th></tr></thead>
                  <tbody>
                    {managingTenant.documents.length === 0 ? 
                      <tr><td colSpan="3" className="text-center">Chưa có dữ liệu nào. Hãy upload file Excel.</td></tr> 
                    : 
                      managingTenant.documents.map(doc => (
                        <tr key={doc.docId}>
                          <td>📄 {doc.filename}</td>
                          <td>{doc.size}</td>
                          <td>{doc.uploadedAt}</td>
                          {/* Đã gỡ bỏ cột nút "Xóa" ở từng dòng vì DB đã clear toàn bộ */}
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

      {/* MODAL 2: Nhân viên */}
{/* ========================================== */}
      {/* MODAL 2: XEM DANH SÁCH NGƯỜI TRUY CẬP        */}
      {/* ========================================== */}
      {viewingUsersTenant && (
        <div className="modal-overlay">
          <div className="modal-content modal-large">
            <div className="modal-header">
              <h3>👥 Người truy cập Website: <span>{viewingUsersTenant.name}</span></h3>
              <button className="btn-close-modal" onClick={closeUserManager}>✖</button>
            </div>
            
            <div className="modal-body">
              <div className="document-list-container">
                <table className="inner-table">
                  <thead>
                    <tr>
                      <th>ID / Anonymous ID</th>
                      <th>Tên Khách hàng</th>
                      <th>Email / Liên hệ</th>
                      <th>Ngày truy cập</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* NẾU ĐANG CALL API */}
                    {loadingUsers && (
                      <tr><td colSpan="4" className="text-center">⏳ Đang tải dữ liệu khách hàng từ Server...</td></tr>
                    )}
                    
                    {/* NẾU GỌI XONG NHƯNG KHÔNG CÓ AI */}
                    {!loadingUsers && tenantUsers.length === 0 && (
                      <tr><td colSpan="4" className="text-center">Chưa có ai truy cập / nhắn tin với Website này.</td></tr>
                    )}
                    
                    {/* NẾU CÓ DỮ LIỆU (Tên trường map theo DB FastAPI của bạn) */}
                    {!loadingUsers && tenantUsers.length > 0 && tenantUsers.map(user => (
                      <tr key={user.id || user.anonymous_id}>
                        <td><code style={{background: '#eee', padding: '2px 6px', borderRadius: '4px'}}>{user.anonymous_id || user.id}</code></td>
                        <td><strong>{user.name || "Khách Vô Danh"}</strong></td>
                        <td>{user.email || user.phone || "Chưa cung cấp"}</td>
                        <td>{user.created_at ? new Date(user.created_at).toLocaleString('vi-VN') : "N/A"}</td>
                      </tr>
                    ))}
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