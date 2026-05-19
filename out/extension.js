"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
let server = null;
let statusBarItem;
function activate(context) {
    // 상태바 아이템 생성
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'copilot-api-bridge.status';
    context.subscriptions.push(statusBarItem);
    // 명령어 등록
    context.subscriptions.push(vscode.commands.registerCommand('copilot-api-bridge.start', () => startServer(context)), vscode.commands.registerCommand('copilot-api-bridge.stop', stopServer), vscode.commands.registerCommand('copilot-api-bridge.status', showStatus));
    // 자동 시작
    const config = vscode.workspace.getConfiguration('copilot-api-bridge');
    if (config.get('autoStart', true)) {
        startServer(context);
    }
}
function deactivate() {
    stopServer();
}
// ─── HTTP Server ───────────────────────────────────────────────────────────
async function startServer(context) {
    if (server) {
        vscode.window.showInformationMessage('Copilot API Bridge: 이미 실행 중입니다.');
        return;
    }
    const config = vscode.workspace.getConfiguration('copilot-api-bridge');
    const port = config.get('port', 3141);
    server = http.createServer(async (req, res) => {
        // localhost만 허용
        const remoteAddr = req.socket.remoteAddress;
        if (remoteAddr !== '127.0.0.1' && remoteAddr !== '::1' && remoteAddr !== '::ffff:127.0.0.1') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Only localhost connections allowed' }));
            return;
        }
        // Bearer 토큰 인증 (설정된 경우)
        const authToken = config.get('authToken', '');
        if (authToken) {
            const authHeader = req.headers['authorization'];
            if (!authHeader || authHeader !== `Bearer ${authToken}`) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
        }
        // CORS 헤더
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        try {
            const url = req.url || '';
            if (url === '/v1/models' && req.method === 'GET') {
                await handleListModels(req, res);
            }
            else if (url === '/v1/chat/completions' && req.method === 'POST') {
                await handleChatCompletions(req, res);
            }
            else if (url === '/health' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', service: 'copilot-api-bridge' }));
            }
            else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found', available_endpoints: ['/v1/models', '/v1/chat/completions', '/health'] }));
            }
        }
        catch (err) {
            console.error('[copilot-api-bridge] Error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
        }
    });
    server.listen(port, '127.0.0.1', () => {
        updateStatusBar(port);
        vscode.window.showInformationMessage(`Copilot API Bridge: http://127.0.0.1:${port} 에서 실행 중`);
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            vscode.window.showErrorMessage(`Copilot API Bridge: 포트 ${port}이 이미 사용 중입니다.`);
        }
        else {
            vscode.window.showErrorMessage(`Copilot API Bridge: 서버 오류 - ${err.message}`);
        }
        server = null;
        updateStatusBar(0);
    });
}
function stopServer() {
    if (server) {
        server.close();
        server = null;
        updateStatusBar(0);
        vscode.window.showInformationMessage('Copilot API Bridge: 서버 중지됨');
    }
}
function showStatus() {
    if (server) {
        const config = vscode.workspace.getConfiguration('copilot-api-bridge');
        const port = config.get('port', 3141);
        vscode.window.showInformationMessage(`Copilot API Bridge: 실행 중 (http://127.0.0.1:${port})\n` +
            `엔드포인트: /v1/models, /v1/chat/completions, /health`);
    }
    else {
        vscode.window.showInformationMessage('Copilot API Bridge: 중지 상태');
    }
}
function updateStatusBar(port) {
    if (port > 0) {
        statusBarItem.text = `$(radio-tower) API:${port}`;
        statusBarItem.tooltip = `Copilot API Bridge running on port ${port}`;
        statusBarItem.show();
    }
    else {
        statusBarItem.text = `$(radio-tower) API:OFF`;
        statusBarItem.tooltip = 'Copilot API Bridge stopped';
        statusBarItem.show();
    }
}
// ─── API Handlers ──────────────────────────────────────────────────────────
async function handleListModels(req, res) {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    const modelList = models.map(m => ({
        id: m.family,
        object: 'model',
        created: Date.now(),
        owned_by: 'copilot',
        meta: {
            name: m.name,
            family: m.family,
            version: m.version,
            maxInputTokens: m.maxInputTokens
        }
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: modelList }));
}
async function handleChatCompletions(req, res) {
    const body = await readBody(req);
    const payload = JSON.parse(body);
    const { model: requestedModel, messages, stream = false, temperature, max_tokens } = payload;
    if (!messages || !Array.isArray(messages)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'messages array is required' }));
        return;
    }
    // 모델 선택
    const config = vscode.workspace.getConfiguration('copilot-api-bridge');
    const defaultModel = config.get('defaultModel', 'claude-opus-4.6');
    const family = requestedModel || defaultModel;
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family });
    if (models.length === 0) {
        // family로 못 찾으면 전체에서 찾기
        const allModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        if (allModels.length === 0) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No Copilot models available. Ensure GitHub Copilot is active.' }));
            return;
        }
        // 첫 번째 모델 사용
        return await doCompletion(allModels[0], messages, stream, res);
    }
    await doCompletion(models[0], messages, stream, res);
}
async function doCompletion(model, messages, stream, res) {
    // OpenAI 메시지 → VS Code LM 메시지 변환
    const lmMessages = [];
    for (const msg of messages) {
        if (msg.role === 'system' || msg.role === 'user') {
            lmMessages.push(vscode.LanguageModelChatMessage.User(msg.content));
        }
        else if (msg.role === 'assistant') {
            lmMessages.push(vscode.LanguageModelChatMessage.Assistant(msg.content));
        }
        // 'tool' role 등은 무시
    }
    const requestId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    if (stream) {
        // SSE 스트리밍 응답
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        try {
            const response = await model.sendRequest(lmMessages, {});
            for await (const fragment of response.text) {
                const chunk = {
                    id: requestId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model.family,
                    choices: [{
                            index: 0,
                            delta: { content: fragment },
                            finish_reason: null
                        }]
                };
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
            // 완료 신호
            const doneChunk = {
                id: requestId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model.family,
                choices: [{
                        index: 0,
                        delta: {},
                        finish_reason: 'stop'
                    }]
            };
            res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
            res.write('data: [DONE]\n\n');
        }
        catch (err) {
            const errorChunk = {
                error: { message: err.message || 'Model request failed', type: 'api_error' }
            };
            res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        }
        res.end();
    }
    else {
        // 비스트리밍 응답: 전체 텍스트를 모아서 한 번에 반환
        try {
            const response = await model.sendRequest(lmMessages, {});
            let fullText = '';
            for await (const fragment of response.text) {
                fullText += fragment;
            }
            const result = {
                id: requestId,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: model.family,
                choices: [{
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: fullText
                        },
                        finish_reason: 'stop'
                    }],
                usage: {
                    prompt_tokens: -1, // 정확한 토큰 수는 알 수 없음
                    completion_tokens: -1,
                    total_tokens: -1
                }
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        }
        catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: err.message || 'Model request failed',
                    type: 'api_error',
                    code: err.code || null
                }
            }));
        }
    }
}
// ─── Utilities ─────────────────────────────────────────────────────────────
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}
//# sourceMappingURL=extension.js.map