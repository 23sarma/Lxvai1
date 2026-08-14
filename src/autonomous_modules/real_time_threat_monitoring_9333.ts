import { EventEmitter } from 'events';

/**
 * Core Telemetry & Threat Types
 */
export enum ThreatSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ThreatCategory {
  BRUTE_FORCE = 'BRUTE_FORCE',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  SUSPICIOUS_PAYLOAD = 'SUSPICIOUS_PAYLOAD',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  LATERAL_MOVEMENT = 'LATERAL_MOVEMENT',
  ANOMALOUS_TRAFFIC = 'ANOMALOUS_TRAFFIC'
}

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  sourceIp: string;
  destinationIp?: string;
  userId?: string;
  action: string;
  payloadSize?: number;
  rawPayload?: string;
  metadata?: Record<string, unknown>;
}

export interface ThreatAlert {
  alertId: string;
  timestamp: number;
  severity: ThreatSeverity;
  category: ThreatCategory;
  ruleName: string;
  confidenceScore: number; // 0.0 to 1.0
  context: {
    targetIdentifier: string;
    eventCount: number;
    sampleEvents: TelemetryEvent[];
    details: Record<string, unknown>;
  };
  mitigationRecommendation: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  category: ThreatCategory;
  severity: ThreatSeverity;
  windowMs: number;
  threshold: number;
  evaluate: (events: TelemetryEvent[], context: RuleContext) => RuleEvaluationResult;
}

export interface RuleContext {
  now: number;
  baselineMetrics: Map<string, number>;
}

export interface RuleEvaluationResult {
  triggered: boolean;
  confidence: number;
  details: Record<string, unknown>;
}

/**
 * Shannon Entropy Calculator for Anomaly and Payload Inspection
 */
export class EntropyAnalyzer {
  public static calculateShannonEntropy(data: string): number {
    if (!data || data.length === 0) return 0;
    const charFrequencies = new Map<string, number>();
    for (const char of data) {
      charFrequencies.set(char, (charFrequencies.get(char) || 0) + 1);
    }

    let entropy = 0;
    const len = data.length;
    for (const count of charFrequencies.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }
}

/**
 * Thread-Safe Sliding Window Buffer for Real-time Aggregation
 */
export class SlidingWindowBuffer {
  private events: TelemetryEvent[] = [];
  private readonly windowSizeMs: number;

  constructor(windowSizeMs: number) {
    this.windowSizeMs = windowSizeMs;
  }

  public add(event: TelemetryEvent): void {
    this.events.push(event);
    this.prune(event.timestamp);
  }

  public prune(currentTime: number): void {
    const cutoff = currentTime - this.windowSizeMs;
    let i = 0;
    while (i < this.events.length && this.events[i].timestamp < cutoff) {
      i++;
    }
    if (i > 0) {
      this.events.splice(0, i);
    }
  }

  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  public getCount(): number {
    return this.events.length;
  }

  public clear(): void {
    this.events = [];
  }
}

/**
 * Real-Time Autonomous Threat Monitor Engine
 */
export class ThreatMonitorEngine extends EventEmitter {
  private partitions = new Map<string, SlidingWindowBuffer>();
  private rules: DetectionRule[] = [];
  private baselines = new Map<string, number>();
  private maxPartitionRetentionMs: number;

  constructor(maxPartitionRetentionMs: number = 60000) {
    super();
    this.maxPartitionRetentionMs = maxPartitionRetentionMs;
    this.initializeDefaultRules();
  }

  public registerRule(rule: DetectionRule): void {
    this.rules.push(rule);
  }

  public setBaseline(key: string, value: number): void {
    this.baselines.set(key, value);
  }

  /**
   * Ingest and process telemetry stream in real-time
   */
  public ingest(event: TelemetryEvent): ThreatAlert[] {
    const alerts: ThreatAlert[] = [];
    const partitionKey = event.userId || event.sourceIp || 'global';

    if (!this.partitions.has(partitionKey)) {
      this.partitions.set(
        partitionKey,
        new SlidingWindowBuffer(this.maxPartitionRetentionMs)
      );
    }

    const buffer = this.partitions.get(partitionKey)!;
    buffer.add(event);
    const currentEvents = buffer.getEvents();

    const ruleContext: RuleContext = {
      now: event.timestamp,
      baselineMetrics: this.baselines
    };

    for (const rule of this.rules) {
      const windowCutoff = event.timestamp - rule.windowMs;
      const ruleMatchingEvents = currentEvents.filter(e => e.timestamp >= windowCutoff);

      if (ruleMatchingEvents.length === 0) continue;

      const evalResult = rule.evaluate(ruleMatchingEvents, ruleContext);
      if (evalResult.triggered) {
        const alert: ThreatAlert = {
          alertId: `ALERT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          timestamp: event.timestamp,
          severity: rule.severity,
          category: rule.category,
          ruleName: rule.name,
          confidenceScore: Math.min(1.0, Math.max(0.0, evalResult.confidence)),
          context: {
            targetIdentifier: partitionKey,
            eventCount: ruleMatchingEvents.length,
            sampleEvents: ruleMatchingEvents.slice(-5),
            details: evalResult.details
          },
          mitigationRecommendation: this.resolveMitigation(rule.category, rule.severity)
        };

        alerts.push(alert);
        this.emit('threatDetected', alert);
      }
    }

    return alerts;
  }

  private resolveMitigation(category: ThreatCategory, severity: ThreatSeverity): string {
    switch (category) {
      case ThreatCategory.BRUTE_FORCE:
        return severity === ThreatSeverity.CRITICAL
          ? 'Temporarily block source IP and trigger MFA step-up authentication.'
          : 'Apply progressive rate limiting and captcha challenge.';
      case ThreatCategory.DATA_EXFILTRATION:
        return 'Isolate session token, revoke egress network routes, and notify SOC.';
      case ThreatCategory.SUSPICIOUS_PAYLOAD:
        return 'Sanitize incoming WAF pipeline and quarantine originating payload identifier.';
      case ThreatCategory.PRIVILEGE_ESCALATION:
        return 'Revoke active IAM credential grants and trigger automated permission audit.';
      default:
        return 'Observe telemetry stream and increase monitoring resolution.';
    }
  }

  private initializeDefaultRules(): void {
    // 1. High Velocity Auth Failures (Brute Force)
    this.registerRule({
      id: 'RULE-001',
      name: 'Rapid Authentication Failures',
      category: ThreatCategory.BRUTE_FORCE,
      severity: ThreatSeverity.HIGH,
      windowMs: 15000, // 15 seconds
      threshold: 5,
      evaluate: (events) => {
        const failedLogins = events.filter(
          e => e.action === 'AUTH_FAILURE' || e.action === 'LOGIN_FAILED'
        );
        const triggered = failedLogins.length >= 5;
        return {
          triggered,
          confidence: triggered ? Math.min(1.0, 0.6 + failedLogins.length * 0.05) : 0,
          details: { failedCount: failedLogins.length }
        };
      }
    });

    // 2. High Shannon Entropy Payload Detection (Evasion / Encrypted Shellcode)
    this.registerRule({
      id: 'RULE-002',
      name: 'High Entropy Payload Anomaly',
      category: ThreatCategory.SUSPICIOUS_PAYLOAD,
      severity: ThreatSeverity.CRITICAL,
      windowMs: 30000,
      threshold: 5.5,
      evaluate: (events) => {
        let highestEntropy = 0;
        let offendingEvent: TelemetryEvent | null = null;

        for (const evt of events) {
          if (evt.rawPayload) {
            const entropy = EntropyAnalyzer.calculateShannonEntropy(evt.rawPayload);
            if (entropy > highestEntropy) {
              highestEntropy = entropy;
              offendingEvent = evt;
            }
          }
        }

        const triggered = highestEntropy >= 5.5;
        return {
          triggered,
          confidence: triggered ? 0.92 : 0.0,
          details: {
            maxEntropyObserved: highestEntropy,
            sampleEventId: offendingEvent ? offendingEvent.id : null
          }
        };
      }
    });

    // 3. Volumetric Data Exfiltration Surge
    this.registerRule({
      id: 'RULE-003',
      name: 'Anomalous Egress Volume',
      category: ThreatCategory.DATA_EXFILTRATION,
      severity: ThreatSeverity.CRITICAL,
      windowMs: 60000, // 1 minute
      threshold: 50000000, // 50MB baseline threshold
      evaluate: (events, context) => {
        const totalBytes = events.reduce((acc, curr) => acc + (curr.payloadSize || 0), 0);
        const baseline = context.baselineMetrics.get('max_egress_bytes_per_min') || 10000000;
        const surgeRatio = totalBytes / baseline;
        const triggered = surgeRatio > 3.0;

        return {
          triggered,
          confidence: triggered ? Math.min(0.99, 0.5 + (surgeRatio * 0.1)) : 0,
          details: { totalBytes, baseline, surgeRatio }
        };
      }
    });
  }
}
