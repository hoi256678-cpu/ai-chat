// [직접 작성] 숨은 금지어 찾기, 단순한 방법 (naive_search, main) — 학습 기록: docs/study/algorithm-study-log.md §7
#include <stdio.h>
#include <stdlib.h>

// 01-trie 의 TrieNode / new_node / insert 를 가져와서 쓰세요.

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

int naive_search(TrieNode *root, const char *word) {
    TrieNode *current;
    int count = 0;
    for (int i=0; word[i] != '\0'; i++) {
        current = root;
        for (int j=0; word[i + j] != '\0'; j++) {
            int idx = word[i + j] - 'a';

            if(current->child[idx] == NULL) {
                break;
            }

            current = current->child[idx];
            count += current->is_end;
        }
    }

    return count; 
}

int main(void) {
    // 1. N 읽기, 금지어 N개를 트라이에 insert
    // 2. 메시지 읽기
    // 3. 메시지의 모든 시작 위치에서 트라이를 따라 내려가며 금지어 세기
    // 4. 개수 출력

    int N;
    
    char word[100001];

    TrieNode *root = new_node();

    scanf("%d", &N);

    for(int i=0; i<N; i++) {
        char word[101];
        scanf("%s", word);
        insert(root, word);
    }

    scanf("%s", word);
    
    printf("%d\n", naive_search(root, word));

    return 0;
}
