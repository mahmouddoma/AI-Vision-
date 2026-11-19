# Real backend integration runbook

The frontend is configured to use `http://192.168.1.8:8005/api/v1` and the hub at `http://192.168.1.8:8005/hubs/analytics`. Earlier baseline connectivity succeeded, but read-only checks on 2026-11-18 now return HTTP 500 for Swagger, health/live, health/ready, sites and a smart visualization. Restore backend health and verify the deployed commit before running live UAT. No live integration success is claimed for the expanded handoff.

The backend currently allows `http://localhost:4200` through CORS, but not `http://127.0.0.1:4200`. The commands below are for preparing a local backend if needed; they are not required to change the configured LAN server.

## Backend prerequisites

Use the separate [AI_Analytical backend repository](https://github.com/LoaiSaberC4r/AI_Analytical) with .NET 10 SDK, SQL Server 2022+ (Express supported), and Mosquitto plus `mosquitto_pub`. Follow its current configuration documentation for database access and migrations. Do not copy its appsettings, broker passwords or connection strings into this frontend.

From the backend solution directory, the upstream README specifies:

```powershell
dotnet tool restore
$env:ConnectionStrings__DefaultConnection = 'Server=.\SQLEXPRESS;Database=CameraAnalytics;Integrated Security=True;TrustServerCertificate=True'
$env:Mqtt__Host = '127.0.0.1'
dotnet run --project src/CameraAnalytics.Api
```

The SQL string above is only a local integrated-security example; use your own approved environment configuration. Startup may apply migrations according to the backend settings. Database changes and broker configuration are operator actions, not performed by this frontend.

Verify `http://localhost:5080/swagger/index.html` and `http://localhost:5080/api/v1/health/ready`. Readiness can return 503 when the database is unavailable, or 200 with Degraded when MQTT is disconnected. Liveness alone does not prove readiness.

Run `npm start` in this frontend and open `http://localhost:4200`. Ensure this exact origin is in the backend CORS allowlist; `localhost` and `127.0.0.1` are different origins. Adapt public/config.json for another backend. Production hosting also needs SPA route fallback and environment-appropriate HTTPS.

## Register the handoff's demo hierarchy

In the UI, create **Main Mall**, code **MALL-001**, time zone **Africa/Cairo**. Register two cameras with the case-sensitive external IDs **cam1** and **2**. Use the generated MQTT topics; these external IDs are not the API path GUIDs.

- Camera cam1: register zone_01.
- Camera 2: register zone_01 and zone_02.
- Reusing zone_01 across two cameras is valid. An unknown zone must not create a new registry row.

The upstream sample publisher defaults to camera `1`, so override `-CameraId` and `-ZoneIds` to match this handoff. From the backend solution directory, with a prepared local broker:

```powershell
.\samples\publish-mqtt.ps1 -BrokerHost 127.0.0.1 -CameraId cam1 -ZoneIds zone_01 -SourceType live -Messages 120
.\samples\publish-mqtt.ps1 -BrokerHost 127.0.0.1 -CameraId 2 -ZoneIds zone_01,zone_02 -SourceType live -Messages 20
.\samples\publish-mqtt.ps1 -BrokerHost 127.0.0.1 -CameraId cam1 -ZoneIds zone_01 -SourceType video_file -Messages 20
```

Use separate terminals for simultaneous streams. Start the 120-message live stream while the realtime integration test runs. The sample includes an optional `-ExerciseEdgeCases` switch for duplicate/late sequences, unknown IDs and session transitions. Review the current upstream sample before running it; this frontend does not publish MQTT itself.

## Run real integration tests

```sh
npm run test:e2e:live
```

This separate suite uses the configured backend without route mocks. It checks the handoff registry, registered-only live zones, advancing publisher stateVersion, a transport outage/recovery, and a real video session report. The publisher must run concurrently for the advancing-sequence test. It only reads existing registered data; prepare demo data through the UI beforehand.

Inspect and retain runtime Swagger, request/response samples and real screenshots. Compare displayed chart/ranking values against the corresponding API report. Confirm that unregistered camera/zone messages do not add UI rows and that site changes leave old hub groups. Test Fresh -> Stale -> NoRecentData and NeverReceived against real backend timing configuration.

## Remaining backend caveats

- Video loop semantics and repeated playback can affect track/dwell estimates; no frontend deduplication claim is made.
- PR #1 exposes explicit video-loop filters and returned loop metadata. Other unsupported producer telemetry is not inferred or invented.
- Ranking/peak coverage eligibility follows backend configuration. Low coverage is surfaced; frontend code does not invent a winning zone or a unique-person count.
- PR #1 supports external JWT authentication, alerts/rules, floor polygons and measured heatmaps; see [SMART_INTEGRATION.md](SMART_INTEGRATION.md). User administration, first-party login, raw video playback, floor image upload and cross-camera identity remain unsupported. Comparison/forecast internals have no HTTP mapping in the inspected commit.

Source: [backend README](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/README.md), [sample publisher](https://github.com/LoaiSaberC4r/AI_Analytical/blob/master/samples/publish-mqtt.ps1), and the supplied [Jira handoff](JIRA_HANDOFF.md). The backend README's own runtime claims are not evidence that this frontend was tested against that environment.
