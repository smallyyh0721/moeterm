import fs from 'node:fs';
import path from 'node:path';

interface KnownFile {
  version: 1;
  hosts: Record<string, string>;
}

export type HostKeyResult = 'ok' | 'saved' | 'changed';

export class KnownHosts {
  private hosts: Record<string, string> = {};

  constructor(private readonly file: string) {
    this.load();
  }

  check(host: string, port: number, fingerprint: string, trustChanged: boolean): HostKeyResult {
    const id = `${host}:${port}`;
    const current = this.hosts[id];
    if (!current) {
      this.hosts[id] = fingerprint;
      this.save();
      return 'saved';
    }
    if (current === fingerprint) return 'ok';
    if (trustChanged) {
      this.hosts[id] = fingerprint;
      this.save();
      return 'saved';
    }
    return 'changed';
  }

  private load(): void {
    if (!fs.existsSync(this.file)) return;
    const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<KnownFile>;
    if (parsed && parsed.hosts && typeof parsed.hosts === 'object') {
      this.hosts = { ...parsed.hosts };
    }
  }

  private save(): void {
    const dir = path.dirname(this.file);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    const body: KnownFile = { version: 1, hosts: this.hosts };
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }
}
