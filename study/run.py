"""VS Code 단축키(Ctrl/Cmd + Shift + B)용: 지금 연 C 파일을 컴파일하고 실행한다.
같은 폴더에 tests/01-sample.in 이 있으면 예제 입력을 자동으로 넣는다."""
import os, shutil, subprocess, sys, tempfile
src = os.path.abspath(sys.argv[1]); folder = os.path.dirname(src)
cc = next((c for c in ("clang", "gcc", "cc") if shutil.which(c)), None) or sys.exit("C 컴파일러(clang 또는 gcc)가 없어요.")
binary = os.path.join(tempfile.mkdtemp(), "a.exe" if os.name == "nt" else "a.out")
if subprocess.run([cc, "-Wall", "-g", src, "-o", binary]).returncode != 0:
    sys.exit(1)
sample = os.path.join(folder, "tests", "01-sample.in")
if os.path.exists(sample):
    print("[예제 입력 tests/01-sample.in 으로 실행]", flush=True)
    subprocess.run([binary], stdin=open(sample, "rb"), cwd=folder)
else:
    subprocess.run([binary], cwd=folder)
