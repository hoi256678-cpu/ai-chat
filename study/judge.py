"""자동 채점기 (Mac / Linux / Windows 공통)

사용법 (문제 폴더 안에서):  python3 ../judge.py          # main.c 채점
                            python3 ../judge.py trie.c   # 다른 파일 채점
Windows에서는 python3 대신 python 이나 py 를 쓴다.

tests/*.in 을 하나씩 넣어 실행하고 tests/*.out 과 비교해
맞았습니다 / 틀렸습니다 / 시간 초과 / 메모리 초과 / 런타임 에러 를 판정한다.
제한은 PROBLEM.md 첫 부분의 "시간 제한: N초 | 메모리 제한: M MB" 를 읽는다.
"""
import glob, os, re, shutil, subprocess, sys, tempfile, time

def find_compiler():
    for cc in ("clang", "gcc", "cc"):
        if shutil.which(cc):
            return cc
    sys.exit("C 컴파일러(clang 또는 gcc)를 찾을 수 없어요. Windows라면 MSYS2의 gcc나 LLVM clang을 설치하세요.")

def limits():
    sec, mb = 2.0, 1536
    if os.path.exists("PROBLEM.md"):
        head = open("PROBLEM.md", encoding="utf-8").read(500)
        m = re.search(r"시간 제한:\s*([\d.]+)\s*초", head); sec = float(m.group(1)) if m else sec
        m = re.search(r"메모리 제한:\s*(\d+)\s*MB", head); mb = int(m.group(1)) if m else mb
    return sec, mb

def run_case(binary, inp, sec):
    """(종료 코드, 출력, 걸린 ms, 최대 메모리 MB 또는 None)"""
    start = time.perf_counter()
    try:
        if os.name == "posix":
            import resource
            before = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
            p = subprocess.run([binary], stdin=open(inp, "rb"), capture_output=True, timeout=sec * 3)
            peak = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
            unit = 1 if sys.platform == "darwin" else 1024  # macOS는 바이트, Linux는 KB
            # 자식 프로세스 최대값이라, 이전 케이스보다 적게 쓰면 정확한 값 대신 상한(≤)만 안다
            mb = f"{peak * unit >> 20}" if peak > before else f"≤{peak * unit >> 20}"
        else:
            p = subprocess.run([binary], stdin=open(inp, "rb"), capture_output=True, timeout=sec * 3)
            mb = None  # Windows에서는 메모리를 재지 않는다
    except subprocess.TimeoutExpired:
        return None, b"", int((time.perf_counter() - start) * 1000), None
    return p.returncode, p.stdout, int((time.perf_counter() - start) * 1000), mb

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "main.c"
    sec, mb_limit = limits()
    cc = find_compiler()
    tmp = tempfile.mkdtemp()
    binary = os.path.join(tmp, "a.exe" if os.name == "nt" else "a.out")
    if subprocess.run([cc, "-O2", "-Wall", "-std=c11", src, "-o", binary]).returncode != 0:
        sys.exit("❌ 컴파일 에러")
    cases = sorted(glob.glob(os.path.join("tests", "*.in")))
    passed = 0
    for inp in cases:
        name = os.path.basename(inp)[:-3]
        expected = open(inp[:-3] + ".out", "rb").read().split()
        code, out, ms, mb = run_case(binary, inp, sec)
        if code is None or ms > sec * 1000:
            verdict = "⏰ 시간 초과"
        elif code != 0:
            verdict = f"💥 런타임 에러 (종료 코드 {code})"
        elif mb is not None and not mb.startswith("≤") and int(mb) > mb_limit:
            verdict = "🧠 메모리 초과"
        elif out.split() == expected:
            verdict = "✅ 맞았습니다"; passed += 1
        else:
            got = b" ".join(out.split())[:40].decode(errors="replace")
            want = b" ".join(expected)[:40].decode(errors="replace")
            verdict = f"❌ 틀렸습니다 (기대: {want} / 출력: {got})"
        print(f"{name:<18} {verdict:<30} {ms:>6}ms {('?' if mb is None else mb):>6}MB")
    shutil.rmtree(tmp, ignore_errors=True)
    print("----"); print(f"결과: {passed} / {len(cases)}")
    missing = [o for o in glob.glob(os.path.join("tests", "*.out")) if not os.path.exists(o[:-4] + ".in")]
    if missing and os.path.exists(os.path.join("tests", "gen.py")):
        print("※ 큰 테스트 파일이 없어요. tests 폴더에서 gen.py를 실행하면 만들어져요.")

if __name__ == "__main__":
    main()
