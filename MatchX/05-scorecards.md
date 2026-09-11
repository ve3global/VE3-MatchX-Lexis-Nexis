# LexisNexis API for credit activity — Endpoint: /scorecards

**Payload:**

```json
{
  "name": "Verification Scorecard321",
  "pass_threshold": 100,
  "fail_threshold": 75,
  "groups": [
    {
      "group_name": "Credit Records",
      "min_score": 35,
      "rules": [
        { "attribute": "credit_lenders", "match_score": 10, "no_match_score": -5 } // check with recency of credit match
      ]
    },
    {
      "group_name": "Electoral Role Address Verification",
      "min_score": 35,
      "rules": [
        { "attribute": "address_verified", "match_score": 10, "no_match_score": 0 },
        { "attribute": "address_current_er", "match_score": 20, "no_match_score": 0 },
        { "attribute": "address_gone_away_very_high", "match_score": -15, "no_match_score": 0 },
        { "attribute": "address_gone_away_high", "match_score": -8, "no_match_score": 0 },
        { "attribute": "address_historic_er", "match_score": 5, "no_match_score": 0 }
      ]
    },
    {
      "group_name": "Bonus Sources",
      "min_score": 8,
      "rules": [
        // { "attribute": "prs_verified", "match_score": 6, "no_match_score": 0 },

        { "attribute": "company_officer_current", "match_score": 5, "no_match_score": 0 },

        { "attribute": "address_tracesmart_register", "match_score": 3, "no_match_score": 0 },
        { "attribute": "address_companies_house", "match_score": 3, "no_match_score": 0 },

        { "attribute": "address_insolvency_service", "match_score": 1, "no_match_score": 0 },
        { "attribute": "company_officer_historic", "match_score": 1, "no_match_score": 0 },
        { "attribute": "address_telephone_directory", "match_score": 1, "no_match_score": 0 },
        { "attribute": "address_registry_trust", "match_score": 1, "no_match_score": 0 },

        { "attribute": "ccj", "match_score": 0, "no_match_score": 0 }
      ]
    },
    {
      "group_name": "Identity Match",
      "min_score": 5,
      "rules": [{ "attribute": "lexid_match", "match_score": 5, "no_match_score": 0 }]
    }
  ]
}
```

**Response:**

```json
{
  "data": {
    "id": "1e690298-102b-415d-8136-d0a40c42406d",
    "name": "Verification Scorecard321q",
    "pass_threshold": 100,
    "fail_threshold": 75,
    "groups": [
      {
        "group_name": "Credit Records",
        "min_score": 35,
        "rules": [{ "attribute": "credit_lenders", "match_score": 10, "no_match_score": -5 }]
      },
      {
        "group_name": "Electoral Role Address Verification",
        "min_score": 35,
        "rules": [
          { "attribute": "address_verified", "match_score": 10, "no_match_score": 0 },
          { "attribute": "address_current_er", "match_score": 20, "no_match_score": 0 },
          { "attribute": "address_gone_away_very_high", "match_score": -15, "no_match_score": 0 },
          { "attribute": "address_gone_away_high", "match_score": -8, "no_match_score": 0 },
          { "attribute": "address_historic_er", "match_score": 5, "no_match_score": 0 }
        ]
      },
      {
        "group_name": "Bonus Sources",
        "min_score": 8,
        "rules": [
          { "attribute": "company_officer_current", "match_score": 5, "no_match_score": 0 },
          { "attribute": "address_tracesmart_register", "match_score": 3, "no_match_score": 0 },
          { "attribute": "address_companies_house", "match_score": 3, "no_match_score": 0 },
          { "attribute": "address_insolvency_service", "match_score": 1, "no_match_score": 0 },
          { "attribute": "company_officer_historic", "match_score": 1, "no_match_score": 0 },
          { "attribute": "address_telephone_directory", "match_score": 1, "no_match_score": 0 },
          { "attribute": "address_registry_trust", "match_score": 1, "no_match_score": 0 },
          { "attribute": "ccj", "match_score": 0, "no_match_score": 0 }
        ]
      },
      {
        "group_name": "Identity Match",
        "min_score": 5,
        "rules": [{ "attribute": "lexid_match", "match_score": 5, "no_match_score": 0 }]
      }
    ],
    "username": "ve3idutest01",
    "created_at": "2026-09-08T13:15:22+00:00"
  }
}
```
