import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // kiwi-nlp는 wasm 파일을 직접 읽으므로 번들하지 않고 node_modules에서 그대로 쓴다.
  serverExternalPackages: ["kiwi-nlp"],
  // 빌드 때 받은 Kiwi 모델과 wasm을 /api/chat 함수 배포 파일에 넣는다.
  outputFileTracingIncludes: {
    "/api/chat": ["./kiwi-model/**/*", "./node_modules/kiwi-nlp/dist/kiwi-wasm.wasm"],
  },
};

export default nextConfig;
