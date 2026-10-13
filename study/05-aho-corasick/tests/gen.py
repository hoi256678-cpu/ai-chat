"""05 아호코라식 검색 테스트 생성기. 큰 입력(10~13, 각 약 1MB)은 저장소에 올리지 않고 이걸로 다시 만든다.
정답은 키워드마다 str.find로 겹치는 위치를 하나씩 세서 따로 계산한다 (같은 글자만 반복되는 10, 11은 공식으로).
사용법: python3 gen.py   (이 폴더에서 실행. 기존 파일과 같은 내용이 생성된다)"""
import random
random.seed(20261013 + 5)
def count(S, T):
    total = 0
    for kw in S:
        pos = T.find(kw)
        while pos != -1:
            total += 1
            pos = T.find(kw, pos + 1)
    return total
def write(name, S, T, ans=None):
    with open(f"{name}.in","w",newline="\n") as f:
        f.write(f"{len(S)}\n" + "\n".join(S) + "\n" + T + "\n")
    with open(f"{name}.out","w",newline="\n") as f: f.write(f"{count(S, T) if ans is None else ans}\n")
def rw(lo,hi,al="abcdefghijklmnopqrstuvwxyz"): return "".join(random.choice(al) for _ in range(random.randint(lo,hi)))
def uniq(n,lo,hi,al="abcdefghijklmnopqrstuvwxyz"):
    s=set()
    while len(s)<n: s.add(rw(lo,hi,al))
    return sorted(s)  # 순서 고정: 파이썬 해시 무작위화와 무관하게 항상 같은 파일
write("01-sample", ["he","she","his","hers"], "ushers")
write("02-sample", ["a","aa"], "aaaa")
write("03-hishe", ["he","she","his","hers"], "hishe")
write("04-jump-to-ab", ["aaaab","ab"], "aaaaab")
write("05-dfs-trap", ["abcd","bcx","cd"], "abcxabcdbcd")
write("06-no-match", ["xyz","qq"], "abcabcabc")
write("07-whole-text", ["abc","b","abcabc"], "abcabc")
write("08-small-abc", uniq(50,1,5,"abc"), rw(300,300,"abc"))
write("09-random", uniq(1000,1,20,"ab"), rw(100000,100000,"ab"))
# 단순한 방법도, 사슬을 끝까지 따라가는 방법도 시간 초과: 위치마다 10,000칸 (약 100억 번)
n = 1000000
write("10-naive-killer", ["a"*10000, "a"*9999+"b"], "a"*n, ans=n-10000+1)
# 정답이 가장 커지는 경우: 위치마다 키워드 최대 446개가 끝난다 (메시지는 시간 여유를 두려고 40만 자)
K, m = 446, 400000
write("11-long-chain", ["a"*k for k in range(1, K+1)], "a"*m, ans=sum(m-k+1 for k in range(1, K+1)))
S = uniq(1000,1,100); T = "".join(random.choice(S) if random.random()<.3 else rw(1,5) for _ in range(60000))[:n]
write("12-big-random", S, T)
write("13-big-ab", uniq(1000,1,30,"ab"), rw(n,n,"ab"))
