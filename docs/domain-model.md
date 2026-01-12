# Domain Model

## User

**Key fields**
- `id`: unique identifier
- `email`: login email
- `displayName`: human-readable name
- `role`: access role (e.g., researcher, admin)
- `createdAt`: ISO-8601 timestamp

**Relationships**
- `User` owns `ExperimentPlan` records
- `User` initiates `ExperimentRun` records

**Example JSON**
```json
{
  "id": "user_123",
  "email": "maria.ivanova@example.com",
  "displayName": "Maria Ivanova",
  "role": "researcher",
  "createdAt": "2024-05-12T09:15:00Z"
}
```

## ExperimentPlan

**Key fields**
- `id`: unique identifier
- `name`: plan title
- `protocolId`: reference to protocol schema
- `version`: plan version
- `createdByUserId`: owner `User`
- `createdAt`: ISO-8601 timestamp
- `steps`: ordered list of step definitions

**Relationships**
- `ExperimentPlan` is created by `User`
- `ExperimentPlan` is executed by one or more `ExperimentRun` records

**Example JSON**
```json
{
  "id": "plan_001",
  "name": "ELISA QC Validation",
  "protocolId": "protocol_elisa_qc_v1",
  "version": 3,
  "createdByUserId": "user_123",
  "createdAt": "2024-05-10T08:00:00Z",
  "steps": [
    {
      "stepId": "coat_plate",
      "name": "Coat Plate",
      "parameters": {
        "volumeUl": 100,
        "incubationMin": 60
      }
    },
    {
      "stepId": "wash_plate",
      "name": "Wash Plate",
      "parameters": {
        "cycles": 3
      }
    }
  ]
}
```

## ExperimentRun

**Key fields**
- `id`: unique identifier
- `planId`: source `ExperimentPlan`
- `runNumber`: sequential run counter per plan
- `status`: running/completed/failed
- `startedByUserId`: initiating `User`
- `startedAt`: ISO-8601 timestamp
- `finishedAt`: ISO-8601 timestamp or null

**Relationships**
- `ExperimentRun` references one `ExperimentPlan`
- `ExperimentRun` has many `StepLog` entries
- `ExperimentRun` has many `Attachment` records
- `ExperimentRun` can include multiple `InstrumentRecord` entries

**Example JSON**
```json
{
  "id": "run_1001",
  "planId": "plan_001",
  "runNumber": 12,
  "status": "completed",
  "startedByUserId": "user_123",
  "startedAt": "2024-05-12T10:00:00Z",
  "finishedAt": "2024-05-12T11:45:00Z"
}
```

## StepLog

**Key fields**
- `id`: unique identifier
- `runId`: parent `ExperimentRun`
- `stepId`: identifier from plan step
- `stepName`: human-readable step name
- `status`: started/finished/failed
- `timestamp`: ISO-8601 timestamp
- `message`: structured log message

**Relationships**
- `StepLog` belongs to an `ExperimentRun`

**Example JSON**
```json
{
  "id": "log_9001",
  "runId": "run_1001",
  "stepId": "wash_plate",
  "stepName": "Wash Plate",
  "status": "finished",
  "timestamp": "2024-05-12T10:35:00Z",
  "message": "step=wash_plate status=finished timestamp=2024-05-12T10:35:00Z cycles=3"
}
```

## Attachment

**Key fields**
- `id`: unique identifier
- `runId`: parent `ExperimentRun`
- `type`: file category (image, csv, pdf)
- `path`: storage path (e.g., images/raw/...) 
- `label`: human-readable label
- `createdAt`: ISO-8601 timestamp

**Relationships**
- `Attachment` belongs to an `ExperimentRun`
- `Attachment` may relate to a `StepLog` via `stepId`

**Example JSON**
```json
{
  "id": "att_3001",
  "runId": "run_1001",
  "type": "image",
  "path": "images/raw/run_1001/plate_scan_01.png",
  "label": "Plate Scan After Wash",
  "createdAt": "2024-05-12T10:40:00Z",
  "stepId": "wash_plate"
}
```

## InstrumentRecord

**Key fields**
- `id`: unique identifier
- `runId`: parent `ExperimentRun`
- `instrumentId`: instrument identifier
- `instrumentType`: reader/incubator/washer
- `recordedAt`: ISO-8601 timestamp
- `dataPath`: stored data location (e.g., csv/processed/...)

**Relationships**
- `InstrumentRecord` belongs to an `ExperimentRun`
- `InstrumentRecord` can be linked to a `StepLog` via `stepId`

**Example JSON**
```json
{
  "id": "inst_501",
  "runId": "run_1001",
  "instrumentId": "reader_02",
  "instrumentType": "reader",
  "recordedAt": "2024-05-12T11:20:00Z",
  "dataPath": "csv/processed/run_1001/reader_02_results.csv",
  "stepId": "read_plate"
}
```
