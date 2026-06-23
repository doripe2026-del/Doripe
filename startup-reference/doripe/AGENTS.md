# Doripe Web 작업 지침

이 폴더는 `doripe.kr`, `doripe.kr/admin`, `doripe.kr/app`, `doripe.kr/blog` 운영 코드를 관리합니다.

## 반드시 지킬 것

- admin 수정 후에는 `npm run build:admin`, `npm run typecheck`, `git diff --check`를 실행합니다.
- 검증이 끝나면 반드시 commit 후 GitHub에 push합니다.
- push가 인증 문제로 실패하면, 실패 이유와 사용자가 실행할 명령어를 마지막 응답에 명확히 남깁니다.
- old mobile app, IR 문서, Figma/Locofy 산출물은 이 repo에 다시 추가하지 않습니다.
- 비밀값은 절대 commit하지 않습니다.

## 주요 위치

- `public/index.html`: homepage
- `public/admin`: admin static files
- `public/app`: web MVP app
- `public/blog.html`, `public/blog`: blog
- `src/admin-ui`: admin React UI 원본
- `src/admin-routes/admin`: admin API route handler
- `src/admin-server`: admin 서버 공통 로직
- `api/admin`: Vercel admin API entry
