# LexisNexis API Endpoint: /address-lookup

**Payload:**

```json
{
  "full_address": "221B, Sherlock House, Baker Street, NW1 6XE, City of Westminster, London"
}
```

**Response:**

```json
{
  "data": [
    {
      "id": 17723725,
      "address1": "SHERLOCK HOLMES MUSEUM",
      "address2": "221B BAKER STREET",
      "address3": "LONDON",
      "address4": "",
      "address5": "ENGLAND",
      "postcode": "NW1 6XE"
    }
  ]
}
```

**In code integration:**

```python
response = session.post(
    f"{self.BASE_URL}/address-lookup",
    json=payload,
    headers=headers,
    timeout=API_TIMEOUT,
)
```
