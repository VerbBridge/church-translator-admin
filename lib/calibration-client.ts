/**
 * WebSocket client for audio calibration
 * Connects to backend calibration endpoint and streams audio
 */

export interface CalibrationClientConfig {
  churchId: number;
  apiUrl?: string;
  onAudioLevel?: (rms: number) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

export class CalibrationClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private audioStream: MediaStream | null = null;
  private config: CalibrationClientConfig;

  constructor(config: CalibrationClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const apiUrl = this.config.apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const fullUrl = `${wsUrl}/api/ws/calibrate/${this.config.churchId}${token ? `?token=${token}` : ''}`;

    console.log('[CalibrationClient] Connecting to:', fullUrl);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(fullUrl);

        this.ws.onopen = () => {
          console.log('[CalibrationClient] Connected');
          this.config.onConnectionChange?.(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'audio_level' && typeof data.rms === 'number') {
              this.config.onAudioLevel?.(data.rms);
            }
          } catch (error) {
            console.error('[CalibrationClient] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[CalibrationClient] WebSocket error:', error);
          this.config.onError?.('WebSocket connection error');
        };

        this.ws.onclose = () => {
          console.log('[CalibrationClient] Disconnected');
          this.config.onConnectionChange?.(false);
        };
      } catch (error) {
        console.error('[CalibrationClient] Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  async startAudioCapture(deviceId: string): Promise<void> {
    console.log('[CalibrationClient] Starting audio capture:', deviceId);

    try {
      const constraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');

      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');

      this.audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          this.sendPCM16Chunk(event.data.data);
        }
      };

      source.connect(this.audioWorkletNode);
      console.log('[CalibrationClient] Audio capture started');
    } catch (error) {
      console.error('[CalibrationClient] Failed to start audio capture:', error);
      throw error;
    }
  }

  stopAudioCapture(): void {
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
  }

  private sendPCM16Chunk(arrayBuffer: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      const bytes = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...bytes));

      this.ws.send(JSON.stringify({
        type: 'audio',
        format: 'pcm16',
        sample_rate: 48000,
        data: base64,
      }));
    } catch (error) {
      console.error('[CalibrationClient] Failed to send audio chunk:', error);
    }
  }

  saveCalibration(data: {
    noise_floor: number;
    speech_level: number;
    vad_threshold: number;
  }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.config.onError?.('Not connected');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'save_calibration',
      ...data,
    }));

    console.log('[CalibrationClient] Saved calibration:', data);
  }

  disconnect(): void {
    this.stopAudioCapture();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.config.onConnectionChange?.(false);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
