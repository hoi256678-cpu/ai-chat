import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.healthmate.shell",
  appName: "HealthMate",
  webDir: "www",
  server: {
    // 로컬 빌드 산출물을 배포하지 않고 배포된 프로덕션 사이트를 그대로 로드한다.
    // 도메인이 바뀌면 이 값만 갱신하면 된다.
    url: "https://ai-chat-black-nine.vercel.app",
    cleartext: false,
  },
};

export default config;
