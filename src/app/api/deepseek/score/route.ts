import { NextResponse } from "next/server";
import {
  buildDeepSeekMessages,
  buildSongFromAiPayload,
  extractDeepSeekScorePayload,
  type DeepSeekScoreRequest,
} from "@/lib/music/deepseek-score";

export async function GET() {
  return NextResponse.json({
    serverKeyConfigured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeepSeekScoreRequest;
    const apiKey = (process.env.DEEPSEEK_API_KEY || body.apiKey || "").trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          code: "NO_DEEPSEEK_KEY",
          error:
            "尚未配置 DeepSeek API Key。请在页面输入框填入 sk-... 密钥（仅存于当前浏览器），或在服务端 .env.local 设置 DEEPSEEK_API_KEY。",
        },
        { status: 400 },
      );
    }

    const prompt = (body.prompt || "").trim();
    if (!prompt && !body.draftJianpu) {
      return NextResponse.json(
        { error: "请输入想要生成的曲名、风格或编配需求。" },
        { status: 400 },
      );
    }

    const modelName = body.modelName === "deepseek-reasoner" ? "deepseek-reasoner" : "deepseek-chat";
    const messages = buildDeepSeekMessages({
      ...body,
      prompt: prompt || "流行钢琴编配",
    });

    const upstreamBody: Record<string, unknown> = {
      model: modelName,
      messages,
      max_tokens: 2400,
    };
    if (modelName === "deepseek-chat") {
      upstreamBody.temperature = 0.35;
      upstreamBody.response_format = { type: "json_object" };
    }

    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    const rawText = await upstream.text();
    if (!upstream.ok) {
      let detail = `HTTP ${upstream.status}`;
      try {
        const errJson = JSON.parse(rawText) as { error?: { message?: string } };
        if (errJson.error?.message) detail = errJson.error.message;
      } catch {
        // use raw detail
      }
      return NextResponse.json(
        { error: `DeepSeek API 请求失败: ${detail}` },
        { status: upstream.status },
      );
    }

    const completion = JSON.parse(rawText) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "DeepSeek 未返回生成内容，请重试。" },
        { status: 502 },
      );
    }

    const payload = extractDeepSeekScorePayload(content);
    const song = buildSongFromAiPayload(payload, body.targetModel ?? "kbp1100");

    return NextResponse.json({
      song,
      payload,
      modelUsed: modelName,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "DeepSeek 自动生成曲谱失败",
      },
      { status: 500 },
    );
  }
}
