import { EventEmitter } from 'events';

export interface StageUpdatePayload {
  stageNumber: number;
  stageName: string;
  status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'REJECTED' | 'ACCEPTED' | 'COMPLETED';
  metrics?: Record<string, any>;
  sampleOutput?: Record<string, any>;
  logs: string[];
  timestamp: number;
  retryCount?: number;
  maxRetries?: number;
  loopBackToStage?: number;
  tokensUsed?: number;
  costSaved?: number;
}

export class TelemetryService {
  private static instance: TelemetryService;
  private emitter: EventEmitter;
  private memoryLogs: Map<string, StageUpdatePayload[]>;
  private mongoCollection: any = null;
  private mongoConnecting: boolean = false;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(500);
    this.memoryLogs = new Map();
    this.initMongo();
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  private async initMongo() {
    if (this.mongoCollection || this.mongoConnecting) return;
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) return;

    try {
      this.mongoConnecting = true;
      const { MongoClient } = await import('mongodb');
      const client = new MongoClient(mongoUri);
      await client.connect();
      const db = client.db(process.env.MONGODB_DB_NAME || 'halluciguard');
      this.mongoCollection = db.collection('pipeline_logs');
      // Create index on sessionId and timestamp
      await this.mongoCollection.createIndex({ sessionId: 1, timestamp: 1 });
      console.log('✅ Connected to MongoDB collection pipeline_logs');
    } catch (err: any) {
      console.warn('⚠️ MongoDB connection not available, using in-memory store for pipeline_logs:', err.message);
    } finally {
      this.mongoConnecting = false;
    }
  }

  /**
   * Emit stage update to all active subscribers and persist log
   */
  public async emitStageUpdate(sessionId: string, payload: StageUpdatePayload): Promise<void> {
    if (!payload.timestamp) {
      payload.timestamp = Date.now();
    }

    // Save log to MongoDB / in-memory
    await this.saveLog(sessionId, payload);

    // Emit event to local subscribers
    this.emitter.emit(`telemetry:${sessionId}`, payload);
  }

  /**
   * Subscribe to real-time stage updates for a specific sessionId
   * Returns an unsubscribe function
   */
  public subscribe(sessionId: string, callback: (payload: StageUpdatePayload) => void): () => void {
    const eventName = `telemetry:${sessionId}`;
    this.emitter.on(eventName, callback);

    return () => {
      this.emitter.off(eventName, callback);
    };
  }

  /**
   * Save a single stage data record to MongoDB collection pipeline_logs
   */
  public async saveLog(sessionId: string, stageData: StageUpdatePayload): Promise<void> {
    // 1. In-memory append
    if (!this.memoryLogs.has(sessionId)) {
      this.memoryLogs.set(sessionId, []);
    }
    const sessionList = this.memoryLogs.get(sessionId)!;
    // Replace if exact same stageNumber and updating status, or append
    const existingIdx = sessionList.findIndex(item => item.stageNumber === stageData.stageNumber && item.status === stageData.status);
    if (existingIdx >= 0) {
      sessionList[existingIdx] = stageData;
    } else {
      sessionList.push(stageData);
    }

    // 2. MongoDB persistence
    if (this.mongoCollection) {
      try {
        await this.mongoCollection.insertOne({
          sessionId,
          ...stageData,
          createdAt: new Date(stageData.timestamp)
        });
      } catch (err: any) {
        console.error(`Error saving stage ${stageData.stageNumber} log to MongoDB:`, err.message);
      }
    }
  }

  /**
   * Fetch all logs for a sessionId sorted by timestamp for replay
   */
  public async getLogs(sessionId: string): Promise<StageUpdatePayload[]> {
    if (this.mongoCollection) {
      try {
        const docs = await this.mongoCollection
          .find({ sessionId })
          .sort({ timestamp: 1 })
          .toArray();
        if (docs && docs.length > 0) {
          return docs.map((d: any) => {
            const { _id, ...rest } = d;
            return rest as StageUpdatePayload;
          });
        }
      } catch (err: any) {
        console.error('Error fetching logs from MongoDB, falling back to memory:', err.message);
      }
    }

    return (this.memoryLogs.get(sessionId) || []).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear logs (for testing or session cleanup)
   */
  public clearSession(sessionId: string) {
    this.memoryLogs.delete(sessionId);
  }
}

export const telemetryService = TelemetryService.getInstance();
