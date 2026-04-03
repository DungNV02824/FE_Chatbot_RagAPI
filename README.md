# Backend (BE) - FastAPI RAG Chatbot API

Tài liệu này được viết dựa trực tiếp trên source BE trong thư mục `c:\chat\BE` (FastAPI + PostgreSQL/pgvector + Redis + ARQ workers).

> Lưu ý: file này đang nằm ở `c:\chat\FE\README.md`, nhưng nội dung tập trung vào BE để người mới có thể chạy hệ thống trước.

## 1. Tổng quan nhanh

Hệ thống có các mảnh chính:

- FastAPI chạy API:
  - `POST /chat` (trả về SSE stream token)
  - upload dữ liệu Excel `POST /upload-excel` (enqueue embedding)
  - endpoints quản lý user/ticket theo tenant
  - WebSocket realtime tin nhắn staff: `/ws/staff-messages/{conversation_id}`
- PostgreSQL + `pgvector`:
  - lưu embedding của tài liệu trong bảng `documents` (Vector(1536))
  - hỗ trợ multi-tenant bằng PostgreSQL RLS (Row Level Security)
- Redis:
  - semantic cache (trả lời nhanh nếu tương đồng)
  - queue cho worker (ARQ)
- ARQ workers:
  - xử lý embedding nặng: job `embed_document_job`

## 2. Prerequisites (cần gì để chạy)

- Docker để chạy:
  - PostgreSQL container (pgvector)
  - Redis container
- Python cho BE:
  - khuyến nghị dùng `venv`
- OpenAI key:
  - `OPENAI_API_KEY`

## 3. Chạy hạ tầng: PostgreSQL + pgvector + Redis

BE có `docker-compose.yml` tại `c:\chat\BE\docker-compose.yml`:

- PostgreSQL:
  - container port: `5432`
  - host port: `5433`
- Redis:
  - host port: `6379`

Chạy:

```powershell
cd "c:\chat\BE"
docker compose up -d
```

Kiểm tra nhanh:

- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

## 4. Cấu hình môi trường cho BE (`c:\chat\BE\.env`)

BE tải env bằng `python-dotenv` trong `BE/core/config.py`.

Tạo file `.env` tại `c:\chat\BE\.env`:

```dotenv
DATABASE_URL=postgresql+psycopg2://app_user:123456@127.0.0.1:5433/chatbot_db

OPENAI_API_KEY=YOUR_OPENAI_API_KEY
MODEL_NAME=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
```

Các biến tune thêm (có default trong code):

- `SEMANTIC_CACHE_TTL` (default `86400`)
- `SEMANTIC_SIMILARITY_THRESHOLD` (default `0.95`)
- `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW`, `RATE_LIMIT_BURST`
- `SLIDING_WINDOW_SIZE`, `SUMMARIZATION_THRESHOLD`, `SUMMARY_MAX_TOKENS`
- `HARD_LIMIT_USD_PER_MONTH`, `INPUT_TOKEN_PRICE_PER_1K`, `OUTPUT_TOKEN_PRICE_PER_1K`

## 5. Cài dependencies & chạy FastAPI

Trong `c:\chat\BE`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Test:

- `GET http://127.0.0.1:8000/health` (không cần `x-api-key`)
- `GET http://127.0.0.1:8000/stats` (để xem Redis info)

## 6. Bắt buộc chạy ARQ worker (để upload Excel tạo embedding)

Upload Excel sẽ:

- lưu dòng vào DB (`documents.embedding = None`)
- enqueue job embedding vào Redis queue

Worker xử lý job và ghi embedding vào DB.

Chạy worker trong terminal khác:

```powershell
cd "c:\chat\BE"
.\.venv\Scripts\Activate.ps1
arq workers.WorkerSettings
```

Nếu không chạy worker, chat có thể chạy nhưng sẽ không có knowledge embedding mới sau upload.

## 7. Auth multi-tenant: `x-api-key` + PostgreSQL RLS

### 7.1. Khi nào cần `x-api-key`?

- Middleware kiểm tra `x-api-key` cho hầu hết endpoint.
- Các endpoint được bỏ qua kiểm tra API key:
  - `GET /health`
  - `/docs`, `/openapi.json`, `/redoc`
  - toàn bộ `/tenants*`

### 7.2. Cách middleware map tenant

Trong `BE/middleware/api_key.py`:

- Lấy `x-api-key` từ header
- tìm `tenants` theo `Tenant.api_key` và `Tenant.is_active == True`
- set context cho PostgreSQL:
  - `app.current_tenant`
  - `app.current_tenant_id` (backward-compatible)

Sau đó endpoints gọi vào DB sẽ bị lọc theo RLS.

### 7.3. Tại sao RLS quan trọng?

Code BE gọi RLS context trong nhiều nơi (vd `db/session.py`, `chat.py`, `data_upload.py`, `staff.py`).

Nếu bạn chưa cấu hình RLS policy + schema, API rất dễ lỗi 500/permission denied hoặc trả dữ liệu sai tenant.

## 7.4. Tạo tenant & lấy `api_key` để test (tránh lỗi 401)

`/tenants/*` được miễn kiểm tra `x-api-key`, nên bạn có thể tạo tenant trước theo thứ tự:

1. Gọi `POST /tenants/` với body:
   - `name`
   - `description` (optional)
   - `api_key` (tự đặt, duy nhất trong bảng `tenants`)
2. Lưu `api_key` vừa tạo.
3. Với mọi request tới:
   - `/chat`
   - `/upload-excel`
   - `/users`
   - `/staff/*`
   bạn bắt buộc gửi header `x-api-key: <TENANT_API_KEY>`.

Nếu bạn đang dùng FE để thử:
- FE sẽ lưu `apiKey` vào `localStorage` (trong `FE/src/services/ApiService.js`).
- Hãy set `localStorage.apiKey` đúng với tenant của bạn rồi reload.

## 8. DB schema: các bảng cần có (và lưu ý `llm_usage_logs`)

ORM models trong `BE/models` định nghĩa:

- `tenants`
- `users`
- `conversations`
- `messages`
- `documents` (có `embedding = Vector(1536)`)
- `escalations`

Ngoài ra `BE/service/usage_service.py` query trực tiếp bảng:

- `llm_usage_logs`

> Code không thấy migration/script tự tạo bảng, nên bạn cần tự tạo schema/bảng (và các RLS policy) từ trước.

`llm_usage_logs` ít nhất phải có các cột mà code INSERT/SELECT dùng:

- `tenant_id`
- `conversation_id` (nullable)
- `model_name`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `estimated_cost_usd`
- `created_at` (được dùng để tính spend theo tháng)

## 9. Endpoint reference (bám theo BE source)

### 9.1. Health / Stats

- `GET /health` : `{status, services}`
- `GET /stats` : info từ Redis

### 9.2. System Admin (CRUD tenants) - không cần `x-api-key`

- `GET /tenants/`
- `POST /tenants/`
- `PUT /tenants/{tenant_id}`
- `DELETE /tenants/{tenant_id}`

### 9.3. Chat

- `POST /chat`
  - Auth: cần `x-api-key`
  - Request (body theo `ChatRequestDTO`):
    - `message` (string, bắt buộc)
    - `anonymous_id` (optional)
    - `name`, `email`, `phone`, `address` (optional)
  - Response:
    - SSE stream token:
      - `event: message` với `{ token }`
      - `event: done` với `{ full_response }`
    - hoặc JSON thường nếu cache hit / special branch
- `POST /chat/save-response`
  - Dùng để persist response và semantic cache (idempotent)
  - FE gọi ở một số nhánh để đảm bảo lưu DB
- `GET /chat/history/{anonymous_id}?limit=10..100`
  - Trả `{ messages, disable_bot_response, stats }`
- `GET /chat/conversation/{conversation_id}?limit=1..100`
  - Trả `{ conversation_id, messages, total_count }`
- `GET /chat/stats/{conversation_id}`
  - Trả context/summarization/cache/rate stats
- `POST /chat/disable-bot/{conversation_id}`
  - body: `{ "disable": true/false }`

### 9.4. Upload dữ liệu RAG

- `POST /upload-excel`
  - Auth: cần `x-api-key`
  - File `.xlsx` bắt buộc có cột:
    - `A (Câu hỏi)`
    - `B (Trả lời)`
  - Cột tuỳ chọn:
    - `C (Key work)` -> meta `keyword`
    - `D(image_url)` -> meta `image_url`
  - Sau khi upload: server commit DB trước, rồi enqueue `embed_document_job`
- `DELETE /documents/clear`
  - Auth: cần `x-api-key`
  - Xóa toàn bộ documents của tenant trong bảng `documents`

### 9.5. User

- `POST /users/{anonymous_id}/update-info`
  - body theo `UserInfoUpdate` (name/email/phone/address)
- `GET /users`
  - Trả danh sách user của tenant (kèm `conversation_id` và `last_message`)
- `DELETE /users/{user_id}`

### 9.6. Staff / Escalations

- WebSocket realtime:
  - `WS /ws/staff-messages/{conversation_id}`
  - FE customer sẽ nhận payload staff reply
- Tickets cho staff:
  - `GET /staff/escalations?status=pending|in_progress|resolved&limit=1..100`
  - `GET /staff/escalation/{escalation_id}`
  - `POST /staff/reply` body theo `StaffReplyRequestDTO`:
    - `conversation_id`
    - `message`
    - `staff_name`
  - `PUT /staff/escalation/{escalation_id}/resolve?resolution_note=...` (note optional)
  - `PUT /staff/escalation/{escalation_id}/assign?staff_name=...`

> Ngoài ra còn router `BE/api/escalation.py` (các endpoint `/escalations/...`) nhưng FE hiện tại đang dùng các endpoint `/staff/...` ở trên.

## 10. Flow xử lý chính (để người mới debug đúng chỗ)

### 10.1. Upload Excel -> embedding

1. Gọi `POST /upload-excel` kèm file `.xlsx`
2. BE tạo record `documents` (embedding `NULL`) theo từng dòng
3. BE enqueue job `embed_document_job(doc_id, content, tenant_id)`
4. Worker chạy `service/embedding.py`:
   - embedding bằng OpenAI với `EMBEDDING_MODEL`
5. Worker cập nhật `documents.embedding`
6. Sau đó chat sẽ retrieve vector bằng truy vấn:
   - `ORDER BY embedding <-> CAST(:embedding AS vector)`

### 10.2. Chat -> RAG -> (có thể) escalation

1. `POST /chat`:
   - rate limit token bucket
   - semantic cache (Redis) bằng cosine similarity với `SEMANTIC_SIMILARITY_THRESHOLD`
2. Nếu không cache:
   - tạo/lookup `user` + `conversation`
   - guardrail:
     - scan prompt injection
     - sanitize PII trước khi gửi LLM
   - retrieve context từ `documents` (RLS theo tenant)
3. Special branches:
   - Nếu message kích hoạt `is_escalate_intent`:
     - tạo escalation `customer_request` và trả message chờ staff qua SSE “fake stream”
   - Nếu `conversation.disable_bot_response == True`:
     - trả `waiting_for_staff`
   - Nếu không có context:
     - tạo escalation `not_found` và trả message chờ staff
4. Nếu có context:
   - streaming SSE token từ OpenAI chat completion
   - persist assistant message vào DB (nếu có `conversation_id`)

## 11. Troubleshooting cho người mới

### 11.1. Lỗi `401 Missing x-api-key` / `Invalid API key`

- Bạn chưa set `x-api-key` đúng tenant.
- Tenant có thể bị `is_active=false` (middleware reject).
- Endpoint `/tenants/*` là ngoại lệ (System Admin), còn `/chat`, `/upload-excel`, `/users`, `/staff/*` đều cần key.

### 11.2. Upload Excel xong nhưng chat không trả “tri thức mới”

- Worker ARQ chưa chạy hoặc queue chưa xử lý.
- Redis không kết nối.
- Documents đã lưu nhưng embedding vẫn `NULL`.

### 11.3. Lỗi 500 liên quan RLS / permission

- DB schema/policies chưa được tạo.
- Bảng `llm_usage_logs` có thể thiếu (nếu chat stream gọi `log_llm_usage`).

### 11.4. Không nhận realtime staff reply

- WebSocket cần kết nối tới `ws(s)://127.0.0.1:8000/ws/staff-messages/{conversationId}`
- Kiểm tra console network/websocket handshake.

## 12. Tóm tắt lệnh chạy (đủ để demo)

- Terminal 1:

```powershell
cd "c:\chat\BE"
docker compose up -d
```

- Terminal 2 (API):

```powershell
cd "c:\chat\BE"
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- Terminal 3 (Worker):

```powershell
cd "c:\chat\BE"
.\.venv\Scripts\Activate.ps1
arq workers.WorkerSettings
```

- Terminal 4 (FE, nếu bạn cần giao diện):
  - `cd c:\chat\FE`
  - `npm install`
  - `npm run dev`

# RAG Chatbot System (FE + BE) — Hướng dẫn cho người mới

Tài liệu này mô tả cách chạy hệ thống Chatbot hỏi đáp RAG (Retrieval-Augmented Generation) gồm:
- Frontend (FE): React + Vite
- Backend (BE): FastAPI + PostgreSQL (pgvector) + Redis + ARQ workers

## 1. Tổng quan luồng hoạt động

1. Người quản trị (System Admin) tạo một `Tenant` và cấp `api_key`.
2. Frontend (Customer/Staff) gọi API backend bằng header `x-api-key`.
3. Backend dùng `x-api-key` map sang `tenant_id` và set biến session của PostgreSQL `app.current_tenant` để bật Row Level Security (RLS).
4. Customer chat:
   - Backend retrieve context (RAG) và gọi LLM theo `MODEL_NAME` (stream SSE).
   - Nếu cần escalation (không tìm thấy dữ liệu / ý định cần staff), backend tạo ticket để staff xử lý.
   - Staff trả lời qua HTTP; tin nhắn được đẩy realtime tới customer qua WebSocket `/ws/staff-messages/{conversation_id}`.
5. Ingest dữ liệu:
   - Upload Excel -> backend lưu dữ liệu vào DB và enqueue job embedding vào Redis queue.
   - Worker ARQ xử lý job và ghi vector embedding vào bảng `documents`.

## 2. Kiến trúc & các thành phần

- FE: `c:\chat\FE`
  - Gọi BE tại `http://127.0.0.1:8000` (hardcode trong `FE/src/services/ApiService.js`)
- BE API: `c:\chat\BE/main.py`
  - Uvicorn chạy server FastAPI
  - CORS cho `http://localhost:5173` và một số origin khác
- BE Worker: `c:\chat\BE/workers.py`
  - Xử lý embedding nặng (ARQ)
- PostgreSQL + pgvector:
  - Docker container `pgvector` (host port `5433`, container port `5432`)
- Redis:
  - Docker container `redis` (host port `6379`)

## 3. Chạy hệ thống (Windows / PowerShell)

### 3.1. Chạy PostgreSQL + Redis (docker)

```powershell
cd "c:\chat\BE"
docker compose up -d
```

### 3.2. Cấu hình biến môi trường cho BE (`c:\chat\BE\.env`)

BE đọc các biến trong `BE/core/config.py`. Tạo file `.env` theo ví dụ:

```dotenv
# Database (phù hợp docker-compose.yml trong BE)
DATABASE_URL=postgresql+psycopg2://app_user:123456@127.0.0.1:5433/chatbot_db

# OpenAI
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
MODEL_NAME=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

# Redis (tuỳ chọn vì đã có default)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
```

Các biến tuỳ chỉnh thêm:
- `SEMANTIC_CACHE_TTL` (mặc định 86400)
- `SEMANTIC_SIMILARITY_THRESHOLD` (mặc định 0.95)
- `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW`, `RATE_LIMIT_BURST`
- `SLIDING_WINDOW_SIZE`, `SUMMARIZATION_THRESHOLD`, `SUMMARY_MAX_TOKENS`
- `HARD_LIMIT_USD_PER_MONTH`, `INPUT_TOKEN_PRICE_PER_1K`, `OUTPUT_TOKEN_PRICE_PER_1K`

### 3.3. Khởi chạy BE API

```powershell
cd "c:\chat\BE"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Test nhanh:
- `GET http://127.0.0.1:8000/health` (không cần `x-api-key`)

### 3.4. Khởi chạy BE Worker (bắt buộc để upload Excel tạo embedding)

Terminal khác:

```powershell
cd "c:\chat\BE"
.\.venv\Scripts\Activate.ps1
arq workers.WorkerSettings
```

### 3.5. Chạy FE

```powershell
cd "c:\chat\FE"
npm install
npm run dev
```

## 4. Tenant + API key (bạn phải làm bước này mới chat/upload được)

Backend yêu cầu header `x-api-key` cho hầu hết endpoint (chat, upload, users, staff...).
Riêng `/tenants` được bỏ qua check API key (phục vụ System Admin).

### 4.1. Tạo Tenant bằng FE

1. Trên FE chọn role `System Admin`.
2. Điền `name`, `description`, `api_key`.
3. Bấm “Thêm Mới”.

### 4.2. Set API key cho Customer/Staff bằng `localStorage`

FE đọc API key từ `localStorage` trong `ApiService.initApiKey()`.

Chạy trong DevTools:

```js
localStorage.setItem('apiKey', '<TENANT_API_KEY_BAN_VỪA_TẠO>');
location.reload();
```

Sau đó:
- Chọn role `Customer Interface` để chat/upload
- Chọn role `Staff Dashboard` để xử lý ticket/escalations

### 4.3. Lưu ý về API key mặc định

`FE/src/services/ApiService.js` có API key mặc định nhưng có thể không khớp với tenant của bạn.
Cách chắc chắn nhất là set `localStorage.apiKey` theo tenant đã tạo.

## 5. Cách dùng các màn hình

### 5.1. Customer Interface

Trong role `customer`, FE hiển thị:
- `UploadExcel` -> POST `/upload-excel`
- `UsersList` -> GET `/users`
- `ChatBox` -> POST `/chat` + polling `/chat/history/:anonymous_id` + realtime WS

#### Format Excel cho `UploadExcel`

FE yêu cầu file `.xlsx` và các cột:
- `A (Câu hỏi)` (bắt buộc): câu hỏi
- `B (Trả lời)` (bắt buộc): câu trả lời
- `C (Key work)` (tuỳ chọn): từ khóa
- `D(image_url)` (tuỳ chọn): URL hình ảnh

### 5.2. Staff Dashboard

Staff Dashboard:
- Lấy tickets pending: `/staff/escalations?status=pending`
- Load chat theo conversation: `/chat/conversation/:conversation_id`
- Reply: `/staff/reply`
- Nhận realtime qua websocket: `/ws/staff-messages/:conversation_id`

### 5.3. System Admin

System Admin:
- CRUD tenants: `/tenants`
- Upload/xóa dữ liệu RAG:
  - upload: `/upload-excel`
  - xóa: `/documents/clear`

## 6. Debug nhanh lỗi thường gặp

- `401 Unauthorized`: sai/thiếu `localStorage.apiKey` hoặc tenant `is_active=false`.
- Upload xong nhưng chat không biết kiến thức mới:
  - worker ARQ chưa chạy (`arq workers.WorkerSettings`)
  - Redis/worker kết nối lỗi
- FE gọi không được API:
  - BE phải chạy tại `http://127.0.0.1:8000`
  - Nếu bạn đổi host/port thì cần cập nhật `FE/src/services/ApiService.js`
- Không thấy realtime message từ staff:
  - kiểm tra websocket `/ws/staff-messages/{conversationId}` trong DevTools

## 7. DB schema & PostgreSQL RLS (để hiểu hệ thống)

Repo này có ORM model cho:
- `tenants`, `users`, `conversations`, `messages`, `documents`, `escalations`

Ngoài ra code backend query trực tiếp `llm_usage_logs` trong `BE/service/usage_service.py`.
Repo hiện chưa thấy script/migration tự tạo schema & policy RLS trong code.
Vì vậy người mới cần đảm bảo:
- DB đã tồn tại đầy đủ bảng (đặc biệt `llm_usage_logs`)
- PostgreSQL RLS policy được cấu hình để lọc theo `app.current_tenant`/`app.current_tenant_id`

## 8. Cách tham gia phát triển

### 8.1. Đọc nhanh code

- `FE/src`
  - `services/ApiService.js`: gom các endpoint gọi BE
  - `components/*`: UI theo role (customer/staff/system_admin)
- `BE/`
  - `api/*`: router HTTP
  - `service/*`: RAG/embedding/context/escalation/usage
  - `middleware/*`: multi-tenant + RLS
  - `workers.py`: ARQ jobs

### 8.2. Quy trình làm việc (gợi ý)

- Chạy được các flow chính trước khi mở rộng:
  - `/health`
  - tạo tenant (System Admin)
  - chat (Customer)
  - upload Excel (worker phải chạy)
  - staff reply (Staff Dashboard)
- Không commit secrets (đặc biệt `.env` và `OPENAI_API_KEY`).
- FE: `npm run lint`

