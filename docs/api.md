# API

## Общие принципы
- Базовый URL: `/api`.
- Формат: `application/json`.
- Даты и время: ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`).
- Все ошибки возвращаются с кодом и структурой:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

## Авторизация (Telegram WebApp init data)
API принимает подписанные данные Telegram WebApp в заголовке `X-Telegram-Init-Data`.

### Сценарий
1. Клиент получает `initData` из `window.Telegram.WebApp.initData`.
2. Клиент отправляет `initData` в каждом запросе в заголовке `X-Telegram-Init-Data`.
3. Сервер проверяет подпись согласно алгоритму Telegram:
   - Разбирает `initData` в набор `key=value`.
   - Удаляет поле `hash`.
   - Сортирует ключи по алфавиту и соединяет строкой с `\n`.
   - Вычисляет HMAC-SHA256 от строки, используя ключ `sha256(bot_token)`.
   - Сравнивает результат с `hash`.
   - Проверяет `auth_date` на актуальность (рекомендуется TTL 5 минут).
4. При успешной проверке создаётся/находится пользователь и его идентификатор используется как `userId`.

### Пример запроса
```
GET /api/protocols
X-Telegram-Init-Data: query_id=...&user=...&auth_date=...&hash=...
```

## Протоколы
Протоколы описываются JSON Schema и хранятся в версии.

### Список протоколов
`GET /api/protocols`

Ответ:
```json
{
  "items": [
    {
      "protocolId": "protocol_elisa_qc_v1",
      "name": "Sandwich ELISA",
      "version": "1.0.0",
      "summary": "Sandwich ELISA protocol"
    }
  ]
}
```

### Получить протокол
`GET /api/protocols/{protocolId}`

Ответ:
```json
{
  "protocolId": "protocol_elisa_qc_v1",
  "name": "Sandwich ELISA",
  "version": "1.0.0",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "protocols/elisa/sandwichElisa.json",
    "title": "Sandwich ELISA Protocol Template",
    "type": "object",
    "required": ["schemaVersion", "protocolId", "steps"]
  }
}
```

## Планы (ExperimentPlan)

### Создать план
`POST /api/plans`

Запрос:
```json
{
  "name": "QC Series A",
  "protocolId": "protocol_elisa_qc_v1",
  "version": "1.0.0",
  "steps": [
    {
      "stepId": "coat_plate",
      "name": "Coat Plate",
      "parameters": {
        "buffer": "PBS",
        "durationMinutes": 60
      }
    }
  ]
}
```

Ответ:
```json
{
  "id": "plan_001",
  "name": "QC Series A",
  "protocolId": "protocol_elisa_qc_v1",
  "version": "1.0.0",
  "steps": [
    {
      "stepId": "coat_plate",
      "name": "Coat Plate",
      "parameters": {
        "buffer": "PBS",
        "durationMinutes": 60
      }
    }
  ],
  "createdAt": "2024-06-01T10:00:00Z"
}
```

### Список планов
`GET /api/plans`

Ответ:
```json
{
  "items": [
    {
      "id": "plan_001",
      "name": "QC Series A",
      "protocolId": "protocol_elisa_qc_v1",
      "version": "1.0.0",
      "createdAt": "2024-06-01T10:00:00Z"
    }
  ]
}
```

### Получить план
`GET /api/plans/{planId}`

Ответ:
```json
{
  "id": "plan_001",
  "name": "QC Series A",
  "protocolId": "protocol_elisa_qc_v1",
  "version": "1.0.0",
  "steps": [
    {
      "stepId": "coat_plate",
      "name": "Coat Plate",
      "parameters": {
        "buffer": "PBS",
        "durationMinutes": 60
      }
    }
  ]
}
```

### Обновить план
`PUT /api/plans/{planId}`

Запрос:
```json
{
  "name": "QC Series A (rev 2)",
  "version": "1.1.0",
  "steps": [
    {
      "stepId": "coat_plate",
      "name": "Coat Plate",
      "parameters": {
        "buffer": "PBS",
        "durationMinutes": 75
      }
    }
  ]
}
```

Ответ:
```json
{
  "id": "plan_001",
  "name": "QC Series A (rev 2)",
  "protocolId": "protocol_elisa_qc_v1",
  "version": "1.1.0",
  "steps": [
    {
      "stepId": "coat_plate",
      "name": "Coat Plate",
      "parameters": {
        "buffer": "PBS",
        "durationMinutes": 75
      }
    }
  ],
  "updatedAt": "2024-06-01T12:00:00Z"
}
```

## Запуски (ExperimentRun)

### Создать запуск
`POST /api/runs`

Запрос:
```json
{
  "planId": "plan_001"
}
```

Ответ:
```json
{
  "id": "run_1001",
  "planId": "plan_001",
  "runNumber": 12,
  "status": "running",
  "startedAt": "2024-06-01T12:10:00Z"
}
```

### Список запусков
`GET /api/runs`

Ответ:
```json
{
  "items": [
    {
      "id": "run_1001",
      "planId": "plan_001",
      "runNumber": 12,
      "status": "running",
      "startedAt": "2024-06-01T12:10:00Z"
    }
  ]
}
```

### Получить запуск
`GET /api/runs/{runId}`

Ответ:
```json
{
  "id": "run_1001",
  "planId": "plan_001",
  "runNumber": 12,
  "status": "running",
  "startedAt": "2024-06-01T12:10:00Z",
  "completedAt": null
}
```

### Завершить запуск
`POST /api/runs/{runId}/complete`

Запрос:
```json
{
  "status": "completed"
}
```

Ответ:
```json
{
  "id": "run_1001",
  "status": "completed",
  "completedAt": "2024-06-01T14:00:00Z"
}
```

## Шаги (StepLog)

### Зафиксировать шаг
`POST /api/runs/{runId}/steps`

Запрос:
```json
{
  "stepId": "wash_plate",
  "stepName": "Wash Plate",
  "status": "finished",
  "timestamp": "2024-06-01T12:30:00Z",
  "message": "step=wash_plate status=finished timestamp=2024-06-01T12:30:00Z cycles=3",
  "payload": {
    "cycles": 3,
    "buffer": "PBST"
  }
}
```

Ответ:
```json
{
  "id": "step_9001",
  "runId": "run_1001",
  "stepId": "wash_plate",
  "status": "finished",
  "timestamp": "2024-06-01T12:30:00Z"
}
```

### Список шагов запуска
`GET /api/runs/{runId}/steps`

Ответ:
```json
{
  "items": [
    {
      "id": "step_9001",
      "runId": "run_1001",
      "stepId": "wash_plate",
      "stepName": "Wash Plate",
      "status": "finished",
      "timestamp": "2024-06-01T12:30:00Z"
    }
  ]
}
```

## Загрузки (Uploads)

### Создать загрузку
`POST /api/uploads`

Запрос:
```json
{
  "runId": "run_1001",
  "stepId": "read_plate",
  "files": [
    {
      "fileName": "reader_02_results.csv",
      "contentType": "text/csv",
      "kind": "csv",
      "contentText": "Well,OD,Wavelength,SampleID\nA1,0.12,450,S01",
      "sizeBytes": 128
    },
    {
      "fileName": "plate_scan_01.png",
      "contentType": "image/png",
      "kind": "image",
      "contentBase64": "<base64>",
      "sizeBytes": 245120
    }
  ]
}
```

Ответ:
```json
{
  "items": [
    {
      "id": "upload_3001",
      "runId": "run_1001",
      "stepId": "read_plate",
      "fileName": "reader_02_results.csv",
      "contentType": "text/csv",
      "kind": "csv",
      "storagePath": "csv/raw/run_1001/reader_02_results.csv",
      "createdAt": "2024-06-01T12:45:00Z",
      "sizeBytes": 128
    }
  ]
}
```

### Список загрузок
`GET /api/uploads?runId=run_1001`

Ответ:
```json
{
  "items": [
    {
      "id": "upload_3001",
      "runId": "run_1001",
      "stepId": "read_plate",
      "fileName": "reader_02_results.csv",
      "contentType": "text/csv",
      "kind": "csv",
      "storagePath": "csv/raw/run_1001/reader_02_results.csv"
    }
  ]
}
```

### Получить загрузку
`GET /api/uploads/{uploadId}`

Ответ:
```json
{
  "id": "upload_3001",
  "runId": "run_1001",
  "stepId": "read_plate",
  "fileName": "reader_02_results.csv",
  "contentType": "text/csv",
  "kind": "csv",
  "storagePath": "csv/raw/run_1001/reader_02_results.csv"
}
```
