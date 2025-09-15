# API Project

간단한 스키마 뷰어와 프로토타입들이 포함된 레포입니다. Vite + React + TypeScript 앱(`schema-viewer-react/`)과 정적 프로토타입(`nested-tables/`)이 포함되어 있습니다.

## 요구 사항
- Node.js 20 이상 권장 (`schema-viewer-react/.nvmrc` → 20)
- npm 9+ (권장)

## 프로젝트 구조
- `schema-viewer-react/`: Vite + React + TypeScript 앱 (소스는 `src/`)
- `nested-tables/`: 정적 프로토타입 (브라우저로 `index.html` 열기 가능)
- 루트 데이터 예시: `openapi.json`, `json.json`

## 빠른 시작
1) 레포 클론

```bash
git clone https://github.com/lunartown/api.git
cd api
```

2) Node 버전 설정(선택)

```bash
nvm use
```

### React 앱 (`schema-viewer-react/`)
개발 서버 실행, 프로덕션 빌드, 프리뷰는 다음 명령을 사용합니다.

```bash
cd schema-viewer-react
npm install

# 개발 서버 (Vite)
npm run dev

# 프로덕션 빌드 (dist/ 생성)
npm run build

# 빌드 프리뷰 (로컬 서빙)
npm run preview
```

- 기본 포트는 5173입니다. 사용 중일 경우 Vite가 다른 포트를 선택합니다.
- UI 컴포넌트는 `src/components`, 파싱/레이아웃 로직은 `src/lib`에 위치합니다.

## Self-Feedback Workflow (Playwright + In-App)

- 자동 검증 루프: `schema-viewer-react/dev/verify-loop.mjs`
  - 주기적으로 `playwright test --reporter=json`을 실행해 결과를 `schema-viewer-react/public/verify-status.json`에 기록합니다.
  - 앱 툴바에 “Verify: PASS/FAIL (passed/total)”가 자동 표시됩니다.
  - 실행: `cd schema-viewer-react && npm run verify:loop`

- 원클릭 검증: `npm run verify`
  - 프로덕션 빌드 후 Playwright 전체 스위트를 실행합니다.

- In-App Self Check 버튼
  - 앱 우상단 툴바의 “Self Check”를 누르면 UI가 스스로 펼치기/접기 시나리오를 수행하고, 레이아웃 불변식을 측정해 팝업/콘솔로 결과를 보여줍니다.

- Runtime Debug
  - 툴바의 “Debug ON/OFF” 버튼 또는 콘솔에서 `localStorage.setItem('layoutDebug','1')` 설정으로 활성화.
  - 레이아웃 정렬 직후 스스로 위반 케이스를 수집해 콘솔에 `[layoutDebug]` 로그로 출력합니다.

### Playwright
- 설정: `schema-viewer-react/playwright.config.cjs` (기본 포트 5173, `npm run dev`를 webServer로 자동 실행)
- 테스트 경로: `schema-viewer-react/tests/`
  - `ui-flows.spec.mjs` 등 기존 플로우 테스트
  - `layout-order.spec.mjs`: 레이아웃 불변식(형제 스택 순서, 부모-자식 정렬, 접힘 전파) 자동 검증

### CI
- GitHub Actions: `.github/workflows/e2e.yml`
  - Node 20, `npm ci`, `npm run build`, `npx playwright test`
  - 리포트(`playwright-report`)와 원시 결과(`test-results`) 아티팩트 업로드

### 정적 프로토타입 (`nested-tables/`)
브라우저로 `nested-tables/index.html`을 직접 열거나, 로컬 서버로 폴더를 서빙할 수 있습니다.

```bash
python -m http.server -d nested-tables 5173
```

## 참고
- 생성물(`schema-viewer-react/dist/`, `node_modules/` 등)은 커밋하지 않습니다.
- 검증 결과 파일(`schema-viewer-react/public/verify-status.json`)과 Playwright 트레이스 아티팩트는 `.gitignore`에 포함되어 커밋되지 않습니다.
- 예시 입력/스키마는 루트의 `openapi.json`, `json.json`을 사용하세요.
