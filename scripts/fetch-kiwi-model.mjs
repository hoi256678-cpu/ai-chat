// 빌드·테스트 전에 Kiwi 공식 모델(v0.24.1 base, 약 104MB)을 kiwi-model/에 받는다.
// 모델을 GitHub에 올리지 않으려는 방법. 이미 있으면 건너뛴다. 실패하면 빌드도 실패한다(curl -f).
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dest = path.resolve("kiwi-model");
if (existsSync(path.join(dest, "cong.mdl"))) {
  console.log("kiwi-model: already present");
  process.exit(0);
}
const url = "https://github.com/bab2min/Kiwi/releases/download/v0.24.1/kiwi_model_v0.24.1_base.tgz";
const work = path.join(tmpdir(), "kiwi-model-dl");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
execSync(`curl -fsSL "${url}" -o "${work}/model.tgz" && tar -xzf "${work}/model.tgz" -C "${work}"`, { stdio: "inherit" });
const src = path.join(work, "models/cong/base");
mkdirSync(dest, { recursive: true });
// Vercel 빌드 서버는 /tmp가 다른 디스크라 rename이 실패한다(EXDEV). 복사한다.
for (const name of readdirSync(src)) copyFileSync(path.join(src, name), path.join(dest, name));
rmSync(work, { recursive: true, force: true });
console.log("kiwi-model: downloaded", readdirSync(dest).join(", "));
