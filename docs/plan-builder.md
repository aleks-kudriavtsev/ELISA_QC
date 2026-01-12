# Plan Builder

## Protocol blocks

### Buffers
- Define buffer name, lot, and preparation details.
- Track composition (component list, pH, final volume).
- Link storage conditions and expiration metadata.

### Reagents
- Capture supplier, catalog/lot, and concentration.
- Specify storage requirements and thaw/handling notes.
- Indicate whether reagent is a kit component or standalone.

### Controls
- Define positive/negative controls with target ranges.
- Record expected signal thresholds and acceptance criteria.
- Associate each control with the relevant assay step.

### Steps
- Capture the ordered list of experiment actions.
- Include durations, temperatures, volumes, and mixing notes.
- Reference buffers/reagents/controls used in each step.

## Assembly interface

### Drag and drop canvas
- Provide a block palette for buffers, reagents, controls, and steps.
- Allow dragging blocks into an ordered timeline/flow column.
- Support reordering with visual indicators and snap points.
- Show block-level validation status (valid/warning/error).

### Step-by-step wizard
- Guide users through buffer, reagent, control, and step setup.
- Require completion of each section before advancing.
- Offer summaries and cross-links to edit prior sections.
- Present a final review screen with validation results.

## Calculation validation
- Validate concentration and volume math at entry time.
- Enforce units (e.g., mM, uL) and convert for comparisons.
- Flag impossible combinations (e.g., volume over vessel size).
- Provide warnings for dilution factors outside expected bounds.
- Recompute derived values when upstream inputs change.

## ExperimentPlan storage schema

The plan builder should persist output into an `ExperimentPlan` structure
that can be serialized as JSON for storage and transfer.

```json
{
  "experimentPlanId": "PLAN-001",
  "version": "1.0",
  "metadata": {
    "name": "ELISA Batch A",
    "createdAt": "2024-10-01T10:30:00Z",
    "updatedAt": "2024-10-01T11:00:00Z",
    "author": "lab.tech"
  },
  "buffers": [
    {
      "bufferId": "BUF-001",
      "name": "Wash Buffer",
      "composition": [
        {
          "component": "Tween-20",
          "concentration": 0.05,
          "unit": "%"
        }
      ],
      "finalVolume": 1000,
      "volumeUnit": "mL",
      "storage": {
        "temperature": "4C",
        "expiresAt": "2024-11-01"
      }
    }
  ],
  "reagents": [
    {
      "reagentId": "RGT-001",
      "name": "Detection Antibody",
      "supplier": "Vendor",
      "lot": "LOT-123",
      "stockConcentration": 1.0,
      "stockUnit": "mg/mL",
      "workingConcentration": 2.0,
      "workingUnit": "ug/mL",
      "storage": {
        "temperature": "-20C",
        "expiresAt": "2025-01-15"
      }
    }
  ],
  "controls": [
    {
      "controlId": "CTRL-001",
      "name": "Positive Control",
      "targetRange": {
        "min": 1.2,
        "max": 2.4,
        "unit": "OD"
      },
      "linkedStepId": "STEP-003"
    }
  ],
  "steps": [
    {
      "stepId": "STEP-001",
      "name": "Coating",
      "order": 1,
      "durationMinutes": 60,
      "temperature": "RT",
      "volumes": [
        {
          "reagentId": "RGT-001",
          "volume": 100,
          "unit": "uL"
        }
      ],
      "notes": "Cover plate to prevent evaporation."
    }
  ]
}
```
