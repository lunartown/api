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

### 정적 프로토타입 (`nested-tables/`)
브라우저로 `nested-tables/index.html`을 직접 열거나, 로컬 서버로 폴더를 서빙할 수 있습니다.

```bash
python -m http.server -d nested-tables 5173
```

## 참고
- 생성물(`schema-viewer-react/dist/`, `node_modules/` 등)은 커밋하지 않습니다.
- 예시 입력/스키마는 루트의 `openapi.json`, `json.json`을 사용하세요.

