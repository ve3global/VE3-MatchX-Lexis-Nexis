# LexisNexis API: Token generation

Authorization: bearer token required

**Headers:**

```
Authorization: Basic <base64 encoded client_id:client_secret>
```

**Payload:**

```json
{
  "grant_type": "client_credentials"
}
```

**Response:**

```json
{
  "token_type": "Bearer",
  "expires_in": 1800,
  "access_token": "<redacted — see source doc; sandbox tokens are not committed, matching planning/api-drift-remediation.md's convention>"
}
```

**In code integration:**

```python
response = requests.post(
    cls.TOKEN_URL,
    auth=(cls.CLIENT_ID, cls.CLIENT_SECRET),
    data={"grant_type": "client_credentials"},
    timeout=15,
)
```
