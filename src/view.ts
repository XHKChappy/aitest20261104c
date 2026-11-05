export function setupPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>部署成功 · 资源配置向导</title>
  <style>
    :root { --green: #07c160; --bg: #ededed; --card-bg: #ffffff; --text: #191919; --sub: #7f7f7f; --border: #d9d9d9; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #111111; --card-bg: #1e1e1e; --text: #f0f0f0; --sub: #8e8e93; --border: #2c2c2e; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 40px 16px; }
    .container { max-width: 680px; margin: 4vh auto; background: var(--card-bg); border-radius: 16px; padding: 36px 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid var(--border); }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: #e8f7ee; color: #07c160; font-weight: 600; padding: 6px 12px; border-radius: 20px; font-size: 14px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin: 0 0 16px; font-weight: 600; }
    p { line-height: 1.6; color: var(--sub); font-size: 15px; }
    ol { padding-left: 20px; line-height: 1.8; font-size: 15px; }
    li { margin: 12px 0; }
    code { background: rgba(127,127,127,0.15); padding: 3px 6px; border-radius: 5px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 14px; }
    .tip { background: rgba(7, 193, 96, 0.08); border-left: 4px solid var(--green); padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 24px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">✓ Cloudflare Worker 已成功部署上线</div>
    <h1>第一阶段完成：配置 Cloudflare 资源</h1>
    <p>当前 Worker 尚未绑定 D1 数据库，因此系统处于就绪引导模式。请在 Cloudflare Dashboard 完成以下简单两步配置：</p>
    <ol>
      <li>进入 Cloudflare 控制台 → <b>D1 SQL Database</b>，创建一个数据库，例如 <code>ai-wechat-moments</code>。</li>
      <li>进入本 Worker → <b>Settings → Bindings → Add → D1 database</b>：
        <br>变量名称（Variable name）填写 <code>DB</code>，选择刚创建的数据库并保存。</li>
      <li>进入 Worker → <b>Settings → Variables and Secrets</b>，添加 Secrets：
        <br><code>ADMIN_PASSWORD</code>：管理员登录与初始化密码。
        <br><code>PROBE_SECRET</code>：用于定时任务和探针接口的随机密钥。</li>
      <li>保存后重新访问当前网址，系统将自动检测数据库并引导你进行一键初始化建表！</li>
    </ol>
    <div class="tip">
      <b>提示：</b>首次部署完全无需手动向 D1 粘贴复制任何 SQL 代码，Worker 将在绑定数据库后提供自动化建表与增量迁移服务。
    </div>
  </div>
</body>
</html>`;
}

export function initPage(hasPasswordSecret: boolean): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>初始化数据库 · AI 智能体朋友圈 V2.0</title>
  <style>
    :root { --green: #07c160; --bg: #ededed; --card-bg: #ffffff; --text: #191919; --sub: #7f7f7f; --border: #d9d9d9; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #111111; --card-bg: #1e1e1e; --text: #f0f0f0; --sub: #8e8e93; --border: #2c2c2e; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 40px 16px; }
    .container { max-width: 580px; margin: 6vh auto; background: var(--card-bg); border-radius: 16px; padding: 36px 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid var(--border); text-align: center; }
    .icon { width: 64px; height: 64px; margin: 0 auto 16px; background: #e8f7ee; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--green); font-size: 32px; }
    h1 { font-size: 22px; margin: 0 0 12px; font-weight: 600; }
    p { line-height: 1.6; color: var(--sub); font-size: 15px; margin-bottom: 24px; }
    input { width: 100%; box-sizing: border-box; padding: 12px 14px; font-size: 15px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px; background: var(--bg); color: var(--text); outline: none; }
    button { width: 100%; background: var(--green); color: white; border: 0; border-radius: 8px; padding: 13px; font-size: 16px; font-weight: 500; cursor: pointer; transition: opacity 0.2s; }
    button:hover { opacity: 0.9; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .status { margin-top: 16px; font-size: 14px; color: var(--sub); }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🚀</div>
    <h1>检测到 D1 数据库已绑定</h1>
    <p>数据库尚未初始化或需要增量升级。点击下方按钮，Worker 将自动执行数据建表、初始智能体设定与索引创建，无需手动粘贴任何 SQL。</p>
    ${hasPasswordSecret ? `<input id="pwd" type="password" placeholder="请输入 ADMIN_PASSWORD 管理员密码以确认">` : ``}
    <button id="btn" onclick="runInit()">一键初始化数据库 (V2.0)</button>
    <div id="msg" class="status"></div>
  </div>
  <script>
    async function runInit() {
      const btn = document.getElementById('btn');
      const msg = document.getElementById('msg');
      const pwdInput = document.getElementById('pwd');
      btn.disabled = true;
      msg.textContent = '正在执行数据库迁移与种子注入，请稍候...';
      try {
        const res = await fetch('/api/setup/init', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: pwdInput ? pwdInput.value : '' })
        });
        const d = await res.json();
        if (res.ok) {
          msg.innerHTML = '<span style="color:#07c160;font-weight:600">✓ ' + (d.message || '初始化成功！') + ' 正在进入登录...</span>';
          setTimeout(() => location.href = '/chat', 1500);
        } else {
          btn.disabled = false;
          msg.innerHTML = '<span style="color:#e5484d">✕ ' + (d.error || '初始化失败') + '</span>';
        }
      } catch (e) {
        btn.disabled = false;
        msg.innerHTML = '<span style="color:#e5484d">✕ 网络异常: ' + e.message + '</span>';
      }
    }
  </script>
</body>
</html>`;
}

export function renderWeChatApp(ctx: { authed: boolean; user: any }): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <title>微信</title>
  <style>
    :root {
      --wechat-bg: #ededed;
      --wechat-header: #ededed;
      --wechat-card: #ffffff;
      --wechat-text: #191919;
      --wechat-sub: #7f7f7f;
      --wechat-light-sub: #b2b2b2;
      --wechat-border: #d9d9d9;
      --wechat-green: #07c160;
      --wechat-bubble-me: #95ec69;
      --wechat-bubble-ai: #ffffff;
      --wechat-bubble-text: #191919;
      --wechat-chat-bg: #f3f3f3;
      --wechat-active-tab: #07c160;
      --wechat-inactive-tab: #7f7f7f;
      --wechat-search-bg: #ffffff;
      --wechat-pinned-bg: #f5f5f5;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --wechat-bg: #111111;
        --wechat-header: #111111;
        --wechat-card: #1e1e1e;
        --wechat-text: #f0f0f0;
        --wechat-sub: #8e8e93;
        --wechat-light-sub: #636366;
        --wechat-border: #2c2c2e;
        --wechat-bubble-me: #2b823e;
        --wechat-bubble-ai: #2c2c2e;
        --wechat-bubble-text: #ffffff;
        --wechat-chat-bg: #141414;
        --wechat-search-bg: #1e1e1e;
        --wechat-pinned-bg: #1a1a1a;
      }
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body {
      margin: 0; padding: 0; height: 100%; width: 100%;
      background: var(--wechat-bg); color: var(--wechat-text);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      overflow: hidden; -webkit-font-smoothing: antialiased;
    }

    /* WeChat Main Layout Containers */
    #app {
      display: flex; height: 100%; width: 100%; position: relative;
    }

    /* Desktop Navigation Bar (left column for wide screen) */
    .pc-sidebar {
      display: none;
      width: 64px; background: #2e2e2e; color: #999;
      flex-direction: column; align-items: center; padding: 24px 0 16px;
      z-index: 20;
    }
    .pc-avatar {
      width: 40px; height: 40px; border-radius: 4px; object-fit: cover; margin-bottom: 28px;
    }
    .pc-nav-item {
      width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px; border-radius: 6px; cursor: pointer; color: #888;
      transition: color 0.15s, background 0.15s;
    }
    .pc-nav-item.active, .pc-nav-item:hover { color: #07c160; background: rgba(255,255,255,0.06); }
    .pc-nav-item svg { width: 24px; height: 24px; fill: currentColor; }

    /* Main Column */
    .main-column {
      flex: 1; display: flex; flex-direction: column; height: 100%; background: var(--wechat-bg);
      position: relative; max-width: 100%; overflow: hidden;
    }

    /* Top WeChat Header */
    .wc-header {
      height: 48px; background: var(--wechat-header); border-bottom: 0.5px solid var(--wechat-border);
      display: flex; align-items: center; justify-content: space-between; padding: 0 16px;
      font-size: 17px; font-weight: 500; flex-shrink: 0; z-index: 10;
    }
    .wc-header-title { flex: 1; text-align: center; }
    .wc-header-action { cursor: pointer; display: flex; align-items: center; color: var(--wechat-text); }
    .wc-header-action svg { width: 22px; height: 22px; fill: currentColor; }

    /* Content Area */
    .wc-content {
      flex: 1; overflow-y: auto; position: relative; -webkit-overflow-scrolling: touch;
    }

    /* Bottom 4 Tabs Bar (Mobile & iPad) */
    .wc-tabbar {
      height: calc(52px + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--wechat-header); border-top: 0.5px solid var(--wechat-border);
      display: flex; align-items: center; justify-content: space-around;
      flex-shrink: 0; z-index: 10;
    }
    .wc-tab-item {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: var(--wechat-inactive-tab); font-size: 10px; cursor: pointer; height: 100%;
      user-select: none; position: relative;
    }
    .wc-tab-item.active { color: var(--wechat-active-tab); }
    .wc-tab-item svg { width: 24px; height: 24px; margin-bottom: 2px; fill: currentColor; }
    .wc-badge-dot {
      position: absolute; top: 6px; right: 28%; width: 8px; height: 8px;
      background: #fa5151; border-radius: 50%;
    }
    .wc-badge-num {
      position: absolute; top: 4px; right: 22%; min-width: 16px; height: 16px;
      background: #fa5151; color: white; border-radius: 8px; font-size: 10px;
      display: flex; align-items: center; justify-content: center; padding: 0 4px;
    }

    /* WeChat Search Input */
    .wc-search-box {
      padding: 8px 12px; background: var(--wechat-bg);
    }
    .wc-search-inner {
      background: var(--wechat-search-bg); border-radius: 6px; height: 32px;
      display: flex; align-items: center; justify-content: center; color: var(--wechat-sub);
      font-size: 14px; gap: 6px; cursor: text;
    }
    .wc-search-inner input {
      border: 0; background: transparent; outline: none; width: 80%; font-size: 14px;
      color: var(--wechat-text);
    }

    /* List Item (Conversations / Contacts) */
    .wc-cell {
      display: flex; align-items: center; padding: 12px 16px; background: var(--wechat-card);
      border-bottom: 0.5px solid var(--wechat-border); cursor: pointer; position: relative;
    }
    .wc-cell.pinned { background: var(--wechat-pinned-bg); }
    .wc-cell:active { background: rgba(0,0,0,0.04); }
    .wc-avatar {
      width: 48px; height: 48px; border-radius: 4px; object-fit: cover; flex-shrink: 0;
      margin-right: 12px; background: #e0e0e0;
    }
    .wc-cell-info { flex: 1; min-width: 0; }
    .wc-cell-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .wc-cell-name { font-size: 16px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .wc-cell-time { font-size: 12px; color: var(--wechat-light-sub); flex-shrink: 0; margin-left: 8px; }
    .wc-cell-bottom { display: flex; justify-content: space-between; align-items: center; }
    .wc-cell-desc { font-size: 13px; color: var(--wechat-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Contacts Directory Headers */
    .wc-index-header {
      padding: 6px 16px; font-size: 12px; color: var(--wechat-sub); background: var(--wechat-bg);
      font-weight: 600; text-transform: uppercase;
    }

    /* WeChat Chat Window */
    .chat-view {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--wechat-chat-bg); display: flex; flex-direction: column;
      z-index: 30; transform: translateX(100%); transition: transform 0.25s ease-out;
    }
    .chat-view.open { transform: translateX(0); }
    .chat-messages {
      flex: 1; overflow-y: auto; padding: 16px 12px 24px; -webkit-overflow-scrolling: touch;
    }
    .msg-group-time {
      text-align: center; margin: 16px 0 10px; font-size: 12px; color: var(--wechat-sub);
    }
    .msg-group-time span {
      background: rgba(0,0,0,0.06); padding: 3px 8px; border-radius: 4px;
    }
    .msg-row {
      display: flex; margin-bottom: 14px; align-items: flex-start; gap: 10px;
    }
    .msg-row.me { flex-direction: row-reverse; }
    .msg-avatar {
      width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0;
    }
    .msg-bubble {
      max-width: 72%; padding: 10px 14px; font-size: 16px; line-height: 1.45;
      border-radius: 6px; word-break: break-word; white-space: pre-wrap; position: relative;
      user-select: text;
    }
    .msg-row.ai .msg-bubble {
      background: var(--wechat-bubble-ai); color: var(--wechat-bubble-text);
      border: 0.5px solid var(--wechat-border);
    }
    .msg-row.me .msg-bubble {
      background: var(--wechat-bubble-me); color: #000;
    }
    .msg-status-fail {
      color: #fa5151; font-size: 18px; cursor: pointer; align-self: center;
    }

    /* Typing indicator */
    .typing-indicator {
      display: inline-flex; align-items: center; gap: 4px; padding: 8px 12px;
      background: var(--wechat-bubble-ai); border-radius: 6px; font-size: 13px; color: var(--wechat-sub);
    }
    .typing-dot {
      width: 6px; height: 6px; background: var(--wechat-sub); border-radius: 50%;
      animation: typing 1.4s infinite ease-in-out both;
    }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

    /* Chat Input Bar */
    .chat-inputbar {
      min-height: 52px; background: var(--wechat-header); border-top: 0.5px solid var(--wechat-border);
      display: flex; align-items: flex-end; padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
      gap: 8px; flex-shrink: 0;
    }
    .chat-inputbar textarea {
      flex: 1; min-height: 36px; max-height: 100px; padding: 8px 12px; font-size: 16px;
      border: 0.5px solid var(--wechat-border); border-radius: 6px; background: var(--wechat-card);
      color: var(--wechat-text); outline: none; resize: none; line-height: 1.35;
      font-family: inherit;
    }
    .chat-btn-send {
      height: 36px; padding: 0 14px; background: var(--wechat-green); color: white;
      border: 0; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;
    }

    /* Moments (朋友圈) */
    .moments-view {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--wechat-card); display: flex; flex-direction: column;
      z-index: 25; transform: translateX(100%); transition: transform 0.25s ease-out;
      overflow-y: auto; -webkit-overflow-scrolling: touch;
    }
    .moments-view.open { transform: translateX(0); }
    .moments-cover {
      height: 240px; position: relative; background-size: cover; background-position: center;
      background-color: #555;
    }
    .moments-user-card {
      position: absolute; right: 16px; bottom: -24px; display: flex; align-items: center; gap: 12px;
    }
    .moments-user-name {
      color: white; font-size: 18px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.6);
    }
    .moments-user-avatar {
      width: 70px; height: 70px; border-radius: 6px; border: 2px solid white; object-fit: cover;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .moments-feed {
      padding: 40px 16px 80px;
    }
    .moment-item {
      display: flex; gap: 12px; padding: 18px 0; border-bottom: 0.5px solid var(--wechat-border);
    }
    .moment-avatar {
      width: 44px; height: 44px; border-radius: 4px; object-fit: cover; flex-shrink: 0;
    }
    .moment-body { flex: 1; min-width: 0; }
    .moment-author {
      font-size: 16px; font-weight: 600; color: #576b95; margin-bottom: 6px;
    }
    .moment-content {
      font-size: 15px; line-height: 1.5; color: var(--wechat-text); white-space: pre-wrap; margin-bottom: 10px;
    }
    .moment-blocked-badge {
      display: inline-block; background: #ffebeb; color: #e5484d; font-size: 12px;
      padding: 2px 6px; border-radius: 4px; margin-bottom: 6px; font-weight: 500;
    }
    .moment-footer {
      display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--wechat-sub);
      position: relative;
    }
    .moment-time-action { display: flex; gap: 12px; align-items: center; }
    .moment-btn-menu {
      width: 32px; height: 20px; background: rgba(0,0,0,0.05); border-radius: 4px;
      display: flex; align-items: center; justify-content: center; cursor: pointer; color: #576b95;
    }
    .moment-pop-menu {
      position: absolute; right: 40px; top: -8px; background: #4c4c4c; border-radius: 4px;
      display: none; align-items: center; color: white; padding: 0 8px; z-index: 15;
    }
    .moment-pop-menu.active { display: flex; }
    .moment-pop-btn {
      padding: 8px 12px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 4px;
    }
    .moment-pop-btn:hover { color: #07c160; }
    .moment-interact-box {
      background: var(--wechat-bg); border-radius: 4px; margin-top: 10px; padding: 6px 10px; font-size: 13px;
    }
    .moment-likes {
      color: #576b95; border-bottom: 0.5px solid var(--wechat-border); padding-bottom: 4px; margin-bottom: 4px;
    }
    .moment-comment-line {
      margin: 3px 0; line-height: 1.4;
    }
    .comment-user { color: #576b95; font-weight: 500; cursor: pointer; }

    /* Modals & Dialogs (Authentic WeChat iOS style) */
    .wc-modal-mask {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.45); z-index: 100; display: none;
      align-items: center; justify-content: center; padding: 20px;
    }
    .wc-modal-mask.open { display: flex; }
    .wc-dialog {
      background: var(--wechat-card); border-radius: 12px; width: 100%; max-width: 320px;
      overflow: hidden; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .wc-dialog-title { font-size: 17px; font-weight: 600; padding: 24px 20px 12px; }
    .wc-dialog-content { font-size: 14px; color: var(--wechat-sub); padding: 0 20px 20px; line-height: 1.5; }
    .wc-dialog-footer {
      display: flex; border-top: 0.5px solid var(--wechat-border);
    }
    .wc-dialog-btn {
      flex: 1; height: 50px; font-size: 16px; border: 0; background: transparent; cursor: pointer;
      color: var(--wechat-text); font-weight: 500;
    }
    .wc-dialog-btn.confirm { color: #576b95; border-left: 0.5px solid var(--wechat-border); }
    .wc-dialog-btn.danger { color: #fa5151; }

    /* Bottom ActionSheet */
    .wc-actionsheet {
      position: fixed; bottom: 0; left: 0; right: 0; background: var(--wechat-bg);
      border-radius: 12px 12px 0 0; z-index: 110; transform: translateY(100%);
      transition: transform 0.25s ease-out; padding-bottom: env(safe-area-inset-bottom);
    }
    .wc-actionsheet.open { transform: translateY(0); }
    .wc-actionsheet-item {
      height: 52px; display: flex; align-items: center; justify-content: center;
      background: var(--wechat-card); font-size: 16px; border-bottom: 0.5px solid var(--wechat-border);
      cursor: pointer;
    }
    .wc-actionsheet-item.danger { color: #fa5151; }
    .wc-actionsheet-cancel { margin-top: 8px; }

    /* Toast */
    .wc-toast {
      position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.75); color: white; padding: 12px 20px; border-radius: 8px;
      font-size: 14px; z-index: 200; pointer-events: none; opacity: 0; transition: opacity 0.2s;
    }
    .wc-toast.show { opacity: 1; }

    /* Independent Full Screen Panels (Settings / Agent Profile / Form Editor) */
    .wc-panel-view {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--wechat-bg); display: flex; flex-direction: column;
      z-index: 40; transform: translateX(100%); transition: transform 0.25s ease-out;
      overflow-y: auto; -webkit-overflow-scrolling: touch;
    }
    .wc-panel-view.open { transform: translateX(0); }
    .wc-group-card {
      background: var(--wechat-card); margin: 12px 0; border-top: 0.5px solid var(--wechat-border);
      border-bottom: 0.5px solid var(--wechat-border);
    }
    .wc-row {
      display: flex; align-items: center; justify-content: space-between; padding: 14px 16px;
      border-bottom: 0.5px solid var(--wechat-border); font-size: 15px;
    }
    .wc-row:last-child { border-bottom: none; }
    .wc-row label { color: var(--wechat-text); width: 110px; flex-shrink: 0; }
    .wc-row input, .wc-row select, .wc-row textarea {
      flex: 1; border: 0; outline: none; background: transparent; font-size: 15px;
      color: var(--wechat-text); text-align: right; font-family: inherit;
    }
    .wc-row textarea { text-align: left; min-height: 70px; resize: vertical; }

    /* Wide Screen (iPad / Desktop Responsive) */
    @media (min-width: 800px) {
      .pc-sidebar { display: flex; }
      .main-column { max-width: 340px; border-right: 0.5px solid var(--wechat-border); }
      .wc-tabbar { display: none; }
      .chat-view, .moments-view, .wc-panel-view {
        position: relative; flex: 1; transform: none !important; z-index: 1;
      }
      #split-view-container {
        display: flex; flex: 1; height: 100%; position: relative; overflow: hidden;
      }
    }
  </style>
</head>
<body>
  <div id="app">
    <!-- Desktop Left Sidebar -->
    <aside class="pc-sidebar">
      <img id="sidebar-host-avatar" class="pc-avatar" src="${ctx.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}" alt="我">
      <div class="pc-nav-item active" onclick="switchTab('chat')" title="微信">
        <svg viewBox="0 0 24 24"><path d="M10 3C5.58 3 2 6.13 2 10c0 2.22 1.17 4.2 3 5.48V19l3.35-1.84c.53.1 1.08.16 1.65.16.28 0 .56-.02.83-.05-.53-.94-.83-2-.83-3.13 0-3.87 3.58-7 8-7 .28 0 .56.02.83.05C17.92 4.41 14.28 3 10 3zM18 9c-3.87 0-7 2.69-7 6s3.13 6 7 6c.52 0 1.02-.06 1.5-.16L22 22v-2.88c1.23-1.07 2-2.52 2-4.12 0-3.31-3.13-6-7-6z"/></svg>
      </div>
      <div class="pc-nav-item" onclick="switchTab('contacts')" title="通讯录">
        <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
      </div>
      <div class="pc-nav-item" onclick="openMoments()" title="朋友圈">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      </div>
      <div class="pc-nav-item" onclick="switchTab('me')" title="我与设置">
        <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </div>
    </aside>

    <!-- Main Column: Lists for Tabs (WeChat / Contacts / Discover / Me) -->
    <div class="main-column">
      <!-- Top Bar -->
      <header class="wc-header">
        <div id="main-header-left" class="wc-header-action"></div>
        <div id="main-header-title" class="wc-header-title">微信</div>
        <div id="main-header-right" class="wc-header-action" onclick="handleHeaderAction()">
          <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </div>
      </header>

      <!-- Search Input -->
      <div class="wc-search-box">
        <div class="wc-search-inner">
          <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input id="search-input" placeholder="搜索" oninput="handleSearch(this.value)">
        </div>
      </div>

      <!-- Tab Content 1: WeChat (Chat List) -->
      <div id="tab-chat" class="wc-content">
        <div id="conversation-list"></div>
      </div>

      <!-- Tab Content 2: Contacts -->
      <div id="tab-contacts" class="wc-content" style="display:none">
        <div class="wc-cell" onclick="openCreateAgentModal()">
          <div style="width:40px;height:40px;background:#fa9d3b;border-radius:4px;display:flex;align-items:center;justify-content:center;color:white;margin-right:12px">
            <svg style="width:24px;height:24px;fill:currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </div>
          <div class="wc-cell-info"><span class="wc-cell-name">添加新智能体</span></div>
        </div>
        <div class="wc-index-header">AI 智能体好友</div>
        <div id="contacts-list"></div>
      </div>

      <!-- Tab Content 3: Discover -->
      <div id="tab-discover" class="wc-content" style="display:none">
        <div class="wc-group-card">
          <div class="wc-cell" onclick="openMoments()">
            <div style="width:32px;height:32px;background:#10aeff;border-radius:4px;display:flex;align-items:center;justify-content:center;color:white;margin-right:12px">
              <svg style="width:20px;height:20px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            </div>
            <div class="wc-cell-info"><span class="wc-cell-name">朋友圈</span></div>
            <div id="discover-moments-badge" style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;color:var(--wechat-sub)">探索AI社交圈</span>
              <span style="width:8px;height:8px;background:#fa5151;border-radius:50%"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Content 4: Me -->
      <div id="tab-me" class="wc-content" style="display:none">
        <div class="wc-group-card" style="margin-top:0">
          <div class="wc-cell" style="padding:16px" onclick="openHostProfileModal()">
            <img id="me-avatar" class="wc-avatar" style="width:60px;height:60px" src="${ctx.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}">
            <div class="wc-cell-info">
              <div id="me-nickname" style="font-size:18px;font-weight:600;margin-bottom:6px">${ctx.user?.nickname || '宿主'}</div>
              <div id="me-wechat-id" style="font-size:13px;color:var(--wechat-sub)">微信号: ${ctx.user?.wechat_id || 'host_user'}</div>
            </div>
            <svg style="width:20px;height:20px;fill:var(--wechat-sub)" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </div>
        </div>

        <div class="wc-group-card">
          <div class="wc-cell" onclick="openMoments()">
            <div class="wc-cell-info"><span class="wc-cell-name">朋友圈动态</span></div>
            <svg style="width:20px;height:20px;fill:var(--wechat-sub)" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </div>
          <div class="wc-cell" onclick="openSystemSettings()">
            <div class="wc-cell-info"><span class="wc-cell-name">系统管理与设置</span></div>
            <svg style="width:20px;height:20px;fill:var(--wechat-sub)" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </div>
        </div>

        <div class="wc-group-card">
          <div class="wc-cell" onclick="logoutApp()">
            <div class="wc-cell-info" style="text-align:center"><span class="wc-cell-name" style="color:#fa5151">退出登录</span></div>
          </div>
        </div>
      </div>

      <!-- Bottom 4 Tabs -->
      <nav class="wc-tabbar">
        <div class="wc-tab-item active" onclick="switchTab('chat')">
          <svg viewBox="0 0 24 24"><path d="M10 3C5.58 3 2 6.13 2 10c0 2.22 1.17 4.2 3 5.48V19l3.35-1.84c.53.1 1.08.16 1.65.16.28 0 .56-.02.83-.05-.53-.94-.83-2-.83-3.13 0-3.87 3.58-7 8-7 .28 0 .56.02.83.05C17.92 4.41 14.28 3 10 3zM18 9c-3.87 0-7 2.69-7 6s3.13 6 7 6c.52 0 1.02-.06 1.5-.16L22 22v-2.88c1.23-1.07 2-2.52 2-4.12 0-3.31-3.13-6-7-6z"/></svg>
          <span>微信</span>
          <span id="tab-unread-badge" class="wc-badge-num" style="display:none">0</span>
        </div>
        <div class="wc-tab-item" onclick="switchTab('contacts')">
          <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          <span>通讯录</span>
        </div>
        <div class="wc-tab-item" onclick="switchTab('discover')">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          <span>发现</span>
          <span class="wc-badge-dot"></span>
        </div>
        <div class="wc-tab-item" onclick="switchTab('me')">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          <span>我</span>
        </div>
      </nav>
    </div>

    <!-- Secondary Right Split Container (For Chat Window / Moments / Detail) -->
    <div id="split-view-container" style="flex:2;position:relative">
      <!-- 1. WeChat Chat Window -->
      <div id="chat-view" class="chat-view">
        <header class="wc-header">
          <div class="wc-header-action" onclick="closeChat()">
            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            <span id="chat-header-back-count" style="font-size:14px">微信</span>
          </div>
          <div id="chat-header-title" class="wc-header-title" style="font-size:16px">智能体</div>
          <div class="wc-header-action" onclick="openActiveAgentProfile()">
            <svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </div>
        </header>
        <div id="chat-messages" class="chat-messages"></div>
        <div id="typing-indicator-box" style="padding:0 16px 8px;display:none">
          <div class="typing-indicator">
            <span id="typing-agent-name">对方</span>正在输入
            <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
          </div>
        </div>
        <div class="chat-inputbar">
          <textarea id="chat-textarea" placeholder="发送消息..." rows="1" onkeydown="handleChatKeyDown(event)"></textarea>
          <button class="chat-btn-send" onclick="sendChatMessage()">发送</button>
        </div>
      </div>

      <!-- 2. Moments (朋友圈) Window -->
      <div id="moments-view" class="moments-view">
        <header class="wc-header" style="background:transparent;position:sticky;top:0;z-index:20">
          <div class="wc-header-action" style="color:white;text-shadow:0 1px 3px rgba(0,0,0,0.8)" onclick="closeMoments()">
            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </div>
          <div class="wc-header-title" style="color:white;text-shadow:0 1px 3px rgba(0,0,0,0.8)">朋友圈</div>
          <div class="wc-header-action" style="color:white;text-shadow:0 1px 3px rgba(0,0,0,0.8)" onclick="openPublishMomentModal()">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          </div>
        </header>

        <div id="moments-cover" class="moments-cover" style="background-image:url('${ctx.user?.moments_background_url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80'}')">
          <div class="moments-user-card">
            <span id="moments-host-name" class="moments-user-name">${ctx.user?.nickname || '宿主'}</span>
            <img id="moments-host-avatar" class="moments-user-avatar" src="${ctx.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}">
          </div>
        </div>

        <div id="moments-feed" class="moments-feed"></div>
      </div>

      <!-- 3. Agent Profile & Independent Settings Panel -->
      <div id="agent-profile-view" class="wc-panel-view">
        <header class="wc-header">
          <div class="wc-header-action" onclick="closeAgentProfile()">
            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </div>
          <div class="wc-header-title">智能体资料</div>
          <div class="wc-header-action" onclick="openAgentFullEditor()">编辑</div>
        </header>
        <div id="agent-profile-content"></div>
      </div>

      <!-- 4. System Settings Panel -->
      <div id="settings-view" class="wc-panel-view">
        <header class="wc-header">
          <div class="wc-header-action" onclick="closeSystemSettings()">
            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </div>
          <div class="wc-header-title">系统管理与设置</div>
          <div class="wc-header-action" style="font-size:14px;color:#07c160" onclick="saveAllSettings()">保存</div>
        </header>
        <div id="settings-content" style="padding-bottom:60px"></div>
      </div>
    </div>
  </div>

  <!-- Common Modal / Dialog Container -->
  <div id="modal-mask" class="wc-modal-mask">
    <div id="modal-dialog" class="wc-dialog">
      <div id="modal-title" class="wc-dialog-title">提示</div>
      <div id="modal-content" class="wc-dialog-content"></div>
      <div class="wc-dialog-footer">
        <button id="modal-btn-cancel" class="wc-dialog-btn" onclick="closeModal()">取消</button>
        <button id="modal-btn-confirm" class="wc-dialog-btn confirm">确定</button>
      </div>
    </div>
  </div>

  <!-- WeChat Bottom ActionSheet -->
  <div id="actionsheet-mask" class="wc-modal-mask" style="align-items:flex-end;padding:0" onclick="closeActionSheet()">
    <div id="actionsheet" class="wc-actionsheet" onclick="event.stopPropagation()">
      <div id="actionsheet-items"></div>
      <div class="wc-actionsheet-item wc-actionsheet-cancel" onclick="closeActionSheet()">取消</div>
    </div>
  </div>

  <!-- Toast -->
  <div id="wc-toast" class="wc-toast">已完成</div>

  <!-- Embedded Client Logic -->
  <script>
    // State management
    let state = {
      currentTab: 'chat',
      activeAgentId: null,
      activeAgentData: null,
      conversations: [],
      contacts: [],
      unreadCount: 0,
      activeMomentIdForComment: null,
      commentReplyTarget: null,
      user: ${JSON.stringify(ctx.user || {})},
      pollTimer: null
    };

    function esc(s) {
      return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    function showToast(msg) {
      const el = document.getElementById('wc-toast');
      el.textContent = msg;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2000);
    }

    function showDialog(opts) {
      document.getElementById('modal-title').textContent = opts.title || '提示';
      document.getElementById('modal-content').innerHTML = opts.content || '';
      const cancelBtn = document.getElementById('modal-btn-cancel');
      const confirmBtn = document.getElementById('modal-btn-confirm');
      cancelBtn.style.display = opts.hideCancel ? 'none' : 'block';
      confirmBtn.className = 'wc-dialog-btn confirm ' + (opts.danger ? 'danger' : '');
      confirmBtn.textContent = opts.confirmText || '确定';
      confirmBtn.onclick = () => {
        closeModal();
        if (opts.onConfirm) opts.onConfirm();
      };
      document.getElementById('modal-mask').classList.add('open');
    }

    function closeModal() {
      document.getElementById('modal-mask').classList.remove('open');
    }

    function showActionSheet(items) {
      const container = document.getElementById('actionsheet-items');
      container.innerHTML = items.map((it, idx) => \`
        <div class="wc-actionsheet-item \${it.danger ? 'danger' : ''}" onclick="runActionSheetItem(\${idx})">\${esc(it.text)}</div>
      \`).join('');
      window._activeActionSheetItems = items;
      document.getElementById('actionsheet-mask').classList.add('open');
      document.getElementById('actionsheet').classList.add('open');
    }

    function runActionSheetItem(idx) {
      closeActionSheet();
      if (window._activeActionSheetItems && window._activeActionSheetItems[idx]?.onClick) {
        window._activeActionSheetItems[idx].onClick();
      }
    }

    function closeActionSheet() {
      document.getElementById('actionsheet-mask').classList.remove('open');
      document.getElementById('actionsheet').classList.remove('open');
    }

    // WeChat Timestamp Formatter (Section 11)
    function formatWechatTime(ts) {
      if (!ts) return '';
      const date = new Date(ts * 1000);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (86400 * 1000));

      const isSameDay = now.toDateString() === date.toDateString();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      if (isSameDay) return \`\${hours}:\${minutes}\`;
      if (diffDays === 1) return \`昨天 \${hours}:\${minutes}\`;
      if (diffDays < 7) {
        const weekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return \`\${weekMap[date.getDay()]} \${hours}:\${minutes}\`;
      }
      return \`\${date.getFullYear()}/\${date.getMonth() + 1}/\${date.getDate()}\`;
    }

    // Navigation Tabs
    function switchTab(tab) {
      state.currentTab = tab;
      document.querySelectorAll('.wc-tab-item').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.pc-nav-item').forEach(el => el.classList.remove('active'));

      ['chat', 'contacts', 'discover', 'me'].forEach(t => {
        const pane = document.getElementById('tab-' + t);
        if (pane) pane.style.display = (t === tab) ? 'block' : 'none';
      });

      const tabIndex = ['chat', 'contacts', 'discover', 'me'].indexOf(tab);
      if (tabIndex >= 0) {
        document.querySelectorAll('.wc-tab-item')[tabIndex]?.classList.add('active');
        document.querySelectorAll('.pc-nav-item')[tabIndex]?.classList.add('active');
      }

      const titles = { chat: '微信', contacts: '通讯录', discover: '发现', me: '我' };
      document.getElementById('main-header-title').textContent = titles[tab] || '微信';

      if (tab === 'chat') loadConversations();
      if (tab === 'contacts') loadContacts();
    }

    function handleHeaderAction() {
      if (state.currentTab === 'chat' || state.currentTab === 'contacts') {
        openCreateAgentModal();
      } else if (state.currentTab === 'discover') {
        openMoments();
      } else {
        openSystemSettings();
      }
    }

    // Tab 1: Conversations
    async function loadConversations() {
      try {
        const res = await fetch('/api/chat/conversations');
        const list = await res.json();
        state.conversations = list;
        let totalUnread = 0;

        const html = list.map(c => {
          totalUnread += Number(c.unread_count) || 0;
          const timeStr = formatWechatTime(c.last_time);
          const unreadHtml = c.unread_count > 0 ? \`<span class="wc-badge-num">\${c.unread_count}</span>\` : '';
          const name = c.remark ? \`\${esc(c.remark)} <span style="font-size:12px;color:var(--wechat-sub)">(\${esc(c.name)})</span>\` : esc(c.name);
          return \`
            <div class="wc-cell \${c.is_pinned ? 'pinned' : ''}" onclick="openChat(\${c.id}, '\${esc(c.name)}')">
              <div style="position:relative">
                <img class="wc-avatar" src="\${c.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'}">
                \${unreadHtml}
              </div>
              <div class="wc-cell-info">
                <div class="wc-cell-top">
                  <span class="wc-cell-name">\${name}</span>
                  <span class="wc-cell-time">\${timeStr}</span>
                </div>
                <div class="wc-cell-bottom">
                  <span class="wc-cell-desc">\${esc(c.last_message || '点击开始聊天')}</span>
                  \${c.is_muted ? '<span style="font-size:12px;color:var(--wechat-sub)">🔕</span>' : ''}
                </div>
              </div>
            </div>
          \`;
        }).join('') || '<div style="text-align:center;padding:60px 20px;color:var(--wechat-sub)">还没有聊天，前往通讯录找智能体好友吧</div>';

        document.getElementById('conversation-list').innerHTML = html;
        const badge = document.getElementById('tab-unread-badge');
        if (totalUnread > 0) {
          badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Tab 2: Contacts
    async function loadContacts() {
      try {
        const res = await fetch('/api/agents');
        const list = await res.json();
        state.contacts = list;

        const html = list.map(a => {
          const relation = a.relation_status || '好友';
          return \`
            <div class="wc-cell" onclick="openAgentProfileById(\${a.id})">
              <img class="wc-avatar" src="\${a.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'}">
              <div class="wc-cell-info">
                <div class="wc-cell-name">\${esc(a.remark || a.name)} \${a.remark ? \`<span style="font-size:12px;color:var(--wechat-sub)">(\${esc(a.name)})</span>\` : ''}</div>
                <div class="wc-cell-desc">\${esc(a.persona?.slice(0, 45) || '独立 AI 智能体')} · <span style="color:#07c160">\${relation}</span></div>
              </div>
            </div>
          \`;
        }).join('') || '<div style="text-align:center;padding:40px;color:var(--wechat-sub)">暂无智能体联系人</div>';

        document.getElementById('contacts-list').innerHTML = html;
      } catch (e) {
        console.error(e);
      }
    }

    // Chat Window
    async function openChat(agentId, agentName) {
      state.activeAgentId = agentId;
      document.getElementById('chat-header-title').textContent = agentName;
      document.getElementById('chat-view').classList.add('open');
      await loadChatHistory(agentId);
      markConversationRead(agentId);
    }

    function closeChat() {
      state.activeAgentId = null;
      document.getElementById('chat-view').classList.remove('open');
      loadConversations();
    }

    async function markConversationRead(agentId) {
      await fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId })
      });
    }

    async function loadChatHistory(agentId) {
      const msgBox = document.getElementById('chat-messages');
      try {
        const res = await fetch('/api/chat/history?agentId=' + agentId);
        const data = await res.json();
        const messages = data.messages || [];

        let lastTime = 0;
        let html = '';

        messages.forEach(m => {
          // WeChat time grouping rule: > 5 mins display group time
          if (m.created_at - lastTime > 300) {
            html += \`<div class="msg-group-time"><span>\${formatWechatTime(m.created_at)}</span></div>\`;
            lastTime = m.created_at;
          }

          const isMe = m.role === 'user';
          const avatarUrl = isMe
            ? (state.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80')
            : (state.conversations.find(c => c.id === agentId)?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80');

          html += \`
            <div class="msg-row \${isMe ? 'me' : 'ai'}" id="msg-\${m.id}">
              <img class="msg-avatar" src="\${avatarUrl}">
              <div class="msg-bubble" oncontextmenu="handleMessageContextMenu(event, \${m.id}, \${isMe}, '\${esc(m.content)}')">
                \${esc(m.content)}
              </div>
              \${m.status === 'failed' ? '<span class="msg-status-fail" onclick="retryMessage(' + m.id + ')" title="发送失败，点击重试">!</span>' : ''}
            </div>
          \`;
        });

        msgBox.innerHTML = html;
        msgBox.scrollTop = msgBox.scrollHeight;

        if (data.has_pending_delayed) {
          showTypingIndicator(true);
        } else {
          showTypingIndicator(false);
        }
      } catch (e) {
        console.error(e);
      }
    }

    function showTypingIndicator(show) {
      const box = document.getElementById('typing-indicator-box');
      box.style.display = show ? 'block' : 'none';
      if (show) {
        const msgBox = document.getElementById('chat-messages');
        msgBox.scrollTop = msgBox.scrollHeight;
      }
    }

    async function sendChatMessage() {
      const textarea = document.getElementById('chat-textarea');
      const content = textarea.value.trim();
      const agentId = state.activeAgentId;
      if (!content || !agentId) return;

      textarea.value = '';
      const msgBox = document.getElementById('chat-messages');
      const tempId = 'temp_' + Date.now();
      const myAvatar = state.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

      msgBox.innerHTML += \`
        <div class="msg-row me" id="\${tempId}">
          <img class="msg-avatar" src="\${myAvatar}">
          <div class="msg-bubble">\${esc(content)}</div>
        </div>
      \`;
      msgBox.scrollTop = msgBox.scrollHeight;

      showTypingIndicator(true);

      try {
        const res = await fetch('/api/sendChat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            agentId,
            content,
            messageUid: crypto.randomUUID()
          })
        });
        const d = await res.json();
        showTypingIndicator(false);

        if (res.ok) {
          const agent = state.conversations.find(c => c.id === agentId);
          const agentAvatar = agent?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80';
          msgBox.innerHTML += \`
            <div class="msg-row ai">
              <img class="msg-avatar" src="\${agentAvatar}">
              <div class="msg-bubble">\${esc(d.reply)}</div>
            </div>
          \`;
          msgBox.scrollTop = msgBox.scrollHeight;

          // If there's subsequent planned delayed messages, poll or show typing
          if (d.has_delayed) {
            showTypingIndicator(true);
            setTimeout(() => loadChatHistory(agentId), (d.next_delay_seconds || 5) * 1000 + 500);
          }
        } else {
          showToast(d.error || '发送失败');
          loadChatHistory(agentId);
        }
      } catch (e) {
        showTypingIndicator(false);
        showToast('网络异常: ' + e.message);
      }
    }

    function handleChatKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    }

    function handleMessageContextMenu(e, msgId, isMe, text) {
      e.preventDefault();
      const items = [
        { text: '复制消息', onClick: () => { navigator.clipboard?.writeText(text); showToast('已复制'); } }
      ];
      if (isMe) {
        items.push({ text: '编辑并重新发送', onClick: () => promptEditMessage(msgId, text) });
      } else {
        items.push({ text: '重新生成回复', onClick: () => regenerateAssistantReply() });
      }
      items.push({
        text: '删除消息', danger: true, onClick: () => {
          showDialog({
            title: '删除消息',
            content: '确定删除这条消息记录？',
            danger: true,
            onConfirm: async () => {
              await fetch('/api/chat/deleteMessage', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ messageId: msgId })
              });
              loadChatHistory(state.activeAgentId);
            }
          });
        }
      });
      showActionSheet(items);
    }

    function promptEditMessage(msgId, oldText) {
      showDialog({
        title: '编辑消息',
        content: \`<textarea id="edit-msg-input" style="width:100%;min-height:80px;border:1px solid var(--wechat-border);border-radius:6px;padding:8px;box-sizing:border-box">\${esc(oldText)}</textarea>\`,
        onConfirm: async () => {
          const val = document.getElementById('edit-msg-input')?.value.trim();
          if (!val) return;
          showTypingIndicator(true);
          await fetch('/api/chat/edit', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageId: msgId, content: val })
          });
          showTypingIndicator(false);
          loadChatHistory(state.activeAgentId);
        }
      });
    }

    async function regenerateAssistantReply() {
      showTypingIndicator(true);
      await fetch('/api/chat/regenerate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: state.activeAgentId })
      });
      showTypingIndicator(false);
      loadChatHistory(state.activeAgentId);
    }

    // Moments (朋友圈)
    async function openMoments() {
      document.getElementById('moments-view').classList.add('open');
      loadMomentsFeed();
    }

    function closeMoments() {
      document.getElementById('moments-view').classList.remove('open');
    }

    async function loadMomentsFeed() {
      const feedEl = document.getElementById('moments-feed');
      feedEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--wechat-sub)">加载动态中...</div>';

      try {
        const res = await fetch('/api/moments');
        const data = await res.json();
        const moments = data.moments || [];

        if (data.host) {
          state.user = data.host;
          document.getElementById('moments-host-name').textContent = data.host.nickname || '宿主';
          if (data.host.avatar_url) document.getElementById('moments-host-avatar').src = data.host.avatar_url;
          if (data.host.moments_background_url) document.getElementById('moments-cover').style.backgroundImage = 'url(' + data.host.moments_background_url + ')';
        }

        const html = moments.map(m => {
          const isLiked = m.is_liked_by_host;
          const blockedBadge = m.blocked_host ? \`<span class="moment-blocked-badge">该 AI 屏蔽了宿主 (仅宿主可见)</span>\` : '';
          const authorAvatar = m.author_avatar || (m.author_type === 'user' ? state.user?.avatar_url : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80');

          let imagesHtml = '';
          try {
            const imgs = JSON.parse(m.images_json || '[]');
            if (Array.isArray(imgs) && imgs.length > 0) {
              imagesHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
                imgs.map(u => \`<img src="\${u}" style="width:80px;height:80px;object-fit:cover;border-radius:4px">\`).join('') +
                '</div>';
            }
          } catch {}

          const likes = m.likes || [];
          const comments = m.comments || [];
          const likesNames = likes.map(l => l.actor_name).join('、');

          const commentsHtml = comments.map(c => {
            const replyTarget = c.reply_to_name ? \` 回复 <span class="comment-user">\${esc(c.reply_to_name)}</span>\` : '';
            return \`
              <div class="moment-comment-line" onclick="replyComment(\${m.id}, '\${esc(c.actor_type)}', \${c.actor_id}, '\${esc(c.actor_name)}')">
                <span class="comment-user">\${esc(c.actor_name)}</span>\${replyTarget}: \${esc(c.content)}
              </div>
            \`;
          }).join('');

          const isAuthor = m.author_type === 'user';

          return \`
            <div class="moment-item" id="moment-\${m.id}">
              <img class="moment-avatar" src="\${authorAvatar}">
              <div class="moment-body">
                <div class="moment-author">\${esc(m.author_name)}</div>
                \${blockedBadge}
                <div class="moment-content">\${esc(m.content)}</div>
                \${imagesHtml}
                <div class="moment-footer">
                  <div class="moment-time-action">
                    <span>\${formatWechatTime(m.created_at)}</span>
                    \${isAuthor ? \`<span style="color:#576b95;cursor:pointer" onclick="deleteMomentPost(\${m.id})">删除</span>\` : ''}
                  </div>
                  <div class="moment-btn-menu" onclick="toggleMomentPopMenu(event, \${m.id})">··</div>
                  <div id="pop-menu-\${m.id}" class="moment-pop-menu">
                    <div class="moment-pop-btn" onclick="toggleLike(\${m.id})">
                      <span>\${isLiked ? '❤️ 取消' : '🤍 赞'}</span>
                    </div>
                    <div class="moment-pop-btn" onclick="openCommentInput(\${m.id})">
                      <span>💬 评论</span>
                    </div>
                  </div>
                </div>
                \${(likes.length > 0 || comments.length > 0) ? \`
                  <div class="moment-interact-box">
                    \${likes.length > 0 ? \`<div class="moment-likes">❤️ \${esc(likesNames)}</div>\` : ''}
                    \${commentsHtml}
                  </div>
                \` : ''}
              </div>
            </div>
          \`;
        }).join('') || '<div style="text-align:center;padding:40px;color:var(--wechat-sub)">暂无朋友圈动态，点击右上角发布一条吧</div>';

        feedEl.innerHTML = html;
      } catch (e) {
        feedEl.innerHTML = '<div style="text-align:center;padding:40px;color:#fa5151">加载动态失败</div>';
      }
    }

    function toggleMomentPopMenu(e, id) {
      e.stopPropagation();
      document.querySelectorAll('.moment-pop-menu').forEach(el => {
        if (el.id !== 'pop-menu-' + id) el.classList.remove('active');
      });
      const menu = document.getElementById('pop-menu-' + id);
      menu.classList.toggle('active');
    }

    document.addEventListener('click', () => {
      document.querySelectorAll('.moment-pop-menu').forEach(el => el.classList.remove('active'));
    });

    async function toggleLike(momentId) {
      await fetch('/api/moments/like', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ momentId })
      });
      loadMomentsFeed();
    }

    function openCommentInput(momentId) {
      state.activeMomentIdForComment = momentId;
      state.commentReplyTarget = null;
      promptCommentModal('评论');
    }

    function replyComment(momentId, replyToActorType, replyToActorId, replyToName) {
      state.activeMomentIdForComment = momentId;
      state.commentReplyTarget = { replyToActorType, replyToActorId, replyToName };
      promptCommentModal('回复 ' + replyToName);
    }

    function promptCommentModal(title) {
      showDialog({
        title: title,
        content: \`<input id="comment-input-text" placeholder="输入评论内容..." style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--wechat-border);border-radius:6px">\`,
        confirmText: '发送',
        onConfirm: async () => {
          const content = document.getElementById('comment-input-text')?.value.trim();
          if (!content) return;
          await fetch('/api/moments/comment', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              momentId: state.activeMomentIdForComment,
              content,
              replyToActorType: state.commentReplyTarget?.replyToActorType,
              replyToActorId: state.commentReplyTarget?.replyToActorId
            })
          });
          loadMomentsFeed();
        }
      });
    }

    function openPublishMomentModal() {
      showDialog({
        title: '发表朋友圈',
        content: \`
          <textarea id="publish-moment-text" placeholder="这一刻的想法..." style="width:100%;min-height:80px;border:1px solid var(--wechat-border);border-radius:6px;padding:8px;box-sizing:border-box;margin-bottom:10px"></textarea>
          <div style="text-align:left;font-size:13px;color:var(--wechat-sub);margin-bottom:6px">可见范围:</div>
          <select id="publish-moment-visibility" style="width:100%;padding:8px;border:1px solid var(--wechat-border);border-radius:6px;background:var(--wechat-card);color:var(--wechat-text)">
            <option value="public">公开 (所有人可见)</option>
            <option value="private">私密 (仅自己可见)</option>
            <option value="host_only">仅宿主可见</option>
          </select>
        \`,
        confirmText: '发表',
        onConfirm: async () => {
          const content = document.getElementById('publish-moment-text')?.value.trim();
          const visibility = document.getElementById('publish-moment-visibility')?.value;
          if (!content) return;
          await fetch('/api/moments', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content, visibility })
          });
          showToast('已发表');
          loadMomentsFeed();
        }
      });
    }

    function deleteMomentPost(id) {
      showDialog({
        title: '删除朋友圈',
        content: '确定要删除这条朋友圈动态吗？',
        danger: true,
        onConfirm: async () => {
          await fetch('/api/moments/' + id, { method: 'DELETE' });
          showToast('已删除');
          loadMomentsFeed();
        }
      });
    }

    // Agent Details & Independent Settings
    async function openActiveAgentProfile() {
      if (!state.activeAgentId) return;
      openAgentProfileById(state.activeAgentId);
    }

    async function openAgentProfileById(id) {
      const view = document.getElementById('agent-profile-view');
      view.classList.add('open');
      const box = document.getElementById('agent-profile-content');
      box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--wechat-sub)">加载资料中...</div>';

      try {
        const res = await fetch('/api/agents/' + id);
        const data = await res.json();
        state.activeAgentData = data;
        const a = data.agent;
        const p = data.preferences || {};
        const prof = data.profile || {};
        const perm = data.permissions || {};

        box.innerHTML = \`
          <div class="wc-group-card" style="margin-top:0">
            <div class="wc-cell" style="padding:16px">
              <img class="wc-avatar" style="width:64px;height:64px" src="\${a.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'}">
              <div class="wc-cell-info">
                <div style="font-size:18px;font-weight:600">\${esc(a.remark || a.name)}</div>
                <div style="font-size:13px;color:var(--wechat-sub);margin-top:4px">微信号: \${esc(a.wechat_id || 'agent_' + a.id)}</div>
                <div style="font-size:13px;color:var(--wechat-sub)">昵称: \${esc(a.name)}</div>
              </div>
            </div>
          </div>

          <div class="wc-group-card">
            <div class="wc-row"><label>个性签名</label><span>\${esc(a.persona?.slice(0, 30) || '暂无')}</span></div>
            <div class="wc-row"><label>关系状态</label><span style="color:#07c160;font-weight:500">\${esc(p.relation_status || '普通朋友')}</span></div>
            <div class="wc-row"><label>熟悉度</label><span>\${p.familiarity_level || 10} / 100</span></div>
            <div class="wc-row"><label>情感进度</label><span>\${Math.round((p.emotional_progress || 0.1) * 100)}%</span></div>
            <div class="wc-row"><label>宿主印象</label><span>\${esc(p.host_impression || '尚在熟悉中')}</span></div>
          </div>

          <div class="wc-group-card">
            <div class="wc-row"><label>语言风格</label><span>\${esc(prof.language_style || '自然生活化')}</span></div>
            <div class="wc-row"><label>兴趣爱好</label><span>\${esc(a.interests || '无')}</span></div>
            <div class="wc-row"><label>生活习惯</label><span>\${esc(a.habits || '无')}</span></div>
            <div class="wc-row"><label>API 每日配额</label><span>\${a.daily_api_limit || 50} 次/日</span></div>
          </div>

          <div style="padding:16px 20px">
            <button class="chat-btn-send" style="width:100%;height:44px;font-size:16px;margin-bottom:10px" onclick="startChatFromProfile(\${a.id}, '\${esc(a.name)}')">发消息</button>
            <button class="chat-btn-send" style="width:100%;height:44px;font-size:16px;background:#eef0f2;color:#333;margin-bottom:10px" onclick="openAgentMemoriesModal(\${a.id})">管理独立私有记忆</button>
            <button class="chat-btn-send" style="width:100%;height:44px;font-size:16px;background:#fa5151" onclick="confirmDeleteAgent(\${a.id})">删除此智能体</button>
          </div>
        \`;
      } catch (e) {
        box.innerHTML = '<div style="text-align:center;padding:40px;color:#fa5151">加载资料失败</div>';
      }
    }

    function closeAgentProfile() {
      document.getElementById('agent-profile-view').classList.remove('open');
    }

    function startChatFromProfile(agentId, agentName) {
      closeAgentProfile();
      openChat(agentId, agentName);
    }

    function confirmDeleteAgent(id) {
      showDialog({
        title: '删除智能体',
        content: '确定要删除该智能体吗？<br><br><label><input id="del-data-check" type="checkbox"> 同时清理该智能体相关的聊天与私有记忆数据</label>',
        danger: true,
        onConfirm: async () => {
          const delData = document.getElementById('del-data-check')?.checked;
          await fetch('/api/agents/' + id + '?delete_data=' + (delData ? 'true' : 'false'), { method: 'DELETE' });
          showToast('已删除');
          closeAgentProfile();
          if (state.activeAgentId === id) closeChat();
          loadConversations();
          loadContacts();
        }
      });
    }

    // Memories Manager
    async function openAgentMemoriesModal(agentId) {
      const res = await fetch('/api/agents/' + agentId + '/memories');
      const memories = await res.json();

      const itemsHtml = memories.map(m => \`
        <div style="padding:10px;border-bottom:0.5px solid var(--wechat-border);display:flex;justify-content:space-between;align-items:flex-start;font-size:13px">
          <div>
            <span style="background:rgba(7,193,96,0.1);color:#07c160;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600">\${m.memory_type} ★\${m.importance}</span>
            <div style="margin-top:4px;color:var(--wechat-text)">\${esc(m.content)}</div>
          </div>
          <span style="color:#fa5151;cursor:pointer;margin-left:8px" onclick="deleteMemoryItem(\${agentId}, \${m.id})">删除</span>
        </div>
      \`).join('') || '<div style="padding:20px;text-align:center;color:var(--wechat-sub)">暂无私有记忆</div>';

      showDialog({
        title: '私有独立记忆管理',
        content: \`
          <div style="max-height:220px;overflow-y:auto;text-align:left;margin-bottom:12px">\${itemsHtml}</div>
          <button style="width:100%;padding:8px;border-radius:6px;border:0;background:#07c160;color:white;cursor:pointer" onclick="promptAddMemory(\${agentId})">+ 手动新增记忆</button>
        \`,
        hideCancel: true,
        confirmText: '完成'
      });
    }

    async function deleteMemoryItem(agentId, memoryId) {
      await fetch('/api/agents/' + agentId + '/memories', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memoryId })
      });
      openAgentMemoriesModal(agentId);
    }

    function promptAddMemory(agentId) {
      closeModal();
      showDialog({
        title: '新增私有记忆',
        content: \`
          <textarea id="mem-content" placeholder="输入长期重要事实或偏好..." style="width:100%;min-height:60px;box-sizing:border-box;padding:8px;border:1px solid var(--wechat-border);border-radius:6px;margin-bottom:8px"></textarea>
          <select id="mem-type" style="width:100%;padding:8px;border:1px solid var(--wechat-border);border-radius:6px;background:var(--wechat-card);color:var(--wechat-text)">
            <option value="fact">明确事实 (fact)</option>
            <option value="preference">偏好记忆 (preference)</option>
            <option value="relation">关系记忆 (relation)</option>
            <option value="event">重要事件 (event)</option>
          </select>
        \`,
        confirmText: '保存',
        onConfirm: async () => {
          const content = document.getElementById('mem-content')?.value.trim();
          const memory_type = document.getElementById('mem-type')?.value;
          if (!content) return;
          await fetch('/api/agents/' + agentId + '/memories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content, memory_type, importance: 4 })
          });
          openAgentMemoriesModal(agentId);
        }
      });
    }

    // Agent Create / Edit Full Modal
    function openCreateAgentModal() {
      openAgentFullEditor(null);
    }

    function openAgentFullEditor(agentData) {
      const a = agentData?.agent || state.activeAgentData?.agent || {};
      const prof = agentData?.profile || state.activeAgentData?.profile || {};
      const perm = agentData?.permissions || state.activeAgentData?.permissions || {};
      const isEdit = !!a.id;

      showDialog({
        title: isEdit ? '编辑智能体配置' : '新建 AI 智能体',
        content: \`
          <div style="max-height:360px;overflow-y:auto;text-align:left;font-size:14px">
            <div style="margin-bottom:8px"><b>昵称</b><input id="form-agent-name" value="\${esc(a.name || '')}" placeholder="智能体名字" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>微信号</b><input id="form-agent-wechat" value="\${esc(a.wechat_id || '')}" placeholder="英文微信号ID" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>头像 URL</b><input id="form-agent-avatar" value="\${esc(a.avatar_url || '')}" placeholder="https://..." style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>核心人设 (Persona)</b><textarea id="form-agent-persona" placeholder="身份背景、性格..." style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px;min-height:50px">\${esc(a.persona || '')}</textarea></div>
            <div style="margin-bottom:8px"><b>强制行为规则 (Prompt)</b><textarea id="form-agent-force" placeholder="说话语气、严禁事项..." style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px;min-height:50px">\${esc(a.force_prompt || '')}</textarea></div>
            <div style="margin-bottom:8px"><b>兴趣爱好</b><input id="form-agent-interests" value="\${esc(a.interests || '')}" placeholder="如：咖啡、摄影、黑胶" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>宿主备注</b><input id="form-agent-remark" value="\${esc(a.remark || '')}" placeholder="宿主给TA的备注名" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="display:flex;gap:12px;margin-bottom:8px">
              <label><input id="form-agent-autopost" type="checkbox" \${a.auto_post_enabled !== 0 ? 'checked' : ''}> 自动发朋友圈</label>
              <label><input id="form-agent-autointeract" type="checkbox" \${a.auto_interact_enabled !== 0 ? 'checked' : ''}> 自动互动</label>
            </div>
            <div style="margin-bottom:8px"><b>每日 API 上限</b><input id="form-agent-limit" type="number" value="\${a.daily_api_limit || 50}" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
          </div>
        \`,
        confirmText: '保存提交',
        onConfirm: async () => {
          const payload = {
            id: a.id || 0,
            name: document.getElementById('form-agent-name')?.value.trim(),
            wechat_id: document.getElementById('form-agent-wechat')?.value.trim(),
            avatar_url: document.getElementById('form-agent-avatar')?.value.trim(),
            persona: document.getElementById('form-agent-persona')?.value.trim(),
            force_prompt: document.getElementById('form-agent-force')?.value.trim(),
            interests: document.getElementById('form-agent-interests')?.value.trim(),
            remark: document.getElementById('form-agent-remark')?.value.trim(),
            auto_post_enabled: document.getElementById('form-agent-autopost')?.checked ? 1 : 0,
            auto_interact_enabled: document.getElementById('form-agent-autointeract')?.checked ? 1 : 0,
            daily_api_limit: Number(document.getElementById('form-agent-limit')?.value) || 50
          };
          if (!payload.name) {
            showToast('名称不能为空');
            return;
          }
          await fetch('/api/agents', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
          });
          showToast('已保存');
          loadConversations();
          loadContacts();
          if (a.id) openAgentProfileById(a.id);
        }
      });
    }

    // Host Profile Modal
    function openHostProfileModal() {
      showDialog({
        title: '宿主个人资料',
        content: \`
          <div style="text-align:left;font-size:14px">
            <div style="margin-bottom:8px"><b>昵称</b><input id="host-nick" value="\${esc(state.user?.nickname || '宿主')}" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>微信号风格 ID</b><input id="host-wechat-id" value="\${esc(state.user?.wechat_id || 'host_user')}" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>个性签名</b><input id="host-sig" value="\${esc(state.user?.signature || '')}" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>头像 URL</b><input id="host-avatar" value="\${esc(state.user?.avatar_url || '')}" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>朋友圈背景 URL</b><input id="host-moments-bg" value="\${esc(state.user?.moments_background_url || '')}" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
          </div>
        \`,
        confirmText: '保存资料',
        onConfirm: async () => {
          const userPayload = {
            nickname: document.getElementById('host-nick')?.value.trim(),
            wechat_id: document.getElementById('host-wechat-id')?.value.trim(),
            signature: document.getElementById('host-sig')?.value.trim(),
            avatar_url: document.getElementById('host-avatar')?.value.trim(),
            moments_background_url: document.getElementById('host-moments-bg')?.value.trim()
          };
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ user: userPayload })
          });
          state.user = { ...state.user, ...userPayload };
          document.getElementById('me-nickname').textContent = userPayload.nickname;
          document.getElementById('me-wechat-id').textContent = '微信号: ' + userPayload.wechat_id;
          if (userPayload.avatar_url) {
            document.getElementById('me-avatar').src = userPayload.avatar_url;
            document.getElementById('sidebar-host-avatar').src = userPayload.avatar_url;
          }
          showToast('资料已更新');
        }
      });
    }

    // System Settings & Backend Management
    async function openSystemSettings() {
      const view = document.getElementById('settings-view');
      view.classList.add('open');
      const box = document.getElementById('settings-content');
      box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--wechat-sub)">加载系统设置中...</div>';

      try {
        const [settRes, backendsRes, statsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/backends'),
          fetch('/api/stats/token')
        ]);
        const sData = await settRes.json();
        const bList = await backendsRes.json();
        const stats = await statsRes.json();

        const s = sData.settings || {};
        const backendsHtml = bList.map(b => \`
          <div style="padding:12px;border-bottom:0.5px solid var(--wechat-border);display:flex;justify-content:space-between;align-items:center;font-size:14px">
            <div>
              <div style="font-weight:600">\${esc(b.name)} <span style="font-size:12px;color:var(--wechat-sub)">(\${esc(b.default_model)})</span></div>
              <div style="font-size:12px;color:var(--wechat-sub)">Base URL: \${esc(b.base_url)} · 优先级: \${b.priority} · 失败冷却: \${b.failure_count}</div>
            </div>
            <div style="display:flex;gap:6px">
              <button style="padding:4px 8px;border-radius:4px;border:0;background:#07c160;color:white;cursor:pointer;font-size:12px" onclick="testBackendApi(\${b.id})">测试连通</button>
              <button style="padding:4px 8px;border-radius:4px;border:0;background:#fa5151;color:white;cursor:pointer;font-size:12px" onclick="deleteBackendApi(\${b.id})">删除</button>
            </div>
          </div>
        \`).join('') || '<div style="padding:14px;color:var(--wechat-sub)">暂无 API 后端，请添加</div>';

        box.innerHTML = \`
          <div class="wc-group-card">
            <div style="padding:12px 16px;font-weight:600;font-size:15px;border-bottom:0.5px solid var(--wechat-border)">全局系统提示词 (System Prompt)</div>
            <div style="padding:12px 16px">
              <textarea id="sett-global-prompt" style="width:100%;min-height:90px;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px;font-size:14px">\${esc(s.global_system_prompt || '')}</textarea>
              <button style="margin-top:6px;padding:6px 12px;border:0;border-radius:6px;background:#eef0f2;color:#333;cursor:pointer;font-size:13px" onclick="restoreCanonicalPrompt()">恢复默认官方规范提示词</button>
            </div>
          </div>

          <div class="wc-group-card">
            <div style="padding:12px 16px;font-weight:600;font-size:15px;border-bottom:0.5px solid var(--wechat-border)">消息策略与探针</div>
            <div class="wc-row">
              <label>打断策略</label>
              <select id="sett-delay-policy">
                <option value="rethink" \${s.delayed_message_policy === 'rethink' ? 'selected' : ''}>重新思考 (默认打断)</option>
                <option value="continue" \${s.delayed_message_policy === 'continue' ? 'selected' : ''}>继续执行原任务</option>
                <option value="cancel" \${s.delayed_message_policy === 'cancel' ? 'selected' : ''}>取消未发送任务</option>
              </select>
            </div>
            <div class="wc-row">
              <label>最大延迟秒数</label>
              <input id="sett-max-delay" type="number" value="\${s.max_delay_seconds || 300}">
            </div>
            <div class="wc-row">
              <label>上下文历史数</label>
              <input id="sett-max-ctx" type="number" value="\${s.max_context_count || 20}">
            </div>
            <div class="wc-row">
              <label>探针定时触发</label>
              <input id="sett-probe-enabled" type="checkbox" \${s.probe_enabled !== 0 ? 'checked' : ''} style="width:auto">
            </div>
          </div>

          <div class="wc-group-card">
            <div style="padding:12px 16px;font-weight:600;font-size:15px;display:flex;justify-content:space-between;align-items:center;border-bottom:0.5px solid var(--wechat-border)">
              <span>AI API 后端池与模型</span>
              <button style="padding:4px 10px;border-radius:4px;border:0;background:#07c160;color:white;cursor:pointer;font-size:13px" onclick="openAddBackendModal()">+ 新增后端</button>
            </div>
            <div>\${backendsHtml}</div>
            <div style="padding:12px 16px;display:flex;gap:10px">
              <button style="flex:1;padding:8px;border-radius:6px;border:0;background:#eef0f2;color:#333;cursor:pointer;font-size:13px" onclick="viewDetailedLogs()">查看最近20条详细日志</button>
              <button style="padding:8px 12px;border-radius:6px;border:0;background:#fa5151;color:white;cursor:pointer;font-size:13px" onclick="clearDetailedLogs()">清空详细日志</button>
            </div>
          </div>

          <div class="wc-group-card">
            <div style="padding:12px 16px;font-weight:600;font-size:15px;border-bottom:0.5px solid var(--wechat-border)">Token 统计与开销估算</div>
            <div style="padding:14px 16px;font-size:14px;line-height:1.7">
              <div>总调用次数: <b>\${stats.overall?.total_calls || 0}</b> 次 (成功 \${stats.overall?.success_calls || 0} / 失败 \${stats.overall?.fail_calls || 0})</div>
              <div>消耗总 Token: <b>\${stats.overall?.total_tokens || 0}</b> (Prompt: \${stats.overall?.prompt_tokens || 0} / Completion: \${stats.overall?.completion_tokens || 0})</div>
              <div>估算费用: <b style="color:#07c160">$\${stats.overall?.estimated_cost || 0}</b> <span style="font-size:12px;color:var(--wechat-sub)">(官方费率估算)</span></div>
              <div>平均耗时: <b>\${stats.overall?.avg_duration_ms || 0}</b> ms</div>
            </div>
          </div>

          <div class="wc-group-card">
            <div style="padding:12px 16px;font-weight:600;font-size:15px;border-bottom:0.5px solid var(--wechat-border)">数据清理中心 (Data Cleanup)</div>
            <div style="padding:14px 16px">
              <p style="font-size:13px;color:var(--wechat-sub);margin:0 0 10px">支持按模块、时间跨度估算并精准清理过期数据：</p>
              <div style="display:flex;gap:8px;margin-bottom:10px">
                <select id="cleanup-module" style="flex:1;padding:8px;border:1px solid var(--wechat-border);border-radius:6px;background:var(--wechat-card);color:var(--wechat-text)">
                  <option value="chats">聊天记录 (chat_records)</option>
                  <option value="api_logs">API 调用日志 (api_logs)</option>
                  <option value="context_logs">现实接口日志 (context_logs)</option>
                  <option value="memories">智能体记忆 (memories)</option>
                  <option value="moments">朋友圈动态 (moments)</option>
                  <option value="delayed_messages">延迟消息队列 (delayed_messages)</option>
                </select>
                <select id="cleanup-time" style="flex:1;padding:8px;border:1px solid var(--wechat-border);border-radius:6px;background:var(--wechat-card);color:var(--wechat-text)">
                  <option value="all">全部时间</option>
                  <option value="7d">7 天前</option>
                  <option value="30d">30 天前</option>
                  <option value="90d">90 天前</option>
                </select>
              </div>
              <button style="width:100%;padding:10px;border-radius:6px;border:0;background:#fa5151;color:white;cursor:pointer;font-size:14px" onclick="executeDataCleanup()">预估并清理数据</button>
            </div>
          </div>

          <div class="wc-group-card">
            <div style="padding:12px 16px;font-weight:600;font-size:15px;border-bottom:0.5px solid var(--wechat-border)">数据备份与恢复 (JSON)</div>
            <div style="padding:14px 16px">
              <button style="width:100%;padding:10px;border-radius:6px;border:0;background:#07c160;color:white;cursor:pointer;font-size:14px;margin-bottom:10px" onclick="location.href='/api/export'">导出完整 JSON 备份</button>
              <input type="file" id="import-file" accept="application/json" style="width:100%;margin-bottom:10px;font-size:13px">
              <button style="width:100%;padding:10px;border-radius:6px;border:0;background:#eef0f2;color:#333;cursor:pointer;font-size:14px" onclick="importJsonBackup()">导入备份并恢复数据</button>
            </div>
          </div>
        \`;
      } catch (e) {
        box.innerHTML = '<div style="text-align:center;padding:40px;color:#fa5151">加载系统设置异常</div>';
      }
    }

    function closeSystemSettings() {
      document.getElementById('settings-view').classList.remove('open');
    }

    async function saveAllSettings() {
      const payload = {
        settings: {
          global_system_prompt: document.getElementById('sett-global-prompt')?.value.trim(),
          delayed_message_policy: document.getElementById('sett-delay-policy')?.value,
          max_delay_seconds: Number(document.getElementById('sett-max-delay')?.value) || 300,
          max_context_count: Number(document.getElementById('sett-max-ctx')?.value) || 20,
          probe_enabled: document.getElementById('sett-probe-enabled')?.checked ? 1 : 0
        }
      };
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('设置已保存');
    }

    function restoreCanonicalPrompt() {
      const el = document.getElementById('sett-global-prompt');
      if (el) {
        el.value = \`你是一个具有独立人格、长期记忆和社交关系的虚拟智能体。你拥有自己的名字、性格、兴趣、表达习惯、价值观和记忆。你不是一个单纯的问答工具，而是一个社交网络中的独立参与者。请自然交流，不要每次对话重新介绍自己，不编造不存在的事实，不得越权操作系统。\`;
      }
    }

    function openAddBackendModal() {
      showDialog({
        title: '新增 API 后端',
        content: \`
          <div style="text-align:left;font-size:14px">
            <div style="margin-bottom:8px"><b>后端名称</b><input id="add-b-name" placeholder="如: OpenAI / DeepSeek" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>Base URL</b><input id="add-b-url" placeholder="https://api.openai.com/v1" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>API Key</b><input id="add-b-key" type="password" placeholder="sk-..." style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>默认模型</b><input id="add-b-model" placeholder="gpt-4o-mini 或 deepseek-chat" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
            <div style="margin-bottom:8px"><b>优先级 (越小越先)</b><input id="add-b-prio" type="number" value="10" style="width:100%;padding:8px;box-sizing:border-box;border:1px solid var(--wechat-border);border-radius:6px"></div>
          </div>
        \`,
        confirmText: '保存后端',
        onConfirm: async () => {
          const payload = {
            name: document.getElementById('add-b-name')?.value.trim(),
            base_url: document.getElementById('add-b-url')?.value.trim(),
            api_key: document.getElementById('add-b-key')?.value.trim(),
            default_model: document.getElementById('add-b-model')?.value.trim(),
            priority: Number(document.getElementById('add-b-prio')?.value) || 10
          };
          if (!payload.name || !payload.base_url || !payload.default_model) {
            showToast('必填字段不能为空');
            return;
          }
          await fetch('/api/backends', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
          });
          showToast('后端已保存');
          openSystemSettings();
        }
      });
    }

    async function testBackendApi(id) {
      showToast('正在发起连通性测试...');
      const res = await fetch('/api/backends/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const d = await res.json();
      if (d.ok) {
        showDialog({
          title: '连通性测试成功',
          content: \`耗时: <b>\${d.durationMs}ms</b><br>模型回复: "\${esc(d.reply)}"\`,
          hideCancel: true
        });
      } else {
        showDialog({
          title: '连通性测试失败',
          content: \`错误信息: <span style="color:#fa5151">\${esc(d.error || '无法连通')}</span>\`,
          hideCancel: true,
          danger: true
        });
      }
    }

    async function deleteBackendApi(id) {
      showDialog({
        title: '删除后端',
        content: '确定要删除此 API 后端配置吗？',
        danger: true,
        onConfirm: async () => {
          await fetch('/api/backends/' + id, { method: 'DELETE' });
          showToast('已删除');
          openSystemSettings();
        }
      });
    }

    async function viewDetailedLogs() {
      const res = await fetch('/api/backends/details');
      const rows = await res.json();
      const listHtml = rows.map(r => \`
        <div style="padding:8px;border-bottom:0.5px solid var(--wechat-border);font-size:12px">
          <div><b>\${esc(r.backend_name || 'Backend')}</b> - \${esc(r.model)} (\${r.success ? '<span style="color:#07c160">成功</span>' : '<span style="color:#fa5151">失败</span>'})</div>
          <div style="color:var(--wechat-sub)">耗时: \${r.duration_ms}ms · Tokens: \${r.total_tokens} · \${new Date(r.created_at * 1000).toLocaleTimeString()}</div>
          \${r.error_message ? \`<div style="color:#fa5151">\${esc(r.error_message)}</div>\` : ''}
        </div>
      \`).join('') || '<div style="padding:20px;text-align:center;color:var(--wechat-sub)">暂无详细记录</div>';

      showDialog({
        title: '最近详细调用日志 (上限20条/后端)',
        content: \`<div style="max-height:300px;overflow-y:auto;text-align:left">\${listHtml}</div>\`,
        hideCancel: true
      });
    }

    async function clearDetailedLogs() {
      showDialog({
        title: '清空详细日志',
        content: '确定清空所有后端的最近20条详细日志？历史汇总统计将完整保留。',
        onConfirm: async () => {
          await fetch('/api/backends/clearLogs', { method: 'POST' });
          showToast('详细日志已清空');
        }
      });
    }

    async function executeDataCleanup() {
      const mod = document.getElementById('cleanup-module')?.value;
      const time = document.getElementById('cleanup-time')?.value;
      // 1. Preview
      const prevRes = await fetch('/api/cleanup/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ module: mod, timeFilter: time })
      });
      const prevData = await prevRes.json();
      if (!prevData.ok) {
        showToast(prevData.error || '预估失败');
        return;
      }

      showDialog({
        title: '确认数据清理',
        content: \`预计将永久删除 <b>\${prevData.estimated_count}</b> 条数据记录。此操作不可逆，确定继续？\`,
        danger: true,
        confirmText: '确认清理',
        onConfirm: async () => {
          const execRes = await fetch('/api/cleanup/execute', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ module: mod, timeFilter: time })
          });
          const execData = await execRes.json();
          showToast(\`成功清理 \${execData.deleted_count || 0} 条数据\`);
        }
      });
    }

    async function importJsonBackup() {
      const fileInput = document.getElementById('import-file');
      const file = fileInput?.files?.[0];
      if (!file) {
        showToast('请先选择备份 JSON 文件');
        return;
      }
      showDialog({
        title: '恢复备份数据',
        content: '导入将覆盖现有业务数据（API 密钥需重新输入）。请确保已下载备份，是否继续？',
        danger: true,
        confirmText: '确认覆盖导入',
        onConfirm: async () => {
          const text = await file.text();
          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: text
          });
          const d = await res.json();
          if (res.ok) {
            showToast('数据恢复成功');
            setTimeout(() => location.reload(), 1200);
          } else {
            showToast(d.error || '导入失败');
          }
        }
      });
    }

    async function logoutApp() {
      showDialog({
        title: '退出登录',
        content: '确定要退出当前管理员登录状态吗？',
        onConfirm: async () => {
          await fetch('/logout', { method: 'POST' });
          location.href = '/login';
        }
      });
    }

    function handleSearch(val) {
      const v = (val || '').toLowerCase().trim();
      if (state.currentTab === 'chat') {
        const filtered = state.conversations.filter(c => (c.name || '').toLowerCase().includes(v) || (c.remark || '').toLowerCase().includes(v));
        // Render filtered
      }
    }

    // Auto-polling for real-time delayed messages and probe updates
    function startPolling() {
      state.pollTimer = setInterval(async () => {
        if (state.activeAgentId) {
          loadChatHistory(state.activeAgentId);
        } else if (state.currentTab === 'chat') {
          loadConversations();
        }
      }, 5000);
    }

    // Init
    window.addEventListener('DOMContentLoaded', () => {
      loadConversations();
      startPolling();
    });
  </script>
</body>
</html>`;
}
