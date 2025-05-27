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
        const authResult = await validateAdminAuthorization(request);
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
      <button type="submit">登录</button>
    </form>
  </div>

  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const adminKey = document.getElementById('admin-key').value.trim();
      const errorMessage = document.getElementById('error-message');
      
      if (!adminKey) {
        errorMessage.textContent = '请输入管理员密钥';
        errorMessage.style.display = 'block';
        return;
      }
      
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
          // 登录成功，保存凭证并跳转
          localStorage.setItem('adminKey', adminKey);
          window.location.href = '/admin';
        } else {
          // 登录失败
          errorMessage.textContent = '管理员密钥无效';
          errorMessage.style.display = 'block';
        }
      } catch (error) {
        errorMessage.textContent = '登录请求失败，请重试';
        errorMessage.style.display = 'block';
        console.error('Login error:', error);
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