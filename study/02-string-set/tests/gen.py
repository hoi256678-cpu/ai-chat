"""02 금지어 검사기 테스트 생성기. 큰 입력(07, 08: 각 약 10MB)은 저장소에 올리지 않고 이걸로 다시 만든다.
사용법: python3 gen.py   (이 폴더에서 실행. 기존 파일과 같은 내용이 생성된다)"""
import random
random.seed(14425)
def write(name, S, Q):
    with open(f"{name}.in","w",newline="\n") as f:
        f.write(f"{len(S)} {len(Q)}\n" + "\n".join(S) + "\n" + "\n".join(Q) + "\n")
    s=set(S)
    with open(f"{name}.out","w",newline="\n") as f: f.write(f"{sum(q in s for q in Q)}\n")
def rw(lo,hi,al="abcdefghijklmnopqrstuvwxyz"): return "".join(random.choice(al) for _ in range(random.randint(lo,hi)))
def uniq(n,lo,hi,al="abcdefghijklmnopqrstuvwxyz"):
    s=set()
    while len(s)<n: s.add(rw(lo,hi,al))
    return sorted(s)  # 순서 고정: 파이썬 해시 무작위화와 무관하게 항상 같은 파일
write("01-sample", ["cat","car","cart","dog"], ["ca","cat","cars","dog","cat","do"])
write("02-prefix", ["abcde"], ["a","ab","abc","abcd","abcde","abcdef"])
write("03-one-char", ["a","z"], ["a","z","b","a","zz"])
write("04-alphabet", [chr(97+i) for i in range(26)], [chr(97+i)*2 for i in range(26)]+[chr(97+i) for i in range(0,26,2)])
S=uniq(200,1,8,"abc"); write("05-small-abc", S, [rw(1,8,"abc") for _ in range(300)])
S=uniq(10000,1,30); Q=[random.choice(S) if random.random()<.5 else rw(1,30) for _ in range(10000)]; write("06-random", S, Q)
base="a"*499; S=[base+chr(97+i%26) if i<26 else rw(500,500) for i in range(10000)]; S=list(dict.fromkeys(S))
Q=[random.choice(S) if random.random()<.5 else base for _ in range(10000)]; write("07-long-shared", S, Q)
S=uniq(10000,500,500); Q=[random.choice(S) if random.random()<.5 else rw(500,500) for _ in range(10000)]; write("08-worst-memory", S, Q)
