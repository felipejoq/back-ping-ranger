export interface AlertPayload {
  monitorName: string;
  monitorUrl: string;
  status: 'down' | 'recovered';
  incidentStartedAt: Date;
  resolvedAt?: Date;
  statusCode?: number;
  errorMsg?: string;
}

export interface AlertChannel {
  send(payload: AlertPayload): Promise<void>;
}
