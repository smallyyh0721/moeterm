import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { KnownHosts } from '../src/core/known-hosts';
import { DataStore, type Cipher } from '../src/core/store';
import { collectConnections } from '../src/shared/tree';

const cipher: Cipher = {
  encrypt: (plain) => Buffer.from(`enc:${plain}`, 'utf8').toString('base64url'),
  decrypt: (payload) => {
    const text = Buffer.from(payload, 'base64url').toString('utf8');
    if (!text.startsWith('enc:')) throw new Error('bad secret');
    return text.slice(4);
  },
};

const dirs: string[] = [];

function tempStore(): DataStore {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moeterm-data-'));
  dirs.push(root);
  return new DataStore(root, cipher);
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('数据目录', () => {
  it('把连接放进目录，密码只以密文写入', () => {
    const store = tempStore();
    store.createFolder(null, '存储服务器');
    const folder = store.getTree()[0];
    if (!folder || folder.type !== 'folder') throw new Error('目录没建出来');
    store.saveConnection({
      parentId: folder.id,
      name: 'nas-01',
      host: ' 10.0.0.8 ',
      port: 22,
      username: 'root',
      authType: 'password',
      saveSecret: true,
      legacyAlgorithms: false,
      password: 's3cret-密码',
    });
    const treeFile = fs.readFileSync(path.join(store.root, 'tree.json'), 'utf8');
    const secretFile = fs.readFileSync(path.join(store.root, 'secrets.json'), 'utf8');
    expect(treeFile).not.toContain('s3cret-密码');
    expect(secretFile).not.toContain('s3cret-密码');
    const saved = store.getTree()[0];
    if (!saved || saved.type !== 'folder') throw new Error('目录丢了');
    const connection = saved.children[0];
    if (!connection || connection.type !== 'connection') throw new Error('连接丢了');
    expect(connection.host).toBe('10.0.0.8');
    expect(connection.hasPassword).toBe(true);
    expect(store.readSecret(connection.id).password).toBe('s3cret-密码');
  });

  it('私钥复制进密钥目录，删除连接后清掉没人用的密钥', () => {
    const store = tempStore();
    const source = path.join(store.root, 'source.key');
    fs.writeFileSync(source, '-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----\n');
    store.saveConnection(
      {
        parentId: null,
        name: 'jump',
        host: '10.1.1.1',
        port: 22,
        username: 'ops',
        authType: 'privateKey',
        saveSecret: false,
        legacyAlgorithms: true,
      },
      { bytes: fs.readFileSync(source), label: 'source.key' },
    );
    const connection = store.getTree()[0];
    if (!connection || connection.type !== 'connection' || !connection.keyId) throw new Error('私钥没挂上');
    expect(fs.existsSync(path.join(store.keyDir, connection.keyId))).toBe(true);
    expect(store.readKey(connection.keyId).toString('utf8')).toContain('OPENSSH');
    store.deleteNode(connection.id);
    expect(fs.existsSync(path.join(store.keyDir, connection.keyId))).toBe(false);
    expect(collectConnections(JSON.parse(fs.readFileSync(path.join(store.root, 'tree.json'), 'utf8')).nodes, null)).toEqual([]);
  });

  it('编辑时留空密码会保留原来的密文', () => {
    const store = tempStore();
    store.saveConnection({
      parentId: null,
      name: 'nas',
      host: '10.0.0.1',
      port: 22,
      username: 'root',
      authType: 'password',
      saveSecret: true,
      legacyAlgorithms: false,
      password: 'keep-me',
    });
    const connection = store.getTree()[0];
    if (!connection || connection.type !== 'connection') throw new Error('没有连接');
    store.saveConnection({
      id: connection.id,
      parentId: null,
      name: 'nas',
      host: '10.0.0.1',
      port: 22,
      username: 'root',
      authType: 'password',
      saveSecret: true,
      legacyAlgorithms: false,
    });
    expect(store.readSecret(connection.id).password).toBe('keep-me');
  });

  it('主机密钥第一次信任，变化后拒绝，确认后更新', () => {
    const file = path.join(tempStore().root, 'known_hosts.json');
    const known = new KnownHosts(file);
    expect(known.check('10.0.0.1', 22, 'aaa', false)).toBe('saved');
    expect(known.check('10.0.0.1', 22, 'aaa', false)).toBe('ok');
    expect(known.check('10.0.0.1', 22, 'bbb', false)).toBe('changed');
    expect(known.check('10.0.0.1', 22, 'bbb', true)).toBe('saved');
    expect(known.check('10.0.0.1', 22, 'bbb', false)).toBe('ok');
  });
});
