/**
 * bleManager.ts — react-native-ble-plx üzerine ince bir BLE katmanı.
 *
 * Tara → bağlan → komut yaz → telemetri dinle. UI bu sınıfı kullanır,
 * BLE detaylarıyla uğraşmaz.
 */
import { BleManager, Device, Subscription, State } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { BLE_CONFIG } from '../config';
import { toBase64, base64ToBytes } from './protocol';

export type TelemetryHandler = (bytes: Uint8Array) => void;

export class DucatiBle {
  private manager = new BleManager();
  private device: Device | null = null;
  private notifySub: Subscription | null = null;

  /** Android 12+ için runtime BLE izinleri */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const sdk = Platform.Version as number;
    const perms =
      sdk >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const res = await PermissionsAndroid.requestMultiple(perms as any);
    return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }

  async waitUntilPoweredOn(): Promise<void> {
    const state = await this.manager.state();
    if (state === State.PoweredOn) return;
    await new Promise<void>((resolve) => {
      const sub = this.manager.onStateChange((s) => {
        if (s === State.PoweredOn) {
          sub.remove();
          resolve();
        }
      }, true);
    });
  }

  /** Scooter'ı tara; bulunca callback ile bildir. stopScan() ile durdur. */
  scan(onFound: (device: Device) => void, onError?: (e: Error) => void): void {
    this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        onError?.(error);
        return;
      }
      if (!device) return;
      const name = device.name || device.localName || '';
      if (name.toUpperCase().includes(BLE_CONFIG.deviceNameFilter.toUpperCase())) {
        onFound(device);
      }
    });
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  async connect(deviceId: string): Promise<void> {
    this.stopScan();
    const dev = await this.manager.connectToDevice(deviceId, { requestMTU: 185 });
    await dev.discoverAllServicesAndCharacteristics();
    this.device = dev;
  }

  async disconnect(): Promise<void> {
    this.notifySub?.remove();
    this.notifySub = null;
    if (this.device) {
      await this.manager.cancelDeviceConnection(this.device.id);
      this.device = null;
    }
  }

  get isConnected(): boolean {
    return this.device !== null;
  }

  /** Telemetri (notify) dinlemeye başla */
  startTelemetry(onData: TelemetryHandler): void {
    if (!this.device) throw new Error('Önce bağlan.');
    this.notifySub = this.device.monitorCharacteristicForService(
      BLE_CONFIG.notifyServiceUUID,
      BLE_CONFIG.notifyCharUUID,
      (error, ch) => {
        if (error || !ch?.value) return;
        onData(base64ToBytes(ch.value));
      },
    );
  }

  /** Scooter'a ham komut paketi gönder */
  async sendPacket(packet: Uint8Array): Promise<void> {
    if (!this.device) throw new Error('Önce bağlan.');
    const b64 = toBase64(packet);
    const { writeServiceUUID, writeCharUUID, writeWithoutResponse } = BLE_CONFIG;
    if (writeWithoutResponse) {
      await this.device.writeCharacteristicWithoutResponseForService(
        writeServiceUUID,
        writeCharUUID,
        b64,
      );
    } else {
      await this.device.writeCharacteristicWithResponseForService(
        writeServiceUUID,
        writeCharUUID,
        b64,
      );
    }
  }

  onDisconnect(cb: () => void): void {
    this.device?.onDisconnected(() => cb());
  }

  destroy(): void {
    this.manager.destroy();
  }
}

export const ble = new DucatiBle();
