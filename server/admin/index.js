/**
 * Cloudflare Workers 代理服务服务端
 * 管理界面入口 - 处理管理界面请求
 */

import {
  validateAdminAuthorization
} from '../auth.js';
import {
  renderAdminUI
} from './ui.js';
import {
  handleAdminAPI
} from './api.js';

/**
 * 处理管理界面请求
 * @param {Request} request 请求对象
 * @returns {Promise<Response>} 响应
 */
export async function handleAdminInterface(request) {
  const url = new URL(request.url);

  // 处理管理API请求
  if (url.pathname.startsWith('/admin/api/')) {
    return await handleAdminAPI(request);
  }

  // 处理登录页面
  if (url.pathname === '/admin/login') {
    return renderLoginPage();
  }

  // 如果是管理页面，需要验证授权
  if (url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname.startsWith('/admin/')) {
    // 创建一个新的请求对象，包含可能的认证信息
    const authRequest = await createAuthenticatedRequest(request);
    const authResult = await validateAdminAuthorization(authRequest);

    if (!authResult.isValid) {
      // 未授权，重定向到登录页面
      return Response.redirect(`${url.origin}/admin/login`, 302);
    }

    // 授权通过，渲染管理界面
    return await renderAdminUI(request);
  }

  // 首页重定向到管理页面
  if (url.pathname === '/' || url.pathname === '') {
    return Response.redirect(`${url.origin}/admin`, 302);
  }

  // 其他路径返回404
  return new Response('Not Found', {
    status: 404
  });
}

/**
 * 创建带认证信息的请求对象
 * @param {Request} request 原始请求
 * @returns {Promise<Request>} 带认证信息的请求
 */
async function createAuthenticatedRequest(request) {
  const url = new URL(request.url);

  // 首先检查是否已有Authorization头
  if (request.headers.get('Authorization')) {
    return request;
  }

  // 检查URL参数中的token
  const tokenFromURL = url.searchParams.get('token');
  if (tokenFromURL) {
    const newHeaders = new Headers(request.headers);
    newHeaders.set('Authorization', `Bearer ${tokenFromURL}`);
    return new Request(request.url, {
      method: request.method,
      headers: newHeaders,
      body: request.body
    });
  }

  // 检查Cookie中的token
  const cookies = request.headers.get('Cookie') || '';
  const tokenMatch = cookies.match(/adminToken=([^;]+)/);
  if (tokenMatch) {
    const newHeaders = new Headers(request.headers);
    newHeaders.set('Authorization', `Bearer ${tokenMatch[1]}`);
    return new Request(request.url, {
      method: request.method,
      headers: newHeaders,
      body: request.body
    });
  }

  return request;
}

/**
 * 渲染登录页面
 * @returns {Response} 登录页面响应
 */
function renderLoginPage() {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>代理服务管理 - 登录</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8f9fa;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .login-container {
      background-color: white;
      padding: 2rem;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      width: 350px;
    }
    h1 {
      margin-top: 0;
      color: #333;
      text-align: center;
    }
    .input-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #555;
    }
    input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background-color: #0070f3;
      color: white;
      border: none;
      border-radius: 3px;
      font-size: 1rem;
      cursor: pointer;
      margin-top: 1rem;
    }
    button:hover {
      background-color: #0051cc;
    }
    .error {
      color: #e00;
      margin-top: 1rem;
      text-align: center;
    }
    .success {
      color: #0a0;
      margin-top: 1rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>代理服务管理</h1>
    <form id="login-form">
      <div class="input-group">
        <label for="admin-key">管理员密钥</label>
        <input type="password" id="admin-key" name="adminKey" required>
      </div>
      <div id="error-message" class="error" style="display: none;"></div>
      <div id="success-message" class="success" style="display: none;"></div>
      <button type="submit" id="login-btn">登录</button>
    </form>
  </div>

  <script>
    // 检查是否已经登录
    window.addEventListener('load', () => {
      const savedToken = localStorage.getItem('adminKey');
      if (savedToken) {
        // 尝试自动登录
        checkAuthAndRedirect(savedToken);
      }
    });

    async function checkAuthAndRedirect(token) {
      try {
        const response = await fetch('/admin/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${token}\`
          }
        });
        
        if (response.ok) {
          // 设置Cookie并跳转
          document.cookie = \`adminToken=\${token}; path=/; max-age=86400\`; // 24小时
          window.location.href = '/admin?token=' + encodeURIComponent(token);
        }
      } catch (error) {
        console.error('Auto login failed:', error);
        // 清除无效的token
        localStorage.removeItem('adminKey');
      }
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const adminKey = document.getElementById('admin-key').value.trim();
      const errorMessage = document.getElementById('error-message');
      const successMessage = document.getElementById('success-message');
      const loginBtn = document.getElementById('login-btn');
      
      // 清除之前的消息
      errorMessage.style.display = 'none';
      successMessage.style.display = 'none';
      
      if (!adminKey) {
        errorMessage.textContent = '请输入管理员密钥';
        errorMessage.style.display = 'block';
        return;
      }
      
      // 显示加载状态
      loginBtn.textContent = '登录中...';
      loginBtn.disabled = true;
      
      try {
        // 验证密钥
        const response = await fetch('/admin/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${adminKey}\`
          }
        });
        
        if (response.ok) {
          // 登录成功
          successMessage.textContent = '登录成功，正在跳转...';
          successMessage.style.display = 'block';
          
          // 保存凭证
          localStorage.setItem('adminKey', adminKey);
          document.cookie = \`adminToken=\${adminKey}; path=/; max-age=86400\`; // 24小时
          
          // 跳转到管理页面
          setTimeout(() => {
            window.location.href = '/admin?token=' + encodeURIComponent(adminKey);
          }, 1000);
        } else {
          // 登录失败
          errorMessage.textContent = '管理员密钥无效';
          errorMessage.style.display = 'block';
        }
      } catch (error) {
        errorMessage.textContent = '登录请求失败，请重试';
        errorMessage.style.display = 'block';
        console.error('Login error:', error);
      } finally {
        // 恢复按钮状态
        loginBtn.textContent = '登录';
        loginBtn.disabled = false;
      }
    });
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