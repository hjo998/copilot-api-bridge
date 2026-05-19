"""
Copilot API Bridge 테스트 스크립트
VS Code에서 확장이 실행 중일 때 이 스크립트를 실행하세요.
"""
import requests
import json
import sys

BASE_URL = "http://127.0.0.1:3141"

def test_health():
    """서버 상태 확인"""
    print("=== Health Check ===")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.json()}")
        return r.status_code == 200
    except requests.ConnectionError:
        print("ERROR: 서버에 연결할 수 없습니다. VS Code에서 확장이 실행 중인지 확인하세요.")
        return False

def test_models():
    """사용 가능한 모델 목록 조회"""
    print("\n=== Available Models ===")
    r = requests.get(f"{BASE_URL}/v1/models", timeout=10)
    data = r.json()
    for model in data.get("data", []):
        print(f"  - {model['id']} (max tokens: {model['meta']['maxInputTokens']})")
    return data

def test_completion():
    """간단한 채팅 완성 테스트"""
    print("\n=== Chat Completion Test ===")
    r = requests.post(
        f"{BASE_URL}/v1/chat/completions",
        json={
            "model": "claude-opus-4.6",
            "messages": [
                {"role": "system", "content": "간결하게 한국어로 답하세요."},
                {"role": "user", "content": "1+1은?"}
            ]
        },
        timeout=30
    )
    data = r.json()
    if "choices" in data:
        print(f"Response: {data['choices'][0]['message']['content']}")
    else:
        print(f"Error: {data}")
    return data

def test_stream():
    """스트리밍 테스트"""
    print("\n=== Streaming Test ===")
    r = requests.post(
        f"{BASE_URL}/v1/chat/completions",
        json={
            "model": "claude-opus-4.6",
            "messages": [
                {"role": "user", "content": "Python의 장점 3가지를 짧게 말해줘"}
            ],
            "stream": True
        },
        stream=True,
        timeout=30
    )
    
    print("Response: ", end="")
    for line in r.iter_lines():
        if line:
            line_str = line.decode("utf-8")
            if line_str.startswith("data: ") and line_str != "data: [DONE]":
                chunk = json.loads(line_str[6:])
                content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                print(content, end="", flush=True)
    print()  # 줄바꿈


if __name__ == "__main__":
    if not test_health():
        print("\n서버가 실행되지 않았습니다.")
        print("VS Code를 재시작하거나, Ctrl+Shift+P → 'Copilot API Bridge: Start Server' 실행하세요.")
        sys.exit(1)
    
    test_models()
    test_completion()
    test_stream()
    print("\n✓ 모든 테스트 완료!")
