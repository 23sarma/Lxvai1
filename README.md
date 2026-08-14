# AegisStream: Real-time Threat Monitoring Engine

High-throughput, real-time threat detection utility for streaming telemetry pipelines, network ingress points, and SIEM/SOAR platforms.

## Key Features
- **High-Performance Stream Processing:** Partitioned sliding-window memory store.
- **Algorithmic Anomaly Detection:** Shannon Entropy calculation for binary/payload evasion detection.
- **Adaptive Rule Evaluation:** Includes built-in rules for Brute Force, Data Exfiltration Surges, and Payload Obfuscation.
- **Extensible Rule API:** Easily plug custom heuristic or behavioral rules.

## Usage Example

typescript
import { ThreatMonitorEngine, ThreatSeverity } from './src/autonomous_modules/real_time_threat_monitoring_9333';

const monitor = new ThreatMonitorEngine();

monitor.on('threatDetected', (alert) => {
  console.warn(`[THREAT DETECTED] ${alert.ruleName} | Severity: ${alert.severity}`);
  console.log(`Mitigation: ${alert.mitigationRecommendation}`);
});

// Simulate Telemetry
monitor.ingest({
  id: 'evt-101',
  timestamp: Date.now(),
  sourceIp: '198.51.100.42',
  action: 'LOGIN_FAILED'
});

