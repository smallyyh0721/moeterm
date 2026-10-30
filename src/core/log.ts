import fs from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { stripAnsi } from '../shared/ansi';
import { fileStamp, sanitizeFileName } from '../shared/format';

export class SessionLogger {
  private stream: fs.WriteStream | null = null;
  private decoder = new StringDecoder('utf8');
  file: string | null = null;

  constructor(
    private readonly root: string,
    private readonly sessionName: string,
  ) {}

  start(): string {
    if (this.stream && this.file) return this.file;
    const folder = path.join(this.root, 'logs', sanitizeFileName(this.sessionName));
    fs.mkdirSync(folder, { recursive: true });
    this.file = path.join(folder, `${fileStamp()}.log`);
    this.stream = fs.createWriteStream(this.file, { flags: 'a' });
    this.stream.write(
      `\uFEFF===== MoeTerm 日志 =====\r\n会话：${this.sessionName}\r\n开始：${new Date().toISOString()}\r\n=======================\r\n`,
    );
    return this.file;
  }

  write(chunk: Buffer): void {
    if (!this.stream) return;
    this.stream.write(stripAnsi(this.decoder.write(chunk)));
  }

  stop(): string | null {
    if (!this.stream || !this.file) return null;
    const file = this.file;
    const rest = stripAnsi(this.decoder.end());
    if (rest) this.stream.write(rest);
    this.stream.write(`\r\n===== 结束：${new Date().toISOString()} =====\r\n`);
    this.stream.end();
    this.stream = null;
    this.decoder = new StringDecoder('utf8');
    return file;
  }
}
