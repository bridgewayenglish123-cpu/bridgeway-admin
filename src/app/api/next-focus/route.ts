import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_EDITS = 5

export async function POST(req: Request) {
  const { reportId, nextFocusEn } = await req.json()
  if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })
  if (!nextFocusEn?.trim()) return NextResponse.json({ error: 'nextFocusEn required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: report } = await admin
    .from('lesson_reports')
    .select('next_focus_edit_count')
    .eq('id', reportId)
    .single()

  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if ((report.next_focus_edit_count ?? 0) >= MAX_EDITS) {
    return NextResponse.json({ error: `已達編輯上限（${MAX_EDITS} 次）` }, { status: 400 })
  }

  // AI 翻譯
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  let zhText: string | null = null
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `把以下英文句子翻譯成繁體中文。只翻譯，不改寫、不增減內容，直接回傳中文翻譯，不加任何說明：\n\n${nextFocusEn.trim()}`
      }]
    })
    const block = msg.content[0]
    if (block.type === 'text') zhText = block.text.trim()
  } catch { zhText = null }

  const nextFocusObj = { en: nextFocusEn.trim(), zh: zhText }
  const newCount = (report.next_focus_edit_count ?? 0) + 1

  const { error } = await admin
    .from('lesson_reports')
    .update({
      next_focus: nextFocusObj,
      next_focus_edit_count: newCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, editCount: newCount, nextFocus: nextFocusObj })
}
