# MissingPiece Load Test Report

Same test, before and after moving the database next to the API server · 24 Nov 2026

Median response

1,100 ms280 ms−75%

95th percentile

1,500 ms310 ms−79%

Throughput

7.95 req/s17.63 req/s2.2×

Failures

0%0%unchanged

## What changed

- **Database moved** from Alwaysdata PostgreSQL 17.12 (France) to Amazon RDS PostgreSQL 18.3 (`db.t4g.micro`) in Sydney, the same AWS region as the EC2 API server.
- **One database round trip:** 259 ms → 0.5 ms, measured from the server with `select 1`.
- **Nothing else changed:** same code, same EC2 server, same test, run from the same laptop in Bangladesh. Data copied in full: 27 users, 12 projects, 33 offers.

## Test setup

| Setting | Before | After |
| --- | --- | --- |
| Run started | 24 Nov 2026, 12:29 | 24 Nov 2026, 17:26 |
| Database | Alwaysdata, France | Amazon RDS, Sydney |
| Tool and user type | Locust, logged-out visitors | Locust, logged-out visitors |
| Simultaneous users | 25 | 25 |
| Wait between clicks | 1–3 s | 1–3 s |
| Run length | ≈ 7 min | 5 min |
| Total requests | 3,397 | 5,268 |

## Response times by endpoint (ms)

| Endpoint · statistic | Before | After | Change |
| --- | --- | --- | --- |
| /api/feed — program list |  |  |  |
| Median | 1,100 | 290 | −74% |
| Average | 1,174 | 309 | −74% |
| 95th percentile | 1,800 | 350 | −81% |
| 99th percentile | 2,600 | 870 | −67% |
| Slowest | 3,031 | 1,108 | −63% |
| /api/events/\[id\]/comments — program comments |  |  |  |
| Median | 1,000 | 280 | −72% |
| Average | 1,012 | 282 | −72% |
| 95th percentile | 1,400 | 290 | −79% |
| 99th percentile | 2,300 | 340 | −85% |
| Slowest | 2,645 | 770 | −71% |
| /api/health — no database (network only) |  |  |  |
| Median | 280 | 280 | same |
| 95th percentile | 280 | 280 | same |
| All requests |  |  |  |
| Median | 1,100 | 280 | −75% |
| Average | 1,004 | 293 | −71% |
| 95th percentile | 1,500 | 310 | −79% |
| 99th percentile | 2,600 | 570 | −78% |
| Requests per second | 7.95 | 17.63 | +122% |
| Failures | 0 of 3,397 | 0 of 5,268 | none |

Throughput rose because each simulated visitor waits for a reply before its next click; faster replies mean more requests from the same 25 users.

## Where the time goes

| Part of a feed request (median) | Before | After |
| --- | --- | --- |
| Network, Bangladesh ↔ Sydney (the health check time) | ≈ 280 ms | ≈ 280 ms |
| Server and database work | ≈ 820 ms | ≈ 10 ms |
| **Total** | **1,100 ms** | **290 ms** |

The remaining ≈ 280 ms is distance from the users to the Sydney region. The AWS account is limited to `ap-southeast-2` by organization policy, so a closer region (Mumbai or Singapore, ≈ 50–70 ms) is not available.

## Conclusion

Moving the database into the same region as the API cut typical response times by about 75% and more than doubled throughput, with no errors. Server-side work is now about 10 ms per request; network distance is the only significant cost left. Higher user counts (50, 100) are the next test to find the server's limit.