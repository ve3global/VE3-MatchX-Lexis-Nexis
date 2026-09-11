# LexisNexis API for credit activity — Endpoint: /report

**Payload:**

```json
{
  "enduser_agreement": true,
  "reference": "77_REC47",
  "forename": "Kenneth",
  "surname": "Holland",
  "dob": "1943-03-16",
  "address": {
    "address1": "12 Jacks Lane",
    "address2": "Harefield",
    "address3": "Uxbridge",
    "postcode": "UB9 6HE"
  },
  "actions": ["credit-active"],
  "scorecard_id": "0423e225-1d10-44da-93b8-3d9d6d1d3e8e",
  "age_min": 50,
  "age_max": 75,
  "test": false
}
```

**Response:**

```json
{
  "data": {
    "id": "ed568002-fc58-45d6-a748-0b65d8613536",
    "created_at": "2026-09-04T14:29:42+00:00",
    "updated_at": "2026-09-04T14:29:42+00:00",
    "status": "COMPLETE",
    "context": {
      "reference": "77_REC47",
      "enduser_agreement": true,
      "scorecard_id": "0423e225-1d10-44da-93b8-3d9d6d1d3e8e"
    },
    "user": {
      "id": "25ea6f9b-4219-4e05-bd81-8dcf82470649",
      "username": "VE3IDUTEST01"
    },
    "assessment": {
      "scorecard_id": "0423e225-1d10-44da-93b8-3d9d6d1d3e8e",
      "score": 60,
      "result": "FAIL",
      "reasons": [{ "label": "Has credit activity", "indicator": "POSITIVE" }],
      "score_breakdown": [
        {
          "group": "Credit Records",
          "group_score": 60,
          "rules": [{ "attribute": "credit_lenders", "score": 60, "matched": true }]
        },
        { "group": "Electoral Role Address Verification", "group_score": 0, "rules": [] },
        { "group": "Bonus Sources", "group_score": 0, "rules": [] },
        { "group": "Identity Match", "group_score": 0, "rules": [] }
      ]
    },
    "credit_active": {
      "matched": true,
      "sources": [
        {
          "source": "Experian",
          "recency": "2026-07-12",
          "accounts": 7,
          "lenders": 6,
          "lender_categories": {
            "credit_card": false,
            "current_account": true,
            "hp_or_lease": false,
            "mail_order": false,
            "other": true,
            "secured_loan": false,
            "storecard": false,
            "unsecured_loan": true,
            "utilities": true
          }
        }
      ]
    },
    "attributes": {
      "credit_lenders": 6
    }
  }
}
```
