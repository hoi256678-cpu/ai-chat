// [직접 작성] 금지어 검사기 (트라이 활용 main) — 학습 기록: docs/study/algorithm-study-log.md §6
#include <stdio.h>
#include <stdlib.h>

// 01-trie 에서 짠 TrieNode / new_node / insert / search 를 가져와서 쓰세요.
//금지어 N개와 테스트 M개를 입력하면 출력으로 금지어 개수가 출력되게끔

typedef struct TrieNode {
    struct TrieNode *child[26];
    int is_end;
} TrieNode;

TrieNode *new_node(void) {
    TrieNode *n = calloc(1, sizeof(TrieNode));  // calloc: child 전부 NULL, is_end 0으로 초기화
    return n;
}

// TODO 1: word를 트라이에 넣기
void insert(TrieNode *root, const char *word) {
    TrieNode *current = root;
    for (int i=0; word[i] != '\0'; i++) {
        int idx = word[i] - 'a';

        if(current->child[idx] == NULL) {
            current->child[idx] = new_node();
        }

        current = current->child[idx];
    }

    current->is_end = 1;
}

// TODO 2: word가 트라이에 "단어로" 있으면 1, 없으면 0
int search(TrieNode *root, const char *word) {
    TrieNode *current = root;
    for (int i=0; word[i] != '\0'; i++) {
        int idx = word[i] - 'a';

        if(current->child[idx] == NULL) {
            return 0;
        }

        current = current->child[idx];
    }


    return current->is_end; 
}


int main(void) {
    // 1. N, M 읽기
    // 2. 금지어 N개를 트라이에 insert
    // 3. 메시지 M개를 search 해서 개수 세기
    // 4. 개수 출력

    int N, M;
    int count = 0;

    TrieNode *root = new_node();

    scanf("%d", &N);
    scanf("%d", &M);

    for(int i=0; i<N; i++) {
        char word[501];
        scanf("%s", word);
        insert(root, word);
    }

    for(int i=0; i<M; i++) {
        char word[501];
        scanf("%s", word);
        
        count += search(root, word);
    }
    
    printf("%d", count);

    return 0;
}
