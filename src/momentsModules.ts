import type { Env, Moment, Comment, Like } from "./types";
import { json, now } from "./types";
import { processUserMomentImmediately } from "./probe";

export async function getMomentsFeed(env: Env): Promise<Response> {
  if (!env.DB) return json([]);

  // Fetch host info
  const host = await env.DB.prepare("SELECT id, nickname, avatar_url, moments_background_url FROM users WHERE id = 1").first<any>();

  // Host can see ALL moments. If an AI set visibility to private/blacklist/etc that excludes host,
  // we still return it with `blocked_host = true` as required by Section 21 of PRD.
  const momentsRows = await env.DB.prepare(`
    SELECT m.*,
      CASE WHEN m.author_type = 'user' THEN ? ELSE COALESCE(a.name, '智能体') END AS author_name,
      CASE WHEN m.author_type = 'user' THEN ? ELSE COALESCE(a.avatar_url, '') END AS author_avatar,
      (SELECT COUNT(*) FROM likes l WHERE l.moment_id = m.id) AS like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.moment_id = m.id) AS comment_count,
      EXISTS(SELECT 1 FROM likes l WHERE l.moment_id = m.id AND l.actor_type = 'user' AND l.actor_id = 1) AS is_liked_by_host
    FROM moments m
    LEFT JOIN agents a ON a.id = m.author_id
    ORDER BY m.created_at DESC
    LIMIT 100
  `).bind(host?.nickname || "宿主", host?.avatar_url || "").all<any>();

  const moments = momentsRows.results || [];
  if (moments.length === 0) {
    return json({ host, moments: [] });
  }

  const momentIds = moments.map(m => Number(m.id)).filter(Boolean);
  const placeholders = momentIds.map(() => "?").join(",");

  // Fetch all likes
  const likesRows = await env.DB.prepare(`
    SELECT l.*,
      CASE WHEN l.actor_type = 'user' THEN ? ELSE COALESCE(a.name, '智能体') END AS actor_name,
      CASE WHEN l.actor_type = 'user' THEN ? ELSE COALESCE(a.avatar_url, '') END AS actor_avatar
    FROM likes l
    LEFT JOIN agents a ON a.id = l.actor_id
    WHERE l.moment_id IN (${placeholders})
    ORDER BY l.id ASC
  `).bind(host?.nickname || "宿主", host?.avatar_url || "").all<any>();

  // Fetch all comments
  const commentsRows = await env.DB.prepare(`
    SELECT c.*,
      CASE WHEN c.actor_type = 'user' THEN ? ELSE COALESCE(a.name, '智能体') END AS actor_name,
      CASE WHEN c.actor_type = 'user' THEN ? ELSE COALESCE(a.avatar_url, '') END AS actor_avatar,
      CASE
        WHEN c.reply_to_actor_type = 'user' THEN ?
        WHEN c.reply_to_actor_type = 'agent' THEN COALESCE(ra.name, '智能体')
        ELSE NULL
      END AS reply_to_name
    FROM comments c
    LEFT JOIN agents a ON a.id = c.actor_id
    LEFT JOIN agents ra ON ra.id = c.reply_to_actor_id
    WHERE c.moment_id IN (${placeholders})
    ORDER BY c.created_at ASC, c.id ASC
  `).bind(
    host?.nickname || "宿主", host?.avatar_url || "",
    host?.nickname || "宿主"
  ).all<any>();

  const likesMap = new Map<number, Like[]>();
  for (const l of likesRows.results || []) {
    const list = likesMap.get(Number(l.moment_id)) || [];
    list.push(l as Like);
    likesMap.set(Number(l.moment_id), list);
  }

  const commentsMap = new Map<number, Comment[]>();
  for (const c of commentsRows.results || []) {
    const list = commentsMap.get(Number(c.moment_id)) || [];
    list.push(c as Comment);
    commentsMap.set(Number(c.moment_id), list);
  }

  const feed: Moment[] = moments.map(m => {
    let blockedHost = false;
    if (m.author_type === "agent") {
      if (m.visibility === "private") {
        blockedHost = true;
      } else if (m.visibility === "blacklist") {
        try {
          const bl = JSON.parse(m.visibility_agents_json || "[]");
          if (Array.isArray(bl) && bl.includes("user")) blockedHost = true;
        } catch {}
      } else if (m.visibility === "whitelist") {
        try {
          const wl = JSON.parse(m.visibility_agents_json || "[]");
          if (Array.isArray(wl) && !wl.includes("user")) blockedHost = true;
        } catch {}
      }
    }

    return {
      ...m,
      is_liked_by_host: Boolean(m.is_liked_by_host),
      blocked_host: blockedHost,
      likes: likesMap.get(Number(m.id)) || [],
      comments: commentsMap.get(Number(m.id)) || []
    };
  });

  return json({ host, moments: feed });
}

export async function createMoment(req: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const b = await req.json().catch(() => ({})) as any;
  const content = String(b.content || "").trim();
  const images = Array.isArray(b.images) ? b.images : [];
  const visibility = ["public", "private", "whitelist", "blacklist", "host_only"].includes(b.visibility)
    ? b.visibility
    : "public";
  const visibilityAgents = Array.isArray(b.visibility_agents) ? b.visibility_agents : [];

  if (!content && images.length === 0) {
    return json({ error: "朋友圈内容或图片不能为空" }, 400);
  }

  const currentTime = now();
  const result = await env.DB.prepare(`
    INSERT INTO moments(author_type, author_id, content, images_json, background_url, visibility, visibility_agents_json, created_at)
    VALUES ('user', 1, ?, ?, ?, ?, ?, ?)
  `).bind(
    content,
    JSON.stringify(images),
    String(b.background_url || ""),
    visibility,
    JSON.stringify(visibilityAgents),
    currentTime
  ).run();

  const momentId = Number(result.meta.last_row_id);

  // Add task to probe_tasks for fail-safe background processing
  const task = await env.DB.prepare(`
    INSERT INTO probe_tasks(event_type, payload_json, status, created_at)
    VALUES ('user_moment', ?, 'pending', ?)
  `).bind(JSON.stringify({ momentId, immediate: true }), currentTime).run();

  const taskId = Number(task.meta.last_row_id);

  // Immediate AI reaction execution via ExecutionContext
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil((async () => {
      const res = await processUserMomentImmediately(env, momentId);
      if (res.failed === 0) {
        await env.DB?.prepare(
          "UPDATE probe_tasks SET status = 'done', processed_at = ? WHERE id = ?"
        ).bind(now(), taskId).run();
      }
    })());
  } else {
    // If ctx not available (e.g. testing)
    processUserMomentImmediately(env, momentId).catch(console.error);
  }

  return json({ ok: true, id: momentId });
}

export async function deleteMoment(req: Request, env: Env, momentId: number): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  // Host has permission to delete own moments or admin manage moments
  await env.DB.prepare("DELETE FROM moments WHERE id = ?").bind(momentId).run();
  await env.DB.prepare("DELETE FROM likes WHERE moment_id = ?").bind(momentId).run();
  await env.DB.prepare("DELETE FROM comments WHERE moment_id = ?").bind(momentId).run();

  return json({ ok: true });
}

export async function toggleLikeMoment(req: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const b = await req.json().catch(() => ({})) as any;
  const momentId = Number(b.momentId);
  if (!momentId) return json({ error: "momentId required" }, 400);

  // Check if already liked by host
  const existing = await env.DB.prepare(
    "SELECT id FROM likes WHERE moment_id = ? AND actor_type = 'user' AND actor_id = 1"
  ).bind(momentId).first<any>();

  if (existing) {
    // Unlike
    await env.DB.prepare(
      "DELETE FROM likes WHERE id = ?"
    ).bind(existing.id).run();
    return json({ ok: true, action: "unliked", liked: false });
  } else {
    // Like
    await env.DB.prepare(`
      INSERT INTO likes(moment_id, actor_type, actor_id, created_at)
      VALUES (?, 'user', 1, ?)
    `).bind(momentId, now()).run();

    // Trigger AI response probe task
    await env.DB.prepare(`
      INSERT INTO probe_tasks(event_type, payload_json, status, created_at)
      VALUES ('user_like', ?, 'pending', ?)
    `).bind(JSON.stringify({ momentId }), now()).run();

    return json({ ok: true, action: "liked", liked: true });
  }
}

export async function addCommentMoment(req: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  const b = await req.json().catch(() => ({})) as any;
  const momentId = Number(b.momentId);
  const content = String(b.content || "").trim();
  const parentId = b.parentId ? Number(b.parentId) : null;
  const replyToActorType = b.replyToActorType ? String(b.replyToActorType) : null;
  const replyToActorId = b.replyToActorId ? Number(b.replyToActorId) : null;

  if (!momentId || !content || content.length > 1000) {
    return json({ error: "评论内容不能为空或超过1000字符" }, 400);
  }

  const currentTime = now();
  const result = await env.DB.prepare(`
    INSERT INTO comments(moment_id, actor_type, actor_id, parent_id, reply_to_actor_type, reply_to_actor_id, content, created_at)
    VALUES (?, 'user', 1, ?, ?, ?, ?, ?)
  `).bind(momentId, parentId, replyToActorType, replyToActorId, content, currentTime).run();

  const commentId = Number(result.meta.last_row_id);

  // Enqueue probe task
  await env.DB.prepare(`
    INSERT INTO probe_tasks(event_type, payload_json, status, created_at)
    VALUES ('user_comment', ?, 'pending', ?)
  `).bind(JSON.stringify({ momentId, commentId, replyToActorType, replyToActorId }), currentTime).run();

  return json({ ok: true, id: commentId });
}

export async function deleteCommentMoment(req: Request, env: Env, commentId: number): Promise<Response> {
  if (!env.DB) return json({ error: "数据库未配置" }, 503);

  await env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(commentId).run();
  return json({ ok: true });
}
