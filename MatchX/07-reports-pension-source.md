# LexisNexis API for pension source (scorecard + action) — 2026-09-17 capture

A later capture than `06-reports-address-verification-action.md`'s (2026-09-08)
— same `address-verification` action with `config.nfi_address: true`, but run
against a report scored by a scorecard purpose-built for NFI/pension sources
instead of `06`'s general-purpose one. Two things this capture confirms that
`06` didn't exercise: every `nfi_address`-gated attribute is also a named NFI
source (not just the pensions/payroll/transport_pass the `06` sample happened
to match), and the `sources` list is a single list sorted by `recency`
descending — NFI entries interleave with electoral-roll ones by date, they
aren't appended after them.

**Scorecard creation payload — `POST /scorecards`:**

```json
{
  "name": "Verification Pension Scorecard12",
  "pass_threshold": 100,
  "fail_threshold": 75,
  "groups": [
    {
      "group_name": "Electoral Role Address Verification",
      "min_score": 35,
      "rules": [
        { "attribute": "address_verified", "match_score": 10, "no_match_score": 0 },
        { "attribute": "address_current_er", "match_score": 20, "no_match_score": 0 },
        { "attribute": "address_historic_er", "match_score": 5, "no_match_score": 0 },
        { "attribute": "address_gone_away_high", "match_score": -8, "no_match_score": 0 },
        { "attribute": "address_gone_away_very_high", "match_score": -15, "no_match_score": 0 }
      ]
    },
    {
      "group_name": "NFI Address Sources",
      "rules": [
        { "attribute": "address_council_tax", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_council_tax_reduction_scheme", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_deferred_pensions", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_housing_benefits", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_housing_tenants", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_payroll", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_pensions", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_pensions_gratuities", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_personal_licence", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_right_to_buy", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_state_benefits", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_student_loans", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_taxi_drivers", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_transport_pass", "match_score": 25, "no_match_score": 0 },
        { "attribute": "address_waiting_list", "match_score": 25, "no_match_score": 0 }
      ]
    }
  ]
}
```

Note: the source capture's `"NFI Address Sources"` group carried no
`min_score` (unlike `"Electoral Role Address Verification"`'s `35`) — this
repo's `groupSchema` requires `min_score` on every group and the scoring
engine never actually reads it (see `src/scoring/engine.ts`'s `evaluateGroup`),
so the postman/fixture copy of this payload fills in a value rather than
treating the omission as a schema change (see `planning/api-drift-remediation.md`
if this needs revisiting with a capture that deliberately tests the field's
absence).

**Action payload — `POST /reports/:reportId/actions/address-verification`:**

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
    "id": "d9680bfa-2745-49ec-b32d-8a8116365d4f",
    "created_at": "2026-09-17T08:09:20+00:00",
    "updated_at": "2026-09-17T08:09:20+00:00",
    "status": "COMPLETE",
    "context": {
      "reference": "abc-44ds4",
      "enduser_agreement": true,
      "scorecard_id": "14fb83b7-146d-435f-a162-742d1555a5cc",
      "full_er": false,
      "nfi_address": true
    },
    "user": {
      "id": "25ea6f9b-4219-4e05-bd81-8dcf82470649",
      "username": "VE3IDUTEST01"
    },
    "assessment": {
      "scorecard_id": "14fb83b7-146d-435f-a162-742d1555a5cc",
      "score": 65,
      "result": "FAIL",
      "reasons": [
        { "label": "Address verified", "indicator": "POSITIVE" },
        { "label": "On previous electoral registers", "indicator": "POSITIVE" },
        { "label": "NFI address personal licence source found", "indicator": "POSITIVE" },
        { "label": "NFI address right to buy source found", "indicator": "POSITIVE" }
      ],
      "score_breakdown": [
        {
          "group": "Electoral Role Address Verification",
          "group_score": 15,
          "rules": [
            { "attribute": "address_verified", "score": 10, "matched": true },
            { "attribute": "address_current_er", "score": 0, "matched": false },
            { "attribute": "address_historic_er", "score": 5, "matched": true },
            { "attribute": "address_gone_away_high", "score": 0, "matched": false },
            { "attribute": "address_gone_away_very_high", "score": 0, "matched": false }
          ]
        },
        {
          "group": "NFI Address Sources",
          "group_score": 50,
          "rules": [
            { "attribute": "address_council_tax", "score": 0, "matched": false },
            { "attribute": "address_council_tax_reduction_scheme", "score": 0, "matched": false },
            { "attribute": "address_deferred_pensions", "score": 0, "matched": false },
            { "attribute": "address_housing_benefits", "score": 0, "matched": false },
            { "attribute": "address_housing_tenants", "score": 0, "matched": false },
            { "attribute": "address_payroll", "score": 0, "matched": false },
            { "attribute": "address_pensions", "score": 0, "matched": false },
            { "attribute": "address_pensions_gratuities", "score": 0, "matched": false },
            { "attribute": "address_personal_licence", "score": 25, "matched": true },
            { "attribute": "address_right_to_buy", "score": 25, "matched": true },
            { "attribute": "address_state_benefits", "score": 0, "matched": false },
            { "attribute": "address_student_loans", "score": 0, "matched": false },
            { "attribute": "address_taxi_drivers", "score": 0, "matched": false },
            { "attribute": "address_transport_pass", "score": 0, "matched": false },
            { "attribute": "address_waiting_list", "score": 0, "matched": false }
          ]
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
        { "source": "NFI_RIGHT_TO_BUY", "description": "NFI - Right to buy", "recency": "2020-09-14" },
        { "source": "NFI_PERSONAL_LICENCE", "description": "NFI - Personal licence", "recency": "2020-09-14" },
        { "source": "ER2010", "description": "2010 UK Open Electoral Register", "recency": "2009-10-15" },
        { "source": "ER2009", "description": "2009 UK Open Electoral Register", "recency": "2008-10-15" },
        { "source": "ER2008", "description": "2008 UK Open Electoral Register", "recency": "2007-10-15" },
        { "source": "ER2007", "description": "2007 UK Open Electoral Register", "recency": "2006-10-15" },
        { "source": "ER2006", "description": "2006 UK Open Electoral Register", "recency": "2005-10-15" },
        { "source": "ER2005", "description": "2005 UK Open Electoral Register", "recency": "2004-10-15" }
      ]
    },
    "attributes": {
      "address_companies_house": false,
      "address_council_tax": false,
      "address_council_tax_reduction_scheme": false,
      "address_current_er": false,
      "address_deferred_pensions": false,
      "address_gone_away_high": false,
      "address_gone_away_very_high": false,
      "address_historic_er": true,
      "address_housing_benefits": false,
      "address_housing_tenants": false,
      "address_insolvency_service": false,
      "address_nfi_sources": 2,
      "address_payroll": false,
      "address_pensions": false,
      "address_pensions_gratuities": false,
      "address_personal_budgets": false,
      "address_personal_licence": true,
      "address_registry_trust": false,
      "address_right_to_buy": true,
      "address_state_benefits": false,
      "address_student_loans": false,
      "address_taxi_drivers": false,
      "address_telephone_directory": false,
      "address_tracesmart_register": false,
      "address_transport_pass": false,
      "address_verified": true,
      "address_waiting_list": false
    }
  }
}
```
