// Kiwi(한국어 형태소 분석기, kiwi-nlp 0.24.1, Apache-2.0)를 서버 메모리에 한 번만 올려 두고 쓴다.
// 모델 파일은 scripts/fetch-kiwi-model.mjs가 빌드 전에 kiwi-model/에 받는다.
// 첫 준비는 Vercel에서 약 5초(2026-11-18 측정)라서, 채팅방 진입 시 미리 준비한다(app/api/chat GET).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { KiwiBuilder, type Kiwi } from "kiwi-nlp";

export type MorphToken = { form: string; tag: string; wordPosition: number };

let loading: Promise<Kiwi> | null = null;

async function load(): Promise<Kiwi> {
  const builder = await KiwiBuilder.create(
    path.join(process.cwd(), "node_modules/kiwi-nlp/dist/kiwi-wasm.wasm")
  );
  const dir = path.join(process.cwd(), "kiwi-model");
  const modelFiles: Record<string, Uint8Array> = {};
  for (const name of readdirSync(dir)) {
    modelFiles[name] = new Uint8Array(readFileSync(path.join(dir, name)));
  }
  // 위키데이터 고유명사 사전은 판정에 필요 없고, 끄면 준비가 빨라진다(실험: 1.2초 → 0.55초).
  return builder.build({ modelFiles, loadMultiDict: false });
}

export function getKiwi(): Promise<Kiwi> {
  if (!loading) {
    loading = load().catch((error) => {
      loading = null; // 실패하면 다음 호출에서 다시 시도한다
      throw error;
    });
  }
  return loading;
}

export async function analyzeTokens(text: string): Promise<MorphToken[]> {
  const kiwi = await getKiwi();
  return kiwi.analyze(text).tokens.map((t) => ({ form: t.str, tag: t.tag, wordPosition: t.wordPosition }));
}
