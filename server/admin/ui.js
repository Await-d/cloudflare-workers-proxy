/**
 * Cloudflare Workers 代理服务服务端
 * 管理界面UI - 渲染管理界面
 */

/**
 * 渲染管理界面
 * @param {Request} request 请求对象
 * @returns {Promise<Response>} 管理界面响应
 */
export async function renderAdminUI(request) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>代理服务管理</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8f9fa;
      line-height: 1.6;
    }
    
    .header {
      background-color: #0070f3;
      color: white;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header h1 {
      font-size: 1.5rem;
    }
    
    .logout-btn {
      background-color: rgba(255,255,255,0.2);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    
    .logout-btn:hover {
      background-color: rgba(255,255,255,0.3);
    }
    
    .container {
      max-width: 1200px;
      margin: 2rem auto;
      padding: 0 2rem;
    }
    
    .card {
      background-color: white;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
      overflow: hidden;
    }
    
    .card-header {
      background-color: #f8f9fa;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .card-body {
      padding: 1.5rem;
    }
    
    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.9rem;
      text-decoration: none;
      display: inline-block;
      text-align: center;
    }
    
    .btn-primary {
      background-color: #0070f3;
      color: white;
    }
    
    .btn-primary:hover {
      background-color: #0051cc;
    }
    
    .btn-danger {
      background-color: #dc3545;
      color: white;
    }
    
    .btn-danger:hover {
      background-color: #c82333;
    }
    
    .btn-secondary {
      background-color: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover {
      background-color: #545b62;
    }
    
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .table th,
    .table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    
    .table th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    
    .table tr:hover {
      background-color: #f8f9fa;
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      color: #555;
      font-weight: 500;
    }
    
    .form-control {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 1rem;
    }
    
    .form-control:focus {
      outline: none;
      border-color: #0070f3;
      box-shadow: 0 0 0 2px rgba(0,112,243,0.2);
    }
    
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.5);
      z-index: 1000;
    }
    
    .modal-content {
      background-color: white;
      margin: 5% auto;
      padding: 0;
      border-radius: 5px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .modal-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-body {
      padding: 1.5rem;
    }
    
    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid #dee2e6;
      text-align: right;
    }
    
    .close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #aaa;
    }
    
    .close:hover {
      color: #000;
    }
    
    .alert {
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-radius: 3px;
    }
    
    .alert-success {
      background-color: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
    }
    
    .alert-danger {
      background-color: #f8d7da;
      border: 1px solid #f5c6cb;
      color: #721c24;
    }
    
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #6c757d;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>代理服务管理</h1>
    <button class="logout-btn" onclick="logout()">退出登录</button>
  </div>
  
  <div class="container">
    <div class="card">
      <div class="card-header">
        <h3>服务配置</h3>
        <button class="btn btn-primary" onclick="openAddModal()">添加服务</button>
      </div>
      <div class="card-body">
        <div id="loading" style="text-align: center; padding: 2rem;">
          加载中...
        </div>
        <div id="services-table" style="display: none;">
          <table class="table">
            <thead>
              <tr>
                <th>服务标识</th>
                <th>代理URL</th>
                <th>更新间隔</th>
                <th>最后更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="services-tbody">
            </tbody>
          </table>
        </div>
        <div id="empty-state" class="empty-state" style="display: none;">
          <p>暂无服务配置</p>
          <button class="btn btn-primary" onclick="openAddModal()">添加第一个服务</button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 添加/编辑服务模态框 -->
  <div id="service-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h4 id="modal-title">添加服务</h4>
        <button class="close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div id="modal-alert" style="display: none;"></div>
        <form id="service-form">
          <div class="form-group">
            <label for="service-key">服务标识</label>
            <input type="text" id="service-key" class="form-control" required>
          </div>
          <div class="form-group">
            <label for="proxy-url">代理URL</label>
            <input type="url" id="proxy-url" class="form-control" required>
          </div>
          <div class="form-group">
            <label for="update-interval">更新间隔(秒)</label>
            <input type="number" id="update-interval" class="form-control" value="3600" min="60">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="button" class="btn btn-primary" onclick="saveService()">保存</button>
      </div>
    </div>
  </div>

  <script>
    let currentEditingKey = null;
    let adminKey = localStorage.getItem('adminKey');
    
    // 检查登录状态
    if (!adminKey) {
      window.location.href = '/admin/login';
    }
    
    // 页面加载时获取服务列表
    document.addEventListener('DOMContentLoaded', loadServices);
    
    async function loadServices() {
      try {
        const response = await fetch('/admin/api/services', {
          headers: {
            'Authorization': \`Bearer \${adminKey}\`
          }
        });
        
        if (response.status === 401 || response.status === 403) {
          window.location.href = '/admin/login';
          return;
        }
        
        if (!response.ok) {
          throw new Error('获取服务列表失败');
        }
        
        const data = await response.json();
        displayServices(data.services);
      } catch (error) {
        console.error('加载服务列表错误:', error);
        showAlert('加载服务列表失败', 'danger');
      } finally {
        document.getElementById('loading').style.display = 'none';
      }
    }
    
    function displayServices(services) {
      const tbody = document.getElementById('services-tbody');
      const table = document.getElementById('services-table');
      const emptyState = document.getElementById('empty-state');
      
      if (services.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block';
        return;
      }
      
      tbody.innerHTML = '';
      services.forEach(service => {
        const row = document.createElement('tr');
        row.innerHTML = \`
          <td>\${service.key}</td>
          <td>\${service.proxyURL}</td>
          <td>\${service.updateInterval}秒</td>
          <td>\${service.lastUpdated ? new Date(service.lastUpdated).toLocaleString() : '未知'}</td>
          <td>
            <button class="btn btn-secondary" onclick="editService('\${service.key}')">编辑</button>
            <button class="btn btn-danger" onclick="deleteService('\${service.key}')">删除</button>
          </td>
        \`;
        tbody.appendChild(row);
      });
      
      table.style.display = 'block';
      emptyState.style.display = 'none';
    }
    
    function openAddModal() {
      currentEditingKey = null;
      document.getElementById('modal-title').textContent = '添加服务';
      document.getElementById('service-form').reset();
      document.getElementById('service-key').disabled = false;
      document.getElementById('service-modal').style.display = 'block';
    }
    
    async function editService(key) {
      try {
        const response = await fetch(\`/admin/api/service?key=\${encodeURIComponent(key)}\`, {
          headers: {
            'Authorization': \`Bearer \${adminKey}\`
          }
        });
        
        if (!response.ok) {
          throw new Error('获取服务配置失败');
        }
        
        const service = await response.json();
        
        currentEditingKey = key;
        document.getElementById('modal-title').textContent = '编辑服务';
        document.getElementById('service-key').value = service.key;
        document.getElementById('service-key').disabled = true;
        document.getElementById('proxy-url').value = service.proxyURL;
        document.getElementById('update-interval').value = service.updateInterval;
        document.getElementById('service-modal').style.display = 'block';
      } catch (error) {
        console.error('编辑服务错误:', error);
        showAlert('获取服务配置失败', 'danger');
      }
    }
    
    async function saveService() {
      const form = document.getElementById('service-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      
      const serviceData = {
        key: document.getElementById('service-key').value.trim(),
        proxyURL: document.getElementById('proxy-url').value.trim(),
        updateInterval: parseInt(document.getElementById('update-interval').value, 10)
      };
      
      try {
        const response = await fetch('/admin/api/service', {
          method: currentEditingKey ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${adminKey}\`
          },
          body: JSON.stringify(serviceData)
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(error);
        }
        
        closeModal();
        showAlert(\`服务\${currentEditingKey ? '更新' : '添加'}成功\`, 'success');
        await loadServices();
      } catch (error) {
        console.error('保存服务错误:', error);
        showModalAlert(error.message, 'danger');
      }
    }
    
    async function deleteService(key) {
      if (!confirm(\`确定要删除服务 "\${key}" 吗？\`)) {
        return;
      }
      
      try {
        const response = await fetch(\`/admin/api/service?key=\${encodeURIComponent(key)}\`, {
          method: 'DELETE',
          headers: {
            'Authorization': \`Bearer \${adminKey}\`
          }
        });
        
        if (!response.ok) {
          throw new Error('删除服务失败');
        }
        
        showAlert('服务删除成功', 'success');
        await loadServices();
      } catch (error) {
        console.error('删除服务错误:', error);
        showAlert('删除服务失败', 'danger');
      }
    }
    
    function closeModal() {
      document.getElementById('service-modal').style.display = 'none';
      document.getElementById('modal-alert').style.display = 'none';
    }
    
    function logout() {
      localStorage.removeItem('adminKey');
      window.location.href = '/admin/login';
    }
    
    function showAlert(message, type) {
      // 创建并显示页面级别的提示
      const alertDiv = document.createElement('div');
      alertDiv.className = \`alert alert-\${type}\`;
      alertDiv.textContent = message;
      
      const container = document.querySelector('.container');
      container.insertBefore(alertDiv, container.firstChild);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
    
    function showModalAlert(message, type) {
      const alertDiv = document.getElementById('modal-alert');
      alertDiv.className = \`alert alert-\${type}\`;
      alertDiv.textContent = message;
      alertDiv.style.display = 'block';
    }
  </script>
</body>
</html>
  `;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html;charset=UTF-8'
        }
    });
}