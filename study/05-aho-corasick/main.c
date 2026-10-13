// [직접 작성] 숨은 금지어 찾기, 아호코라식 (insert, build_fail, search, main) — 진행 중, 학습 기록: docs/study/algorithm-study-log.md §12
#include <stdio.h>
#include <stdlib.h>

// 복습: 04를 보지 않고 TrieNode / new_node / insert / build_fail 을 다시 짜 보세요.
// 막히면 그때 ../04-failure-link/main.c 를 열어도 됩니다.
typedef struct TrieNode {
    struct TrieNode *child[26];
    struct TrieNode *fail;
    int is_end;
    int depth;
} TrieNode;

TrieNode *new_node(void) {
    TrieNode *n = calloc(1, sizeof(TrieNode));  // calloc: child 전부 NULL, is_end 0으로 초기화
    return n;
}

void insert(TrieNode *root, const char *word) {
    TrieNode *current = root;
    for (int i=0; word[i] != '\0'; i++) {
        int idx = word[i] - 'a';

        if(current->child[idx] == NULL) {
            current->child[idx] = new_node();
        }

        current = current->child[idx];
        current->depth = i + 1;
    }

    current->is_end = 1;
}

// TODO 2: 큐(배열)를 이용해 BFS로 모든 노드의 fail 채우기
 void build_fail(TrieNode *root) {
    static TrieNode *queue[100001];

    int head = 0, tail = 0;

    root->fail = NULL;

    for(int idx=0;idx<26;idx++) {
        if(root->child[idx] != NULL ) {
            root->child[idx]->fail = root;
            queue[tail++] = root->child[idx];
        }
    }

    while(head != tail) {
        TrieNode *p = queue[head++];

        for(int idx=0;idx<26;idx++) {
            TrieNode *ch = p->child[idx];
            if(ch == NULL) {
                continue;
            }

            TrieNode *f = p->fail;
            while(f != root && f->child[idx] == NULL) {
                f = f->fail;
            }

            if(f->child[idx] != NULL) {
                ch->fail = f->child[idx];
            }
            else {
                ch->fail = root;
            }

            queue[tail++] = ch;
        }
    }
}

int search(TrieNode *root, const char *word) {
    TrieNode *current = root;
    int count = 0;

    for (int i=0; word[i] != '\0'; i++) {
        TrieNode *f = current;
        int idx = word[i] - 'a';

        while(f->fail != NULL) {
            if(f->is_end == 1) {
                count++;
            }

            f = f->fail;
        }

        if(current->child[idx] == NULL) {
            continue;
        }

        if(current->is_end == 1){
            count++;
        }
    
        current = current->child[idx];
    }

    return count;
}


// TODO: 메시지를 한 번만 훑으며 금지어 개수 세기
//   - 간선이 없으면 cur 가 실패 링크로 점프
//   - 도착할 때마다 임시 포인터로 사슬을 따라가며 is_end 세기 (cur 는 그대로)



int main(void) {
    // 1. N 읽기, 금지어 N개를 트라이에 insert
    // 2. build_fail
    // 3. 메시지 읽기
    // 4. 한 번 훑으며 세기, 개수 출력
    TrieNode *root = new_node();
    int N;
    char word[10001];

    scanf("%d", &N);

    for(int i=0;i<N;i++) {
        scanf("%s", word);
        insert(root, word);
    }

    build_fail(root);

    scanf("%s", word);

    printf("%d", search(root, word));

    return 0;
}
