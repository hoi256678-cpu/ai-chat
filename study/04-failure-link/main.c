// [직접 작성] BFS로 실패 링크 만들기 (insert의 depth, build_fail, find_node, main) — 학습 기록: docs/study/algorithm-study-log.md §9
#include <stdio.h>
#include <stdlib.h>

// 03 의 TrieNode / new_node / insert 를 가져와서 쓰세요.
// 실패 링크 말고도 필요한 필드가 있으면 구조체에 추가하세요. (PROBLEM.md "생각해 볼 것" 1번)

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

// TODO 3: 질문 문자열을 따라 내려가서 그 노드를 돌려주기
TrieNode *find_node(TrieNode *root, const char *word) {
    TrieNode *current = root;

    for (int i=0; word[i] != '\0'; i++) {
        int idx = word[i] - 'a';

        if(current->child[idx] == NULL) {
            return NULL;
        }

        current = current->child[idx];
    }

    return current;
}

int main(void) {
    // 1. N, Q 읽기, 금지어 N개를 트라이에 insert
    // 2. build_fail
    // 3. 질문 Q개마다 노드를 찾고, 그 fail 노드의 문자열 길이 출력
    TrieNode *root = new_node();

    int N, M;
    int len[100001];
    char word[101];

    scanf("%d %d\n", &N, &M);

    for(int i=0;i<N;i++) {
        scanf("%s", word);
        insert(root, word);
    }

    build_fail(root);

    for(int i=0;i<M;i++) {
        scanf("%s", word);
        len[i] = find_node(root, word)->fail->depth;
    }

    for(int i=0;i<M;i++){
        printf("%d\n", len[i]);
    }


    return 0;
}
