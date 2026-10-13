"""04 실패 링크 테스트 생성기. 정답은 정의 그대로(꼬리를 하나씩 떼어 트라이에 있는지 확인) 따로 계산한다.
사용법: python3 gen.py   (이 폴더에서 실행. 기존 파일과 같은 내용이 생성된다)"""
import random
random.seed(20261013)
def write(name, S, Q):
    with open(f"{name}.in","w",newline="\n") as f:
        f.write(f"{len(S)} {len(Q)}\n" + "\n".join(S) + "\n" + "\n".join(Q) + "\n")
    nodes = {w[:i] for w in S for i in range(1, len(w)+1)}
    def fail_len(q): return next((len(q)-k for k in range(1, len(q)) if q[k:] in nodes), 0)
    with open(f"{name}.out","w",newline="\n") as f: f.write("\n".join(str(fail_len(q)) for q in Q) + "\n")
def rw(lo,hi,al="abcdefghijklmnopqrstuvwxyz"): return "".join(random.choice(al) for _ in range(random.randint(lo,hi)))
def uniq(n,lo,hi,al="abcdefghijklmnopqrstuvwxyz"):
    s=set()
    while len(s)<n: s.add(rw(lo,hi,al))
    return sorted(s)  # 순서 고정: 파이썬 해시 무작위화와 무관하게 항상 같은 파일
def all_nodes(S): return sorted({w[:i] for w in S for i in range(1, len(w)+1)}, key=lambda s:(len(s), s))
def rand_nodes(S, q):
    out=[]
    for _ in range(q):
        w=random.choice(S); out.append(w[:random.randint(1,len(w))])
    return out
S=["he","she","his","hers"]; write("01-sample", S, all_nodes(S))
write("02-dfs-trap", ["abcd","bcx","cd"], ["ab","bc","abc","abcd"])
write("03-dfs-trap-all", ["abcd","bcx","cd"], all_nodes(["abcd","bcx","cd"]))
write("04-one-char", ["a"], ["a"])
S=["aaaa"]; write("05-same-letter", S, all_nodes(S))
S=["a","aa","aaa","ab","ba","bab","abab"]; write("06-overlap", S, all_nodes(S))
S=uniq(30,1,6,"ab"); write("07-small-ab", S, all_nodes(S))
S=uniq(200,1,10,"abc"); write("08-small-abc", S, all_nodes(S))
S=uniq(1000,1,100); write("09-random", S, rand_nodes(S, 100000))
S=uniq(1000,90,100,"ab"); write("10-deep-ab", S, rand_nodes(S, 100000))
S=["a"*100]+[("a"*random.randint(0,98)+"b"+"a"*99)[:100] for _ in range(2000)]; S=sorted(set(S))[:1000]
write("11-long-chain", S, rand_nodes(S, 100000))
