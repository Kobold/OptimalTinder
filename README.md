# OptimalTinder

*Meet hot girls faster.*

Facebook auth secrets are stored in `secrets.json`:

```json
{
    "facebook_id": "100...",
    "token": "CAAGm0P..."
}
```

`facebook_id` is just the user ID associated with your facebook account.

`token` is the access_token passed back to tinder in the facebook oauth call result.
You'll likely have to snoop it from your iPhone's traffic.
