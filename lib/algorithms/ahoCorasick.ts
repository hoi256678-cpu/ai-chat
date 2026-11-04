// [직접 작성] 아호코라식 TypeScript 포팅 (TrieNode, newNode, insert, buildFail, countMatches) — 학습 기록: docs/study/algorithm-study-log.md §11
// 아호코라식: 키워드 여러 개를 텍스트 한 번 훑기로 동시에 찾는다.
// study/05-aho-corasick/main.c 를 TypeScript로 옮기는 자리 (A 2단계).
//
// C와 달라지는 점
//   - child[26] 배열 → Map<string, 노드>  (한글 음절만 11,172자라 배열로는 못 만든다)
//   - calloc/포인터 → 객체와 참조. free 도 필요 없다 (가비지 컬렉터)
//   - 큐: 배열 + head 인덱스. queue.shift() 는 매번 O(n) 이라 쓰지 않는다
//   - 텍스트 순회: for (const ch of text) 로 한 글자씩

type TrieNode = {
  child: Map<string, TrieNode>;
  fail: TrieNode | null;
  is_end: number;
}

function newNode(): TrieNode {
  return {
    child: new Map<string, TrieNode>(),
    fail: null,
    is_end: 0,
  };
}

export class AhoCorasick {
  private root: TrieNode = newNode();



  constructor(keywords: readonly string[]) {
    // TODO: 키워드마다 insert, 다 넣은 뒤 buildFail
    for (const word of keywords) {
      this.insert(word);
    }

    this.buildFail();
  }

  private insert(word: string): void {
    let current = this.root;

    for (const ch of word) {
      if (!current.child.has(ch)) {
        current.child.set(ch, newNode());
      }

      current = current.child.get(ch)!;
    }

    current.is_end = 1;
  }

  // TODO: private buildFail()
  private buildFail(): void {
    const queue: TrieNode[] = [];
    let head = 0;

    for (const ch of this.root.child.values()) {
      ch.fail = this.root;
      queue.push(ch);
    }

    while (head < queue.length) {
      const p = queue[head++];

      for (const [ch, next] of p.child) {
        let f = p.fail!;

        while (f !== this.root && !f.child.has(ch)) {
          f = f.fail!;
        }

        if (f.child.has(ch)) {
          next.fail = f.child.get(ch)!;
        }
        else {
          next.fail = this.root;
        }

        next.is_end += next.fail.is_end;
        queue.push(next);
      }
    }
  }

  /** text 안에 등장하는 키워드의 총 횟수 (겹쳐도, 같은 키워드가 여러 번 나와도 각각 센다) */
  countMatches(text: string): number {
    let p = this.root;
    let count = 0;

    for (const ch of text) {
      while (p !== this.root && !p.child.has(ch)) {
        p = p.fail!;
      }

      if (p.child.has(ch)) {
        p = p.child.get(ch)!;
      }

      count += p.is_end;
    }

    return count;
  }
}
