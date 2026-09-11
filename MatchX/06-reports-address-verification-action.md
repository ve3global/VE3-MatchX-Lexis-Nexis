# LexisNexis API endpoint for pension source: {{baseUrl}}/reports/:reportId/actions/address-verification

**Payload:**

```json
{
  "config": {
    "nfi_address": true
  }
}
```

**Response:**

```json
{
  "data": {
    "id": "b04f7106-bdcf-405c-9041-c10c74ab870c",
    "created_at": "2026-09-08T11:46:36+00:00",
    "updated_at": "2026-09-08T11:47:35+00:00",
    "status": "COMPLETE",
    "context": {
      "reference": "abc",
      "enduser_agreement": true,
      "scorecard_id": "0423e225-1d10-44da-93b8-3d9d6d1d3e8e",
      "age_min": 50,
      "age_max": 70,
      "full_er": false,
      "nfi_address": true
    },
    "user": {
      "id": "25ea6f9b-4219-4e05-bd81-8dcf82470649",
      "username": "VE3IDUTEST01"
    },
    "assessment": {
      "scorecard_id": "0423e225-1d10-44da-93b8-3d9d6d1d3e8e",
      "score": 40,
      "result": "FAIL",
      "reasons": [
        { "label": "Address verified", "indicator": "POSITIVE" },
        { "label": "On the current electoral register", "indicator": "POSITIVE" },
        { "label": "On previous electoral registers", "indicator": "POSITIVE" },
        { "label": "LexID has been validated against input data", "indicator": "POSITIVE" }
      ],
      "score_breakdown": [
        { "group": "Credit Records", "group_score": 0, "rules": [] },
        {
          "group": "Electoral Role Address Verification",
          "group_score": 35,
          "rules": [
            { "attribute": "address_verified", "score": 10, "matched": true },
            { "attribute": "address_current_er", "score": 20, "matched": true },
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
            { "attribute": "address_registry_trust", "score": 0, "matched": false }
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
      "date_first_seen": 2007,
      "date_last_seen": 2026,
      "address": {
        "id": 38102816,
        "address1": "204 JULIUS ROAD",
        "address2": "BRISTOL",
        "address3": "",
        "address4": "",
        "address5": "",
        "postcode": "BS7 8EU"
      },
      "telephones": [],
      "sources": [
        { "source": "ER2026", "description": "2026 UK Open Electoral Register", "recency": "2025-10-15" },
        { "source": "ER2025", "description": "2025 UK Open Electoral Register", "recency": "2024-10-15" },
        { "source": "ER2024", "description": "2024 UK Open Electoral Register", "recency": "2023-10-15" },
        { "source": "ER2023", "description": "2023 UK Open Electoral Register", "recency": "2022-10-15" },
        { "source": "ER2022", "description": "2022 UK Open Electoral Register", "recency": "2021-10-15" },
        { "source": "ER2021", "description": "2021 UK Open Electoral Register", "recency": "2020-10-15" },
        { "source": "NFI_PENSIONS", "description": "NFI - Pensions", "recency": "2020-09-14" },
        { "source": "NFI_PAYROLL", "description": "NFI - Payroll", "recency": "2020-09-14" },
        { "source": "NFI_TRANSPORT_PASS", "description": "NFI - Transport pass", "recency": "2020-09-14" },
        { "source": "ER2020", "description": "2020 UK Open Electoral Register", "recency": "2019-10-15" },
        { "source": "ER2015", "description": "2015 UK Open Electoral Register", "recency": "2014-10-15" },
        { "source": "ER2014", "description": "2014 UK Open Electoral Register", "recency": "2013-10-15" },
        { "source": "ER2011", "description": "2011 UK Open Electoral Register", "recency": "2012-10-15" },
        { "source": "ER2013", "description": "2013 UK Open Electoral Register", "recency": "2012-10-15" },
        { "source": "ER2012", "description": "2012 UK Open Electoral Register", "recency": "2011-10-15" },
        { "source": "ER2010", "description": "2010 UK Open Electoral Register", "recency": "2009-10-15" },
        { "source": "ER2009", "description": "2009 UK Open Electoral Register", "recency": "2008-10-15" },
        { "source": "ER2008", "description": "2008 UK Open Electoral Register", "recency": "2007-10-15" }
      ]
    },
    "age_verification": {
      "verified": false,
      "reason": "NO_DOB_FOUND"
    },
    "company_officer_screening": {
      "matched": false,
      "active_appointment_count": 0,
      "resigned_appointment_count": 0,
      "inactive_appointment_count": 0
    },
    "dob_verification": {
      "matched": false,
      "sources": [{ "source": "LexisNexis", "dob_count": 0 }]
    },
    "lexid_match": {
      "matched": true,
      "forename": "BELLA",
      "middlename": "PATRICIA",
      "surname": "HENDERSON",
      "dob": null,
      "uklexid": 4487610923,
      "forename_match": true,
      "middlename_match": false,
      "surname_match": true,
      "dob_match": false
    },
    "attributes": {
      "address_companies_house": false,
      "address_council_tax": false,
      "address_council_tax_reduction_scheme": false,
      "address_current_er": true,
      "address_deferred_pensions": false,
      "address_gone_away_high": false,
      "address_gone_away_very_high": false,
      "address_historic_er": true,
      "address_housing_benefits": false,
      "address_housing_tenants": false,
      "address_insolvency_service": false,
      "address_nfi_sources": 3,
      "address_payroll": true,
      "address_pensions": true,
      "address_pensions_gratuities": false,
      "address_personal_budgets": false,
      "address_personal_licence": false,
      "address_registry_trust": false,
      "address_right_to_buy": false,
      "address_state_benefits": false,
      "address_student_loans": false,
      "address_taxi_drivers": false,
      "address_telephone_directory": false,
      "address_tracesmart_register": false,
      "address_transport_pass": true,
      "address_verified": true,
      "address_waiting_list": false,
      "age_max": null,
      "age_min": null,
      "company_officer_current": false,
      "company_officer_historic": false,
      "dob_count": 0,
      "lexid_match": true
    }
  }
}
```
