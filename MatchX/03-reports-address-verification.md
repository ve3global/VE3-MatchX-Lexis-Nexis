# LexisNexis API for address verification — Endpoint: /report

**Payload:**

```json
{
  "enduser_agreement": true,
  "reference": "77_REC47",
  "forename": "DUNCAN",
  "surname": "BOWEN",
  "address": {
    "address1": "210 Julius Road fsf",
    "address2": "",
    "address3": "",
    "address4": "",
    "postcode": "BS7 8EU",
    "address5": ""
  },
  "actions": [
    "address-verification",
    "age-verification",
    "ccj-screening",
    "company-officer-screening",
    "dob-verification",
    "lexid-match"
  ],
  "scorecard_id": "0423e225-1d10-44da-93b8-3d9d6d1d3e8e",
  "age_min": 50,
  "age_max": 75,
  "test": false,
  "dob": "1984-03-14"
}
```

**Response:**

```json
{
  "data": {
    "id": "ef9ccd44-df42-4595-b056-81131f680f69",
    "created_at": "2026-09-04T14:27:55+00:00",
    "updated_at": "2026-09-04T14:27:55+00:00",
    "status": "COMPLETE",
    "context": {
      "reference": "77_REC47",
      "enduser_agreement": true,
      "scorecard_id": "0423e225-1d10-44da-93b8-3d9d6d1d3e8e",
      "age_min": null,
      "age_max": null,
      "full_er": false,
      "nfi_address": false
    },
    "user": {
      "id": "25ea6f9b-4219-4e05-bd81-8dcf82470649",
      "username": "VE3IDUTEST01"
    },
    "assessment": {
      "scorecard_id": "0423e225-1d10-44da-93b8-3d9d6d1d3e8e",
      "score": 20,
      "result": "FAIL",
      "reasons": [
        { "label": "Address verified", "indicator": "POSITIVE" },
        { "label": "On previous electoral registers", "indicator": "POSITIVE" },
        { "label": "LexID has been validated against input data", "indicator": "POSITIVE" }
      ],
      "score_breakdown": [
        { "group": "Credit Records", "group_score": 0, "rules": [] },
        {
          "group": "Electoral Role Address Verification",
          "group_score": 15,
          "rules": [
            { "attribute": "address_verified", "score": 10, "matched": true },
            { "attribute": "address_current_er", "score": 0, "matched": false },
            { "attribute": "address_gone_away_very_high", "score": 0, "matched": false },
            { "attribute": "address_gone_away_high", "score": 0, "matched": false },
            { "attribute": "address_historic_er", "score": 5, "matched": true }
          ]
        },
        {
          "group": "Bonus Sources",
          "group_score": 0,
          "rules": [
            { "attribute": "company_officer_current", "score": 0, "matched": false },
            { "attribute": "address_tracesmart_register", "score": 0, "matched": false },
            { "attribute": "address_companies_house", "score": 0, "matched": false },
            { "attribute": "address_insolvency_service", "score": 0, "matched": false },
            { "attribute": "company_officer_historic", "score": 0, "matched": false },
            { "attribute": "address_telephone_directory", "score": 0, "matched": false },
            { "attribute": "address_registry_trust", "score": 0, "matched": false },
            { "attribute": "ccj", "score": 0, "matched": false }
          ]
        },
        {
          "group": "Identity Match",
          "group_score": 5,
          "rules": [{ "attribute": "lexid_match", "score": 5, "matched": true }]
        }
      ]
    },
    "address_verification": {
      "verified": true,
      "address_found": true,
      "gone_away": false,
      "date_first_seen": 2004,
      "date_last_seen": 2010,
      "address": {
        "id": 38102821,
        "address1": "210 JULIUS ROAD",
        "address2": "BRISTOL",
        "address3": "",
        "address4": "",
        "address5": "",
        "postcode": "BS7 8EU"
      },
      "telephones": [],
      "sources": [
        { "source": "ER2010", "description": "2010 UK Open Electoral Register", "recency": "2009-10-15" },
        { "source": "ER2009", "description": "2009 UK Open Electoral Register", "recency": "2008-10-15" },
        { "source": "ER2008", "description": "2008 UK Open Electoral Register", "recency": "2007-10-15" },
        { "source": "ER2007", "description": "2007 UK Open Electoral Register", "recency": "2006-10-15" },
        { "source": "ER2006", "description": "2006 UK Open Electoral Register", "recency": "2005-10-15" },
        { "source": "ER2005", "description": "2005 UK Open Electoral Register", "recency": "2004-10-15" }
      ]
    },
    "age_verification": {
      "verified": false,
      "reason": "DOB_MISMATCH"
    },
    "ccj_screening": {
      "matched": false
    },
    "company_officer_screening": {
      "matched": false,
      "active_appointment_count": 0,
      "resigned_appointment_count": 0,
      "inactive_appointment_count": 0
    },
    "dob_verification": {
      "matched": false,
      "sources": [
        {
          "source": "LexisNexis",
          "dob_count": 0,
          "day_match": false,
          "month_match": false,
          "year_match": false
        }
      ]
    },
    "lexid_match": {
      "matched": true,
      "forename": "DUNCAN",
      "middlename": "ROSS ANDREW",
      "surname": "BOWEN",
      "dob": "1985-03-14",
      "uklexid": 4471124744,
      "forename_match": true,
      "middlename_match": false,
      "surname_match": true,
      "dob_match": false
    },
    "attributes": {
      "address_companies_house": false,
      "address_current_er": false,
      "address_gone_away_high": false,
      "address_gone_away_very_high": false,
      "address_historic_er": true,
      "address_insolvency_service": false,
      "address_registry_trust": false,
      "address_telephone_directory": false,
      "address_tracesmart_register": false,
      "address_verified": true,
      "age_max": null,
      "age_min": null,
      "ccj": false,
      "company_officer_current": false,
      "company_officer_historic": false,
      "dob_count": 0,
      "lexid_match": true
    }
  }
}
```

**In code integration:**

```python
response = requests.post(
    f"{self.BASE_URL}/reports",
    json=payload,
    headers=headers,
    timeout=self.API_TIMEOUT,
)
```
