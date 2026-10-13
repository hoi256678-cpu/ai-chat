# 알고리즘 공부 폴더

졸작(`ai-chat`)에 직접 구현한 알고리즘을 넣기 위해 C로 먼저 공부하고 검증하는 곳이다. 진도와 내용은 `../docs/study/algorithm-study-log.md`, 직접 작성한 코드 목록은 `../docs/study/AUTHORSHIP.md`에 있다.

## 시작하기

1. VS Code에서 **이 `study` 폴더를 따로 연다** (`ai-chat` 전체가 아니라). 그래야 아래 설정이 적용된다.
   - `Ctrl/Cmd + Shift + B`: 지금 연 C 파일을 컴파일하고 실행한다. 폴더에 `tests/01-sample.in`이 있으면 예제 입력을 자동으로 넣는다.
   - 이 폴더에서는 GitHub Copilot 자동완성이 꺼진다.
2. 필요한 것: C 컴파일러(`clang` 또는 `gcc`)와 Python 3.
   - Mac: `xcode-select --install`
   - Windows: MSYS2로 gcc를 설치하거나 LLVM(clang)을 설치하고 PATH에 추가한다.

## 채점

문제 폴더 안에서:

```bash
python3 ../judge.py          # main.c 채점 (Windows: python ../judge.py)
```

큰 테스트 입력(`02-string-set`의 07·08, `04-failure-link`의 09~11, `05-aho-corasick`의 10~13)은 저장소에 없다. `tests` 폴더에서 `python3 gen.py`를 실행하면 같은 내용으로 다시 만들어진다.

## 폴더 규칙

- 문제마다 `NN-주제/` 폴더: `PROBLEM.md`(문제), `main.c`(풀이), `tests/*.in`·`*.out`(테스트).
- 직접 쓴 풀이 파일 첫 줄에는 `// [직접 작성] …` 표시를 둔다.
