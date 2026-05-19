# Copilot API Bridge

VS Code의 GitHub Copilot Language Model API를 로컬 HTTP 서버로 노출하는 확장입니다.  
다른 프로그램에서 `http://127.0.0.1:3141/v1/chat/completions` 형태로 호출하면  
OpenAI-compatible API처럼 Copilot 모델을 사용할 수 있습니다.

## 아키텍처

```
[외부 프로그램/스크립트]
        │  HTTP (localhost:3141)
        ▼
[VS Code Extension - copilot-api-bridge]
        │  vscode.lm API
        ▼
[GitHub Copilot Language Model]
```

## 설치 방법

### 1. 빌드

```bash
cd tools/copilot-api-bridge
npm install
npm run compile
```

### 2. VS Code에 설치 (개발 모드)

방법 A: **VSIX 패키징 없이 직접 실행**
1. VS Code에서 `tools/copilot-api-bridge` 폴더를 열기
2. `F5`로 Extension Development Host 실행
3. 새 창에서 자동으로 서버 시작됨

방법 B: **VSIX로 패키징하여 설치**
```bash
npm install -g @vscode/vsce
cd tools/copilot-api-bridge
vsce package
# copilot-api-bridge-0.1.0.vsix 파일 생성됨
```
VS Code에서: Extensions → `...` → "Install from VSIX..."로 설치

방법 C: **심볼릭 링크** (가장 간편, 개발용)
```powershell
# PowerShell (관리자)
$extDir = "$env:USERPROFILE\.vscode\extensions\local.copilot-api-bridge-0.1.0"
New-Item -ItemType Junction -Path $extDir -Target "C:\Users\LGRnD\Documents\GitHub\vscode-doc-workspace\tools\copilot-api-bridge"
```
VS Code 재시작하면 확장 인식됨.

## 사용법

### 서버 시작/중지

- Command Palette (`Ctrl+Shift+P`):
  - `Copilot API Bridge: Start Server`
  - `Copilot API Bridge: Stop Server`
  - `Copilot API Bridge: Show Status`
- 기본적으로 VS Code 시작 시 자동 실행됨

### API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/health` | 서버 상태 확인 |
| GET | `/v1/models` | 사용 가능한 모델 목록 |
| POST | `/v1/chat/completions` | 채팅 완성 (OpenAI 호환) |

### 요청 예시

#### curl (비스트리밍)
```bash
curl http://127.0.0.1:3141/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4.6",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### curl (스트리밍)
```bash
curl http://127.0.0.1:3141/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4.6",
    "messages": [
      {"role": "user", "content": "Write a haiku about coding"}
    ],
    "stream": true
  }'
```

#### Python (requests)
```python
import requests

response = requests.post(
    "http://127.0.0.1:3141/v1/chat/completions",
    json={
        "model": "claude-opus-4.6",
        "messages": [
            {"role": "system", "content": "문서 리뷰어입니다. 문서의 문제점을 찾아주세요."},
            {"role": "user", "content": "여기 문서 내용입니다: ..."}
        ]
    }
)
print(response.json()["choices"][0]["message"]["content"])
```

#### Python (openai 라이브러리 호환)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:3141/v1",
    api_key="not-needed"  # 토큰 미설정 시 아무 값이나 가능
)

response = client.chat.completions.create(
    model="claude-opus-4.6",
    messages=[
        {"role": "system", "content": "기술 문서 리뷰어입니다."},
        {"role": "user", "content": "이 문서를 리뷰해주세요: ..."}
    ]
)
print(response.choices[0].message.content)
```

## 설정 옵션

VS Code Settings (`Ctrl+,`)에서 설정 가능:

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `copilot-api-bridge.port` | `3141` | HTTP 서버 포트 |
| `copilot-api-bridge.autoStart` | `true` | VS Code 시작 시 자동 실행 |
| `copilot-api-bridge.defaultModel` | `claude-opus-4.6` | 기본 모델 family |
| `copilot-api-bridge.authToken` | `""` | Bearer 토큰 (비어있으면 인증 없이 localhost만 허용) |

## 보안 참고

- **localhost(127.0.0.1)에서만** 접근 가능합니다.
- 외부 네트워크 노출 없음 — 같은 PC에서만 사용 가능.
- 선택적으로 Bearer 토큰을 설정하여 추가 인증 가능.
- VS Code가 실행 중일 때만 동작합니다.

## 활용 시나리오

1. **문서 리뷰 자동화**: Python 스크립트로 docx/pdf 텍스트 추출 → API로 리뷰 요청
2. **Streamlit 앱에서 AI 기능**: 내부 웹앱에서 Copilot 호출
3. **배치 처리**: 여러 문서를 순차적으로 AI 리뷰
4. **커스텀 에이전트**: LangChain/LlamaIndex 등에서 이 엔드포인트를 LLM으로 사용

## 제한사항

- VS Code가 열려있어야 합니다 (백그라운드 서비스 아님)
- 첫 번째 요청 시 VS Code가 Copilot 권한 동의를 요청할 수 있음
- 동시 요청은 순차 처리됩니다
- token 사용량(usage)은 정확하게 측정되지 않습니다 (-1 반환)
- Copilot의 rate limit이 그대로 적용됩니다

## 문제 해결

| 문제 | 해결 |
|------|------|
| 서버가 시작되지 않음 | 포트 충돌 확인 → 설정에서 포트 변경 |
| 모델 없음 오류 | GitHub Copilot 확장이 활성화되어 있는지 확인 |
| 권한 오류 | VS Code에서 Copilot 확장 로그인 확인 |
| 응답 없음 | VS Code Output 패널 → "Copilot API Bridge" 확인 |
