import fs from 'node:fs';
import path from 'node:path';
import { KnownHosts } from './known-hosts';
import { assertSafeId, createId } from './ids';
import { assertOpenSshKey, privateKeyNeedsPassphrase } from './keys';
import type {
  ConnectionSave,
  PublicNode,
  Settings,
  StoredConnection,
  StoredNode,
} from '../shared/types';
import { defaultSettings } from '../shared/types';
import {
  collectConnections,
  connectionsInNode,
  findNode,
  insertNode,
  moveNode,
  removeNode,
  replaceNode,
} from '../shared/tree';
import { normalizeHost, validateConnection, validateFolderName } from '../shared/validate';

export interface Cipher {
  encrypt(plain: string): string;
  decrypt(payload: string): string;
}

interface SecretBundle {
  password?: string;
  passphrase?: string;
}

interface SecretFile {
  version: 1;
  items: Record<string, { password?: string; passphrase?: string }>;
}

interface TreeFile {
  version: 1;
  nodes: StoredNode[];
}

const LIMITS = {
  fontMin: 12,
  fontMax: 24,
  sideMin: 200,
  sideMax: 520,
};

export class DataStore {
  readonly knownHosts: KnownHosts;
  private nodes: StoredNode[] = [];
  private secrets = new Map<string, SecretBundle>();
  private settings: Settings = defaultSettings();

  constructor(
    readonly root: string,
    private readonly cipher: Cipher,
  ) {
    fs.mkdirSync(this.keyDir, { recursive: true });
    fs.mkdirSync(this.logDir, { recursive: true });
    this.knownHosts = new KnownHosts(path.join(root, 'known_hosts.json'));
    this.nodes = this.readTree();
    this.secrets = this.readSecrets();
    this.settings = this.readSettings();
  }

  get keyDir(): string {
    return path.join(this.root, 'keys');
  }

  get logDir(): string {
    return path.join(this.root, 'logs');
  }

  getTree(): PublicNode[] {
    return this.nodes.map((node) => this.toPublic(node));
  }

  getSettings(): Settings {
    return { ...this.settings };
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const next: Settings = {
      ...this.settings,
      ...patch,
      version: 1,
    };
    next.fontSize = clamp(Math.round(next.fontSize), LIMITS.fontMin, LIMITS.fontMax);
    next.sidebarWidth = clamp(Math.round(next.sidebarWidth), LIMITS.sideMin, LIMITS.sideMax);
    next.petEnabled = Boolean(next.petEnabled);
    next.logEnabled = Boolean(next.logEnabled);
    next.petX = finiteOrNull(next.petX);
    next.petY = finiteOrNull(next.petY);
    this.settings = next;
    this.writeJson(path.join(this.root, 'settings.json'), next);
    return this.getSettings();
  }

  createFolder(parentId: string | null, name: string): PublicNode[] {
    const problem = validateFolderName(name);
    if (problem) throw new Error(problem);
    const folder = { type: 'folder' as const, id: createId('f'), name: name.trim(), children: [] };
    this.nodes = insertNode(this.nodes, parentId, folder);
    this.saveTree();
    return this.getTree();
  }

  rename(id: string, name: string): PublicNode[] {
    const found = findNode(this.nodes, id);
    if (!found) throw new Error('找不到要重命名的项');
    const problem = found.node.type === 'folder' ? validateFolderName(name) : name.trim() ? null : '请填写名称';
    if (problem) throw new Error(problem);
    if (found.node.type === 'connection' && name.trim().length > 64) throw new Error('名称最多 64 个字符');
    this.nodes = replaceNode(this.nodes, id, { ...found.node, name: name.trim() });
    this.saveTree();
    return this.getTree();
  }

  deleteNode(id: string): PublicNode[] {
    const { nodes, removed } = removeNode(this.nodes, id);
    if (!removed) throw new Error('找不到要删除的项');
    for (const connection of connectionsInNode(removed)) {
      this.secrets.delete(connection.id);
    }
    this.nodes = nodes;
    this.writeSecrets();
    this.saveTree();
    this.gcKeys();
    return this.getTree();
  }

  move(id: string, parentId: string | null): PublicNode[] {
    this.nodes = moveNode(this.nodes, id, parentId);
    this.saveTree();
    return this.getTree();
  }

  duplicate(id: string): PublicNode[] {
    const found = findNode(this.nodes, id);
    if (!found || found.node.type !== 'connection') throw new Error('找不到连接');
    const copy: StoredConnection = {
      ...found.node,
      id: createId('c'),
      name: `${found.node.name} 副本`.slice(0, 64),
    };
    this.nodes = insertNode(this.nodes, found.parentId, copy);
    if (copy.saveSecret) {
      const secret = this.secrets.get(id);
      if (secret) this.secrets.set(copy.id, { ...secret });
      this.writeSecrets();
    }
    this.saveTree();
    return this.getTree();
  }

  saveConnection(draft: ConnectionSave, imported?: { bytes: Buffer; label: string }): PublicNode[] {
    const problem = validateConnection(draft);
    if (problem) throw new Error(problem);
    const name = draft.name.trim();
    const host = normalizeHost(draft.host);
    const username = draft.username.trim();
    const existing = draft.id ? findNode(this.nodes, draft.id) : null;
    if (draft.id && (!existing || existing.node.type !== 'connection')) throw new Error('找不到连接');
    if (draft.parentId && !findNode(this.nodes, draft.parentId)) throw new Error('找不到目录');
    const previous = existing && existing.node.type === 'connection' ? existing.node : null;

    let keyId = draft.authType === 'privateKey' ? previous?.keyId : undefined;
    let keyLabel = draft.authType === 'privateKey' ? previous?.keyLabel : undefined;
    let passphraseRequired = draft.authType === 'privateKey' ? Boolean(previous?.passphraseRequired) : false;
    if (draft.authType === 'privateKey' && imported) {
      const stored = this.writeKey(imported.bytes, imported.label);
      keyId = stored.keyId;
      keyLabel = stored.label;
      passphraseRequired = stored.passphraseRequired;
    }
    if (draft.authType === 'privateKey' && !keyId) throw new Error('请选择私钥');

    const id = previous?.id ?? createId('c');
    const connection: StoredConnection = {
      type: 'connection',
      id,
      name,
      host,
      port: draft.port,
      username,
      authType: draft.authType,
      keyId,
      keyLabel,
      saveSecret: draft.saveSecret,
      legacyAlgorithms: Boolean(draft.legacyAlgorithms),
      passphraseRequired,
    };

    if (previous) {
      this.nodes = replaceNode(this.nodes, id, connection);
      const parentId = existing?.parentId ?? null;
      if (parentId !== draft.parentId) this.nodes = moveNode(this.nodes, id, draft.parentId);
    } else {
      this.nodes = insertNode(this.nodes, draft.parentId, connection);
    }

    this.applySecret(connection, draft);
    this.saveTree();
    this.gcKeys();
    return this.getTree();
  }

  getConnection(id: string): StoredConnection | null {
    const found = findNode(this.nodes, id);
    if (!found || found.node.type !== 'connection') return null;
    return found.node;
  }

  readSecret(id: string): SecretBundle {
    return { ...this.secrets.get(id) };
  }

  readKey(keyId: string): Buffer {
    assertSafeId(keyId);
    const file = path.join(this.keyDir, keyId);
    if (!file.startsWith(this.keyDir)) throw new Error('密钥路径无效');
    if (!fs.existsSync(file)) throw new Error('找不到私钥文件');
    return fs.readFileSync(file);
  }

  private applySecret(connection: StoredConnection, draft: ConnectionSave): void {
    if (!draft.saveSecret || draft.clearSecret) {
      this.secrets.delete(connection.id);
      this.writeSecrets();
      return;
    }
    const prev = this.secrets.get(connection.id) ?? {};
    const password = draft.password ? draft.password : prev.password;
    const passphrase = draft.passphrase ? draft.passphrase : prev.passphrase;
    const next: SecretBundle = {};
    if (connection.authType === 'password' && password) next.password = password;
    if (connection.authType === 'privateKey' && passphrase) next.passphrase = passphrase;
    if (next.password || next.passphrase) this.secrets.set(connection.id, next);
    else this.secrets.delete(connection.id);
    this.writeSecrets();
  }

  private writeKey(bytes: Buffer, label: string): { keyId: string; label: string; passphraseRequired: boolean } {
    assertOpenSshKey(bytes);
    const keyId = createId('k');
    fs.writeFileSync(path.join(this.keyDir, keyId), bytes);
    return {
      keyId,
      label: label.slice(0, 120),
      passphraseRequired: privateKeyNeedsPassphrase(bytes),
    };
  }

  private gcKeys(): void {
    const used = new Set(collectConnections(this.nodes, null).map((item) => item.keyId).filter((id): id is string => Boolean(id)));
    if (!fs.existsSync(this.keyDir)) return;
    for (const name of fs.readdirSync(this.keyDir)) {
      if (!used.has(name)) {
        fs.rmSync(path.join(this.keyDir, name), { force: true });
      }
    }
  }

  private toPublic(node: StoredNode): PublicNode {
    if (node.type === 'folder') {
      return { ...node, children: node.children.map((child) => this.toPublic(child)) };
    }
    const secret = this.secrets.get(node.id);
    return {
      ...node,
      hasPassword: Boolean(secret?.password),
      hasPassphrase: Boolean(secret?.passphrase),
    };
  }

  private readTree(): StoredNode[] {
    const file = path.join(this.root, 'tree.json');
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as TreeFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.nodes)) {
      throw new Error('tree.json 格式无法识别，已保留原文件');
    }
    return parsed.nodes;
  }

  private saveTree(): void {
    const body: TreeFile = { version: 1, nodes: this.nodes };
    this.writeJson(path.join(this.root, 'tree.json'), body);
  }

  private readSecrets(): Map<string, SecretBundle> {
    const file = path.join(this.root, 'secrets.json');
    const map = new Map<string, SecretBundle>();
    if (!fs.existsSync(file)) return map;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as SecretFile;
    for (const [id, item] of Object.entries(parsed.items ?? {})) {
      const bundle: SecretBundle = {};
      if (item.password) bundle.password = this.cipher.decrypt(item.password);
      if (item.passphrase) bundle.passphrase = this.cipher.decrypt(item.passphrase);
      map.set(id, bundle);
    }
    return map;
  }

  private writeSecrets(): void {
    const items: SecretFile['items'] = {};
    for (const [id, bundle] of this.secrets) {
      items[id] = {
        password: bundle.password ? this.cipher.encrypt(bundle.password) : undefined,
        passphrase: bundle.passphrase ? this.cipher.encrypt(bundle.passphrase) : undefined,
      };
    }
    const body: SecretFile = { version: 1, items };
    this.writeJson(path.join(this.root, 'secrets.json'), body);
  }

  private readSettings(): Settings {
    const file = path.join(this.root, 'settings.json');
    if (!fs.existsSync(file)) return defaultSettings();
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Settings>;
      return this.updateSettings({ ...defaultSettings(), ...parsed });
    } catch {
      return defaultSettings();
    }
  }

  private writeJson(file: string, data: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function finiteOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
