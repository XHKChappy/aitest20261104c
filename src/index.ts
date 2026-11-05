import type { Env } from "./types";
import { json } from "./types";
import { login, logout, requireAuth } from "./auth";
import { checkDbStatus, initDb } from "./db";
import {
  sendChat, getConversations, getChatHistory, regenerateChat, editMessage, deleteChatMessage, clearChatHistory, markAsRead,
  getMomentsFeed, createMoment, deleteMoment, toggleLikeMoment, addCommentMoment, deleteCommentMoment,
  listAgents, getAgentDetail, saveAgent, deleteAgent, handleAgentMemories, mergeAgentMemories,
  listBackends, saveBackend, deleteBackend, testBackend, getBackendCallDetails, clearBackendCallDetails, getTokenStats,
  previewCleanup, executeCleanup,
  handleAgentContextApi,
  getSystemSettings, saveSystemSettings
} from "./modules";
import { probeHttp, runProbe } from "./probe";
import { exportData, importData } from "./export";
import { renderWeChatApp, renderLoginPage, setupPage, initPage } from "./view";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. Stage 1: No DB binding in Worker. Show setup guide, never crash
    if (!env.DB) {
      if (path.startsWith("/api/")) {
        return json({ error: "Cloudflare D1 数据库尚未绑定，变量名需为 DB" }, 503);
      }
      return new Response(setupPage(), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }

    // 2. Stage 2 & 3: DB bound, but tables not initialized or schema migration required
    const dbStatus = await checkDbStatus(env);
    if (!dbStatus.initialized) {
      if (path === "/api/setup/init" && method === "POST") {
        const body = await request.json().catch(() => ({})) as { password?: string };
        // If ADMIN_PASSWORD is set, require it for init; otherwise allow initial setup
        if (env.ADMIN_PASSWORD && body.password !== env.ADMIN_PASSWORD) {
          return json({ error: "初始化凭证密码错误" }, 401);
        }
        try {
          const res = await initDb(env);
          return json({ ok: true, version: res.version, message: "数据库初始化完成，核心数据表已建好" });
        } catch (err: any) {
          return json({ error: err.message || String(err) }, 500);
        }
      }
      if (path.startsWith("/api/")) {
        return json({ error: "数据库尚未初始化，请先访问根路径进行一键初始化" }, 503);
      }
      return new Response(initPage(env.ADMIN_PASSWORD ? true : false), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }

    // 3. AI Reality Context API (POST /api/agent/context)
    // Uses independent agent credential authentication (Section 28)
    if (path === "/api/agent/context" && method === "POST") {
      return handleAgentContextApi(request, env);
    }

    // 4. Probe endpoint (Cron or manual HTTP with PROBE_SECRET)
    if (path === "/api/probe" && method === "GET") {
      return probeHttp(request, env);
    }

    // 5. Authentication routes
    if (path === "/login") {
      if (method === "POST") {
        return login(request, env);
      }
      const isAuthed = await requireAuth(request, env);
      if (isAuthed) {
        return new Response(null, {
          status: 302,
          headers: { "Location": "/" }
        });
      }
      return new Response(renderLoginPage(), {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }

    if (path === "/logout" && method === "POST") {
      return logout(env, request);
    }

    // 6. Check Host Admin Session for other routes
    const isAuthed = await requireAuth(request, env);
    if (!isAuthed) {
      if (path.startsWith("/api/")) {
        return json({ error: "未登录或登录会话已过期" }, 401);
      }
      // If not authenticated, always return the native WeChat login page
      return new Response(renderLoginPage(), {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }

    // 7. Protected Front-end App (WeChat iOS 1:1 Interface)
    if (path === "/" || path === "/chat" || path === "/contacts" || path === "/moments" || path === "/me" || path === "/settings") {
      const user = await env.DB.prepare("SELECT * FROM users WHERE id = 1").first<any>();
      return new Response(renderWeChatApp({ authed: true, user }), {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }

    // 8. Protected API Routes: Chat & Messages
    if (path === "/api/chat/conversations" && method === "GET") {
      return getConversations(env);
    }
    if (path === "/api/chat/history" && method === "GET") {
      return getChatHistory(request, env);
    }
    if (path === "/api/sendChat" && method === "POST") {
      return sendChat(request, env);
    }
    if (path === "/api/chat/regenerate" && method === "POST") {
      return regenerateChat(request, env);
    }
    if (path === "/api/chat/edit" && method === "POST") {
      return editMessage(request, env);
    }
    if (path === "/api/chat/deleteMessage" && method === "POST") {
      return deleteChatMessage(request, env);
    }
    if (path === "/api/chat/clearHistory" && method === "POST") {
      return clearChatHistory(request, env);
    }
    if (path === "/api/chat/read" && method === "POST") {
      return markAsRead(request, env);
    }

    // 9. Moments (朋友圈)
    if (path === "/api/moments" && method === "GET") {
      return getMomentsFeed(env);
    }
    if (path === "/api/moments" && method === "POST") {
      return createMoment(request, env, ctx);
    }
    const momentMatch = path.match(/^\/api\/moments\/(\d+)$/);
    if (momentMatch && method === "DELETE") {
      return deleteMoment(request, env, Number(momentMatch[1]));
    }
    if (path === "/api/moments/like" && method === "POST") {
      return toggleLikeMoment(request, env);
    }
    if (path === "/api/moments/comment" && method === "POST") {
      return addCommentMoment(request, env, ctx);
    }
    const commentMatch = path.match(/^\/api\/moments\/comment\/(\d+)$/);
    if (commentMatch && method === "DELETE") {
      return deleteCommentMoment(request, env, Number(commentMatch[1]));
    }

    // 10. Agents (通讯录 & 智能体主页 & 设置)
    if (path === "/api/agents" && method === "GET") {
      return listAgents(env);
    }
    if (path === "/api/agents" && method === "POST") {
      return saveAgent(request, env);
    }
    const agentMatch = path.match(/^\/api\/agents\/(\d+)$/);
    if (agentMatch && method === "GET") {
      return getAgentDetail(env, Number(agentMatch[1]));
    }
    if (agentMatch && method === "DELETE") {
      return deleteAgent(request, env, Number(agentMatch[1]));
    }
    const memMatch = path.match(/^\/api\/agents\/(\d+)\/memories$/);
    if (memMatch) {
      return handleAgentMemories(request, env, Number(memMatch[1]));
    }
    const memMergeMatch = path.match(/^\/api\/agents\/(\d+)\/memories\/merge$/);
    if (memMergeMatch && method === "POST") {
      return mergeAgentMemories(request, env, Number(memMergeMatch[1]));
    }

    // 11. API Backends & Models
    if (path === "/api/backends" && method === "GET") {
      return listBackends(env);
    }
    if (path === "/api/backends" && method === "POST") {
      return saveBackend(request, env);
    }
    const backendMatch = path.match(/^\/api\/backends\/(\d+)$/);
    if (backendMatch && method === "DELETE") {
      return deleteBackend(request, env, Number(backendMatch[1]));
    }
    if (path === "/api/backends/test" && method === "POST") {
      return testBackend(request, env);
    }
    if (path === "/api/backends/details" && method === "GET") {
      return getBackendCallDetails(request, env);
    }
    if (path === "/api/backends/clearLogs" && method === "POST") {
      return clearBackendCallDetails(env);
    }
    if (path === "/api/stats/token" && method === "GET") {
      return getTokenStats(env);
    }

    // 12. System Settings & Cleanup Center
    if (path === "/api/settings" && method === "GET") {
      return getSystemSettings(env);
    }
    if (path === "/api/settings" && method === "POST") {
      return saveSystemSettings(request, env);
    }
    if (path === "/api/cleanup/preview" && method === "POST") {
      return previewCleanup(request, env);
    }
    if (path === "/api/cleanup/execute" && method === "POST") {
      return executeCleanup(request, env);
    }

    // 13. Export & Import
    if (path === "/api/export" && method === "GET") {
      return exportData(env);
    }
    if (path === "/api/import" && method === "POST") {
      return importData(request, env);
    }

    return json({ error: "接口不存在" }, 404);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (!env.DB) return;
    ctx.waitUntil(runProbe(env));
  }
} satisfies ExportedHandler<Env>;
