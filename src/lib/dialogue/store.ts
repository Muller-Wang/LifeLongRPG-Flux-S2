import { createHash } from 'crypto';
import { getSupabase } from '../supabase';
import { ensureUserProfile } from '../user/store';

export interface DialogueTemplate {
  id: string;
  scene: string;
  stage: 1 | 2 | 3;
  title: string | null;
  templateText: string;
  notes: string | null;
}

export async function getDialogueTemplate(
  scene: string,
  stage: 1 | 2 | 3
): Promise<DialogueTemplate | null> {
  const sb = getSupabase();
  const exact = await fetchTemplate(scene, stage);
  if (exact) return exact;
  if (scene === 'free_chat') return null;
  return fetchTemplate('free_chat', stage);
}

export async function logUtterance(input: {
  userId: string;
  scene: string;
  stage: 1 | 2 | 3;
  content: string;
}): Promise<void> {
  await ensureUserProfile({ id: input.userId });
  const sb = getSupabase();
  const contentHash = createHash('sha1').update(input.content).digest('hex');
  const { error } = await sb.from('utterances').insert({
    user_id: input.userId,
    scene: input.scene,
    stage: input.stage,
    content: input.content,
    content_hash: contentHash
  });

  if (error) {
    throw new Error(`[dialogue] utterance 写入失败: ${error.message}`);
  }
}

export async function logDialogueTurn(input: {
  userId: string;
  scene: string;
  stage: 1 | 2 | 3;
  userMessage: string;
  assistantReply: string;
  memoryUsedId?: string | null;
  templateId?: string | null;
  debugPayload?: Record<string, unknown>;
}): Promise<void> {
  await ensureUserProfile({ id: input.userId });
  const sb = getSupabase();
  const { error } = await sb.from('dialogue_logs').insert({
    user_id: input.userId,
    scene: input.scene,
    stage: input.stage,
    user_message: input.userMessage,
    assistant_reply: input.assistantReply,
    memory_used_id: input.memoryUsedId ?? null,
    template_id: input.templateId ?? null,
    debug_payload: input.debugPayload ?? {}
  });

  if (error) {
    throw new Error(`[dialogue] log 写入失败: ${error.message}`);
  }
}

async function fetchTemplate(
  scene: string,
  stage: 1 | 2 | 3
): Promise<DialogueTemplate | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('dialogue_templates')
    .select('*')
    .eq('scene', scene)
    .eq('stage', stage)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`[dialogue] 模板读取失败: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    scene: data.scene,
    stage: data.stage,
    title: data.title,
    templateText: data.template_text,
    notes: data.notes
  };
}
