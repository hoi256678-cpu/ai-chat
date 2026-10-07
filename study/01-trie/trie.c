// [직접 작성] 트라이 insert/search — 학습 기록: docs/study/algorithm-study-log.md §5
#include <stdio.h>
#include <stdlib.h>

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
    TrieNode *root = new_node();
    insert(root, "cat");
    insert(root, "car");
    insert(root, "cart");
    insert(root, "dog");

    // 기대값을 맞히는지 확인
    printf("cat  : %d (기대 1)\n", search(root, "cat"));
    printf("cart : %d (기대 1)\n", search(root, "cart"));
    printf("ca   : %d (기대 0)\n", search(root, "ca"));    // ← 함정 1
    printf("cars : %d (기대 0)\n", search(root, "cars"));  // ← 함정 2
    printf("dot  : %d (기대 0)\n", search(root, "dot"));
    return 0;
}
